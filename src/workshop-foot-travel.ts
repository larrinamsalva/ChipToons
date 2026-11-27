import type { Project, Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
import { resolvedCharacter } from "./library";
import { puppetFootSoleAt } from "./cinematic-gait";
import { sceneFramesAt, sceneStart } from "./timeline";
import { workshopAdjacentFramePair } from "./workshop-adjacent-frame-compare";
import { workshopMotionInspectionFrame } from "./workshop-motion-frame-stepper";

export type FootSide = "left" | "right";
export interface FootTravelPoint {
  index: number;
  seconds: number;
  x: number;
  y: number;
  /** Positive above the estimated neutral-pose floor line. */
  floorGap: number;
}
export interface FootTravelFinding {
  beforeIndex: number;
  afterIndex: number;
  seconds: number;
  horizontalPixels: number;
}
export interface FootTravelReview {
  side: FootSide;
  points: FootTravelPoint[];
  possibleSlides: FootTravelFinding[];
}

export function possibleFootTravel(points: FootTravelPoint[], nearFloor: boolean[]): FootTravelFinding[] {
  const findings: FootTravelFinding[] = [];
  for (let index = 1; index < points.length; index++) {
    const before = points[index - 1], after = points[index];
    const horizontalPixels = Math.abs(after.x - before.x);
    if (!nearFloor[index - 1] || !nearFloor[index] ||
        horizontalPixels < 1.5 || Math.abs(after.y - before.y) > 2) continue;
    findings.push({ beforeIndex: before.index, afterIndex: after.index,
      seconds: after.seconds, horizontalPixels });
  }
  findings.sort((a, b) => b.horizontalPixels - a.horizontalPixels || a.beforeIndex - b.beforeIndex);
  return findings.slice(0, 5);
}

/**
 * Read-only Stage-space sole trajectory for one original recorded step.
 * The floor estimate follows the rig's neutral feet, not scene collision
 * geometry. Near-floor lateral travel is a review prompt, not proof of slip.
 */
export function workshopFootTravel(project: Project, scene: Scene, actorId: string,
  step: WorkshopMotionStep | undefined, side: FootSide): FootTravelReview | undefined {
  const first = workshopAdjacentFramePair(scene, actorId, step, 0);
  if (!first || (side !== "left" && side !== "right")) return undefined;
  const last = first.after.lastIndex;
  if (last < 1 || last > 720) return undefined;
  const actor = scene.elements.find(element => element.id === actorId);
  const rig = actor && resolvedCharacter(project, actor)?.puppet;
  const feet = rig?.parts.filter(part =>
    (part.role === "leftFoot" || part.role === "rightFoot") && !part.assetId &&
    rig.parts.some(parent => parent.id === part.parentId));
  const foot = feet?.find(part => part.role === `${side}Foot`);
  if (!actor || !rig || !foot || feet?.length !== 2 || actor.flipY) return undefined;
  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  const globalStart = sceneIndex >= 0 && actor.voiceMouth?.length ? sceneStart(project, sceneIndex) : 0;
  const points: FootTravelPoint[] = [];
  const nearFloor: boolean[] = [];
  for (let index = 0; index <= last; index++) {
    const sample = workshopMotionInspectionFrame(scene, actorId, step, index);
    if (!sample) return undefined;
    const frame = sceneFramesAt(project, scene, sample.seconds, globalStart).get(actorId);
    if (!frame || !(frame.scale > 0)) return undefined;
    const rest = { ...frame, joints: {} };
    const floor = Math.max(...feet.map(item => puppetFootSoleAt(rig, actor, rest, item).y));
    const sole = puppetFootSoleAt(rig, actor, frame, foot);
    if (![floor, sole.x, sole.y].every(Number.isFinite)) return undefined;
    const floorGap = floor - sole.y;
    points.push({ index, seconds: sample.seconds, x: sole.x, y: sole.y, floorGap });
    nearFloor.push(Math.abs(frame.rotation) <= 8 && Math.abs(floorGap) <= 4);
  }
  return { side, points, possibleSlides: possibleFootTravel(points, nearFloor) };
}
