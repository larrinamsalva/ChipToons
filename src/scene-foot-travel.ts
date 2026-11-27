import type { Project, Scene } from "./model";
import { resolvedCharacter } from "./library";
import { puppetFootSoleAt } from "./cinematic-gait";
import { sceneFramesAt, sceneStart } from "./timeline";
import { possibleFootTravel } from "./workshop-foot-travel";
import type { FootSide, FootTravelReview } from "./workshop-foot-travel";

/** Review a bounded stretch of any two-foot puppet's actual Stage motion. */
export function sceneFootTravel(project: Project, scene: Scene, actorId: string,
  fromSeconds: number, side: FootSide): (FootTravelReview & {
    start: number; end: number; paintedFoot: boolean; markedSole: boolean;
  }) | undefined {
  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  const actor = scene.elements.find(item => item.id === actorId);
  const rig = actor && resolvedCharacter(project, actor)?.puppet;
  if (sceneIndex < 0 || !actor || !rig || actor.flipY ||
      (side !== "left" && side !== "right") || !Number.isFinite(fromSeconds) ||
      !(scene.duration >= 1 / 24)) return undefined;
  const feet = rig.parts.filter(part =>
    (part.role === "leftFoot" || part.role === "rightFoot") &&
    rig.parts.some(parent => parent.id === part.parentId));
  const foot = feet.find(part => part.role === `${side}Foot`);
  if (feet.length !== 2 || !foot || feet[0].role === feet[1].role) return undefined;

  const start = Math.max(0, Math.min(fromSeconds, Math.max(0, scene.duration - 3)));
  const end = Math.min(scene.duration, start + 3);
  const lastIndex = Math.ceil((end - start) * 24 - 1e-9);
  const points: FootTravelReview["points"] = [], nearFloor: boolean[] = [];
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
  }
  return { side, start, end, paintedFoot: !!foot.assetId,
    markedSole: foot.soleX !== undefined && foot.soleY !== undefined, points,
    possibleSlides: possibleFootTravel(points, nearFloor) };
}
