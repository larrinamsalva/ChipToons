import type { Project, Scene } from "./model";
import { validateProject } from "./model";
import { resolvedCharacter } from "./library";
import { puppetFootSoleAt } from "./cinematic-gait";
import { MAX_TRACK_KEYS } from "./animation-model";
import { neutralJoint, puppetTransforms } from "./puppet-model";
import { putElementKey, roundTime, sceneFramesAt, sceneStart } from "./timeline";
import { sceneFootTravel } from "./scene-foot-travel";
import type { FootSide } from "./workshop-foot-travel";

const radians = (angle: number) => angle * Math.PI / 180;
const rotate = (x: number, y: number, angle: number) => ({
  x: x * Math.cos(radians(angle)) - y * Math.sin(radians(angle)),
  y: x * Math.sin(radians(angle)) + y * Math.cos(radians(angle)),
});

/** Add one editable foot key at a reviewed frame; never replace an authored key. */
export function alignPictureFootFrame(project: Project, scene: Scene, actorId: string,
  windowStart: number, side: FootSide, afterIndex: number): Scene | undefined {
  return alignPictureFootAtTarget(project, scene, actorId, windowStart, side, afterIndex);
}

function alignPictureFootAtTarget(project: Project, scene: Scene, actorId: string,
  windowStart: number, side: FootSide, afterIndex: number,
  heldX?: number): Scene | undefined {
  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  const actor = scene.elements.find(item => item.id === actorId);
  const rig = actor && resolvedCharacter(project, actor)?.puppet;
  const foot = rig?.parts.find(part => part.role === `${side}Foot`);
  const parent = rig?.parts.find(part => part.id === foot?.parentId);
  if (sceneIndex < 0 || !actor || !rig || !foot?.assetId || !parent ||
      !["leftLeg", "rightLeg", "leftShin", "rightShin"].includes(parent.role) ||
      !actor.animation || actor.animation.keyframes.length < 2 ||
      actor.animation.keyframes.length >= MAX_TRACK_KEYS ||
      actor.animation.idle !== "none" || actor.motion !== "still" ||
      !Number.isInteger(afterIndex)) return undefined;

  const review = sceneFootTravel(project, scene, actorId, windowStart, side);
  const finding = review?.possibleSlides.find(item => item.afterIndex === afterIndex);
  if (!review || (heldX === undefined && !finding) ||
      afterIndex < 1 || afterIndex >= review.points.length) return undefined;
  const after = review.points[afterIndex];
  const targetX = heldX ?? review.points[afterIndex - 1].x;
  if (!Number.isFinite(targetX)) return undefined;
  const keyTime = roundTime(after.seconds);
  const keys = actor.animation.keyframes;
  const left = keys.filter(key => key.time < keyTime).at(-1);
  const right = keys.find(key => key.time > keyTime);
  // A linear interval can be split without changing the actor's original
  // path. Timed gestures/mouth cycles restart at keys, so leave those alone.
  if (!left || !right || right.easing !== "linear" ||
      left.gesture !== "none" || right.gesture !== "none" ||
      left.mouth === "talking" || right.mouth === "talking") return undefined;
  if (actor.animation.keyframes.some(key => Math.abs(key.time - keyTime) < 0.001))
    return undefined;
  const dx = targetX - after.x;
  if (Math.abs(dx) > 12 || (heldX === undefined && Math.abs(dx) < 1.5)) return undefined;
  const globalStart = actor.voiceMouth?.length ? sceneStart(project, sceneIndex) : 0;
  const frame = sceneFramesAt(project, scene, after.seconds, globalStart).get(actorId);
  if (!frame || !(frame.scale > 0)) return undefined;
  // Invert actor rotation/flip and parent rotation before changing just the
  // selected foot's local joint offset. Its current height is untouched.
  const stageLocal = rotate(dx, 0, -frame.rotation);
  const local = {
    x: stageLocal.x / frame.scale * (actor.flip ? -1 : 1),
    y: stageLocal.y / frame.scale,
  };
  const parentWorld = puppetTransforms(rig, frame.joints)[rig.parts.indexOf(parent)];
  const offset = rotate(local.x, local.y, -parentWorld.angle);
  // Sample at the stored millisecond timestamp. Sampling at the unrounded
  // display frame would subtly bend even a linear actor path after insertion.
  const animation = putElementKey(actor, keyTime, scene.duration);
  const key = animation.keyframes.find(item => item.time === keyTime);
  if (!key) return undefined;
  const originalJoint = key.joints?.[foot.id] ?? neutralJoint;
  const adjusted = { ...originalJoint,
    x: originalJoint.x + offset.x, y: originalJoint.y + offset.y };
  if (![adjusted.x, adjusted.y].every(value => Number.isFinite(value) && Math.abs(value) <= 160))
    return undefined;
  const corrected = { ...actor, animation: { ...animation,
    keyframes: animation.keyframes.map(item => item.id === key.id ? {
      ...item, easing: "linear" as const,
      joints: { ...item.joints, [foot.id]: adjusted },
    } : item),
  } };
  const next: Scene = { ...scene, elements: scene.elements.map(item =>
    item.id === actorId ? corrected : item) };
  const nextProject = { ...project, scenes: project.scenes.map((item, index) =>
    index === sceneIndex ? next : item) };
  try { validateProject(nextProject); } catch { return undefined; }

  // Reject edits if another overlay or a rounded key time would stop the
  // recorded Stage from landing on the requested X or shift its Y/other foot.
  const result = sceneFramesAt(nextProject, next, after.seconds, globalStart).get(actorId);
  if (!result) return undefined;
  const planted = puppetFootSoleAt(rig, actor, result, foot);
  const other = rig.parts.find(item => item.role === `${side === "left" ? "right" : "left"}Foot`);
  const priorOther = other && puppetFootSoleAt(rig, actor, frame, other);
  const nextOther = other && puppetFootSoleAt(rig, actor, result, other);
  if (Math.abs(planted.x - targetX) > 0.15 || Math.abs(planted.y - after.y) > 0.15 ||
      !priorOther || !nextOther ||
      Math.hypot(nextOther.x - priorOther.x, nextOther.y - priorOther.y) > 0.15)
    return undefined;
  return next;
}

/** Hold the same measured shoe position for three adjacent review samples. */
export function holdPictureFootForThreeFrames(project: Project, scene: Scene, actorId: string,
  windowStart: number, side: FootSide, afterIndex: number): Scene | undefined {
  const review = sceneFootTravel(project, scene, actorId, windowStart, side);
  const actor = scene.elements.find(item => item.id === actorId);
  if (!review || !actor?.animation || !Number.isInteger(afterIndex) ||
      !review.possibleSlides.some(item => item.afterIndex === afterIndex) ||
      afterIndex + 2 >= review.points.length ||
      actor.animation.keyframes.length > MAX_TRACK_KEYS - 3) return undefined;
  const target = review.points[afterIndex - 1];
  for (let index = afterIndex; index <= afterIndex + 2; index++) {
    const point = review.points[index];
    if (Math.abs(point.x - target.x) > 12 ||
        Math.abs(point.y - target.y) > 2 || Math.abs(point.floorGap) > 4)
      return undefined;
  }
  let current = scene;
  let currentProject = project;
  for (let index = afterIndex; index <= afterIndex + 2; index++) {
    const next = alignPictureFootAtTarget(currentProject, current, actorId,
      windowStart, side, index, target.x);
    if (!next) return undefined;
    current = next;
    currentProject = { ...project, scenes: project.scenes.map(item =>
      item.id === scene.id ? current : item) };
  }
  const held = sceneFootTravel(currentProject, current, actorId, windowStart, side);
  if (!held || [afterIndex, afterIndex + 1, afterIndex + 2].some(index =>
    Math.abs(held.points[index].x - target.x) > 0.15 ||
    Math.abs(held.points[index].y - review.points[index].y) > 0.15)) return undefined;
  return current;
}
