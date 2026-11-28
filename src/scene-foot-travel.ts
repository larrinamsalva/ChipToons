import type { Project, Scene, SceneElement, SceneGroundPoint } from "./model";
import { resolvedCharacter } from "./library";
import { puppetFootSoleAt } from "./cinematic-gait";
import { sceneFramesAt, sceneStart, stageCameraAt } from "./timeline";
import { sceneryOffset } from "./world-model";
import { possibleFootTravel } from "./workshop-foot-travel";
import type { FootSide, FootTravelPoint, FootTravelReview } from "./workshop-foot-travel";

export interface FootDepthFinding {
  startIndex: number;
  endIndex: number;
  peakIndex: number;
  seconds: number;
  depthPixels: number;
}

export interface FootSceneryFinding {
  startIndex: number;
  endIndex: number;
  peakIndex: number;
  seconds: number;
  insetPixels: number;
}

/** Only placed, non-backdrop image scenery with stable artwork is eligible. */
export function footSceneryImages(project: Project, scene: Scene): SceneElement[] {
  return scene.elements.filter(element => element.kind === "art" &&
    !!element.sceneryDepth && !element.backdrop && !!element.assetId &&
    project.assets.some(asset => asset.id === element.assetId) &&
    !element.frameSequence &&
    !scene.objectTracks?.some(track => track.objectId === element.id));
}

type SolidRegion = readonly [left: number, top: number, right: number, bottom: number];

/** Conservative interiors of fixed furniture artwork, not the full prop rectangle.
 * Coordinates match PropArt and SceneryArt. Legs, curved edges, strokes and
 * movable or appearance-changing artwork are intentionally not measured. */
function furnitureRegions(element: SceneElement): readonly SolidRegion[] {
  switch (element.prop) {
    case "chair": return [[-31, -103, 28, -60], [-32, -43, 36, -31]];
    case "table": return [[-54, -67, 54, -54]];
    case "bench": return [[-54, -71, 54, -50], [-60, -40, 60, -31]];
    default: return [];
  }
}

export function footSceneryFurniture(scene: Scene): SceneElement[] {
  return scene.elements.filter(element => element.kind === "prop" &&
    !!element.sceneryDepth && !element.backdrop && !element.assetId &&
    !element.characterId && !element.frameSequence && furnitureRegions(element).length > 0 &&
    !scene.objectTracks?.some(track => track.objectId === element.id));
}

function sampledSceneryInsets(project: Project, scene: Scene, element: SceneElement,
  points: FootTravelPoint[], regions: readonly SolidRegion[]): FootSceneryFinding[] | undefined {
  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  if (sceneIndex < 0) return undefined;
  const voiceStart = scene.elements.some(item => item.voiceMouth?.length)
    ? sceneStart(project, sceneIndex) : 0;
  const insets = points.map(point => {
    const frames = sceneFramesAt(project, scene, point.seconds, voiceStart);
    const frame = frames.get(element.id);
    if (!frame || frame.opacity < 0.5 || !(frame.scale > 0)) return 0;
    const camera = stageCameraAt(project, scene, point.seconds, false, frames, voiceStart);
    const depth = sceneryOffset(scene, element, camera, false);
    const radians = frame.rotation * Math.PI / 180;
    const dx = point.x - frame.x - depth.x, dy = point.y - frame.y - depth.y;
    const x = (dx * Math.cos(radians) + dy * Math.sin(radians)) /
      (frame.scale * (element.flip ? -1 : 1));
    const y = (-dx * Math.sin(radians) + dy * Math.cos(radians)) /
      (frame.scale * (element.flipY ? -1 : 1));
    return Math.max(0, ...regions.map(([left, top, right, bottom]) =>
      Math.min(x - left, right - x, y - top, bottom - y) * frame.scale));
  });
  return groupSceneryInsets(points, insets);
}

/** Read-only candidate frames where the sole enters a supported solid furniture region. */
export function possibleFootFurnitureOverlaps(project: Project, scene: Scene, propId: string,
  points: FootTravelPoint[]): FootSceneryFinding[] | undefined {
  const prop = footSceneryFurniture(scene).find(element => element.id === propId);
  return prop ? sampledSceneryInsets(project, scene, prop, points, furnitureRegions(prop)) : undefined;
}

/** Read-only bounding-box candidates, sampled in the same Stage space as the shoe. */
export function possibleFootSceneryOverlaps(project: Project, scene: Scene, imageId: string,
  points: FootTravelPoint[]): FootSceneryFinding[] | undefined {
  const image = footSceneryImages(project, scene).find(element => element.id === imageId);
  if (!image) return undefined;
  const width = image.width ?? 190, height = image.height ?? 245;
  return sampledSceneryInsets(project, scene, image, points, [[-width / 2, -height, width / 2, 0]]);
}

function groupSceneryInsets(points: FootTravelPoint[], insets: number[]): FootSceneryFinding[] {
  const findings: FootSceneryFinding[] = [];
  let start = -1, peak = -1;
  for (let index = 0; index <= points.length; index++) {
    if (index < points.length && insets[index] >= 4) {
      if (start < 0) start = index;
      if (peak < 0 || insets[index] > insets[peak]) peak = index;
    } else if (start >= 0) {
      findings.push({ startIndex: start, endIndex: index - 1, peakIndex: peak,
        seconds: points[peak].seconds, insetPixels: insets[peak] });
      start = peak = -1;
    }
  }
  return findings.sort((a, b) => b.insetPixels - a.insetPixels ||
    a.startIndex - b.startIndex).slice(0, 5);
}

/** A two-point guide applies only within the measured span; old flat guides cover the Stage. */
export function sceneGroundYAt(scene: Scene, x: number): number | undefined {
  if (scene.footGroundY === undefined || !Number.isFinite(x)) return undefined;
  const points = scene.footGroundPoints;
  if (!points || points.length !== 2) return scene.footGroundY;
  const [first, second] = points;
  if (x < Math.min(first.x, second.x) || x > Math.max(first.x, second.x)) return undefined;
  return first.y + (second.y - first.y) * (x - first.x) / (second.x - first.x);
}

/** Group adjacent upright samples at least four pixels below the chosen reference. */
export function possibleFootDepth(points: FootTravelPoint[], upright: boolean[],
  referenceY?: number | ((point: FootTravelPoint) => number | undefined)): FootDepthFinding[] {
  const findings: FootDepthFinding[] = [];
  let start = -1, peak = -1;
  const depth = (point: FootTravelPoint): number | undefined => {
    if (referenceY === undefined) return -point.floorGap;
    const y = typeof referenceY === "function" ? referenceY(point) : referenceY;
    return y === undefined ? undefined : point.y - y;
  };
  const finish = (end: number) => {
    if (start < 0) return;
    findings.push({ startIndex: start, endIndex: end, peakIndex: peak,
      seconds: points[peak].seconds, depthPixels: depth(points[peak])! });
    start = -1;
    peak = -1;
  };
  for (let index = 0; index <= points.length; index++) {
    const value = index < points.length ? depth(points[index]) : undefined;
    if (value !== undefined && upright[index] && value >= 4) {
      if (start < 0) start = index;
      if (peak < 0 || value > depth(points[peak])!) peak = index;
    } else finish(index - 1);
  }
  return findings.sort((a, b) => b.depthPixels - a.depthPixels ||
    a.startIndex - b.startIndex).slice(0, 5);
}

function footParts(project: Project, scene: Scene, actorId: string, side: FootSide) {
  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  const actor = scene.elements.find(item => item.id === actorId);
  const rig = actor && resolvedCharacter(project, actor)?.puppet;
  if (sceneIndex < 0 || !actor || !rig || actor.flipY ||
      (side !== "left" && side !== "right")) return undefined;
  const feet = rig.parts.filter(part =>
    (part.role === "leftFoot" || part.role === "rightFoot") &&
    rig.parts.some(parent => parent.id === part.parentId));
  const foot = feet.find(part => part.role === `${side}Foot`);
  if (feet.length !== 2 || !foot || feet[0].role === feet[1].role) return undefined;
  return { sceneIndex, actor, rig, feet, foot };
}

/** Exact visible Stage-space sole at the playhead for a creator-set guide point. */
export function sceneFootGroundPointAt(project: Project, scene: Scene, actorId: string,
  seconds: number, side: FootSide): SceneGroundPoint | undefined {
  const parts = footParts(project, scene, actorId, side);
  if (!parts || !Number.isFinite(seconds) || seconds < 0 || seconds > scene.duration) return undefined;
  const { sceneIndex, actor, rig, foot } = parts;
  const globalStart = actor.voiceMouth?.length ? sceneStart(project, sceneIndex) : 0;
  const frame = sceneFramesAt(project, scene, seconds, globalStart).get(actorId);
  if (!frame || !(frame.scale > 0)) return undefined;
  const { x, y } = puppetFootSoleAt(rig, actor, frame, foot);
  return Number.isFinite(x) && x >= 0 && x <= 800 &&
    Number.isFinite(y) && y >= 0 && y <= 450 ? { x, y } : undefined;
}

/** The flat reference retained for saved #192 scenes and callers. */
export function sceneFootGroundAt(project: Project, scene: Scene, actorId: string,
  seconds: number, side: FootSide): number | undefined {
  return sceneFootGroundPointAt(project, scene, actorId, seconds, side)?.y;
}

/** Review a bounded stretch of any two-foot puppet's actual Stage motion. */
export function sceneFootTravel(project: Project, scene: Scene, actorId: string,
  fromSeconds: number, side: FootSide): (FootTravelReview & {
    start: number; end: number; paintedFoot: boolean; markedSole: boolean;
    possibleDepth: FootDepthFinding[]; possibleGroundDepth: FootDepthFinding[];
  }) | undefined {
  const parts = footParts(project, scene, actorId, side);
  if (!parts || !Number.isFinite(fromSeconds) || !(scene.duration >= 1 / 24)) return undefined;
  const { sceneIndex, actor, rig, feet, foot } = parts;

  const start = Math.max(0, Math.min(fromSeconds, Math.max(0, scene.duration - 3)));
  const end = Math.min(scene.duration, start + 3);
  const lastIndex = Math.ceil((end - start) * 24 - 1e-9);
  const points: FootTravelReview["points"] = [], nearFloor: boolean[] = [], upright: boolean[] = [];
  const globalStart = actor.voiceMouth?.length ? sceneStart(project, sceneIndex) : 0;
  for (let index = 0; index <= lastIndex; index++) {
    const seconds = index === lastIndex ? end : Math.min(end, start + index / 24);
    const frame = sceneFramesAt(project, scene, seconds, globalStart).get(actorId);
    if (!frame || !(frame.scale > 0)) return undefined;
    // This follows the actor and neutral rig. It is not a scenery-floor or
    // collision measurement; transparent picture feet use their part box.
    const neutral = { ...frame, joints: {} };
    const floor = Math.max(...feet.map(part => puppetFootSoleAt(rig, actor, neutral, part).y));
    const sole = puppetFootSoleAt(rig, actor, frame, foot);
    if (![floor, sole.x, sole.y].every(Number.isFinite)) return undefined;
    const floorGap = floor - sole.y;
    points.push({ index, seconds, x: sole.x, y: sole.y, floorGap });
    nearFloor.push(Math.abs(frame.rotation) <= 8 && Math.abs(floorGap) <= 4);
    upright.push(Math.abs(frame.rotation) <= 8);
  }
  return { side, start, end, paintedFoot: !!foot.assetId,
    markedSole: foot.soleX !== undefined && foot.soleY !== undefined, points,
    possibleSlides: possibleFootTravel(points, nearFloor),
    possibleDepth: possibleFootDepth(points, upright),
    possibleGroundDepth: scene.footGroundY === undefined ? [] :
      possibleFootDepth(points, upright, point => sceneGroundYAt(scene, point.x)) };
}
