import type { Project, SceneElement } from "./model";
import { neutralJoint, puppetTransforms } from "./puppet-model";
import type { PuppetPart, PuppetRig } from "./puppet-model";
import type { ElementFrame } from "./timeline";

type Point = { x: number; y: number };
const clamp = (x: number, low: number, high: number) => Math.min(high, Math.max(low, x));
const degrees = (radians: number) => radians * 180 / Math.PI;
const radians = (angle: number) => angle * Math.PI / 180;
const rotate = (p: Point, angle: number): Point => {
  const r = radians(angle);
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r),
    y: p.x * Math.sin(r) + p.y * Math.cos(r) };
};
const normAngle = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

function toStage(element: SceneElement, frame: ElementFrame, local: Point): Point {
  const flipped = { x: local.x * (element.flip ? -1 : 1) * frame.scale,
    y: local.y * (element.flipY ? -1 : 1) * frame.scale };
  const turned = rotate(flipped, frame.rotation);
  return { x: frame.x + turned.x, y: frame.y + turned.y };
}

function fromStage(element: SceneElement, frame: ElementFrame, stage: Point): Point {
  const turned = rotate({ x: stage.x - frame.x, y: stage.y - frame.y }, -frame.rotation);
  return { x: turned.x / frame.scale * (element.flip ? -1 : 1),
    y: turned.y / frame.scale * (element.flipY ? -1 : 1) };
}

function footPoint(rig: PuppetRig, element: SceneElement, frame: ElementFrame,
  foot: PuppetPart): Point {
  const index = rig.parts.indexOf(foot);
  const joint = puppetTransforms(rig, frame.joints)[index];
  const sole = foot.height / 2 - foot.pivotY +
    (rig.costume === "workshop" && !foot.assetId ? 2 : 0);
  const tip = rotate({ x: -foot.pivotX, y: sole }, joint.angle);
  return toStage(element, frame, { x: joint.x + tip.x, y: joint.y + tip.y });
}

function gaitPeriod(element: SceneElement): number {
  // Match the creator's own alternating authored leg poses instead of forcing
  // a universal run cycle onto a slow, child-friendly walk.
  const keys = element.animation?.keyframes ?? [];
  const intervals: number[] = [];
  for (let i = 1; i < keys.length; i++) {
    const before = keys[i - 1], after = keys[i];
    const a = (before.joints?.leftLeg?.angle ?? 0) - (before.joints?.rightLeg?.angle ?? 0);
    const b = (after.joints?.leftLeg?.angle ?? 0) - (after.joints?.rightLeg?.angle ?? 0);
    if (Math.abs(a) > 12 && Math.abs(b) > 12 && a * b < 0 &&
      Math.abs(after.x - before.x) > 3 && after.time > before.time)
      intervals.push(after.time - before.time);
  }
  if (!intervals.length) return 2.6;
  intervals.sort((a, b) => a - b);
  return clamp(2 * intervals[Math.floor(intervals.length / 2)], 1.5, 4.5);
}

/** Standard planar two-bone IK, used only for rigs with a real shin joint. */
export function solveTwoBone(hip: Point, target: Point,
  upper: number, lower: number, bend: -1 | 1) {
  if (!(upper > 0 && lower > 0)) return;
  const dx = target.x - hip.x, dy = target.y - hip.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001) return;
  const reachable = clamp(distance, Math.abs(upper - lower) + 0.01, upper + lower - 0.01);
  const aim = Math.atan2(dy, dx);
  const elbow = Math.acos(clamp((upper * upper + reachable * reachable - lower * lower) /
    (2 * upper * reachable), -1, 1));
  const upperAngle = aim + bend * elbow;
  const knee = { x: hip.x + upper * Math.cos(upperAngle),
    y: hip.y + upper * Math.sin(upperAngle) };
  const endpoint = { x: hip.x + reachable * Math.cos(aim),
    y: hip.y + reachable * Math.sin(aim) };
  return { upperAngle: degrees(upperAngle),
    lowerAngle: degrees(Math.atan2(endpoint.y - knee.y, endpoint.x - knee.x)) };
}

function assistShin(rig: PuppetRig, element: SceneElement, frame: ElementFrame,
  foot: PuppetPart, target: Point, weight: number): ElementFrame {
  const shin = rig.parts.find(p => p.id === foot.parentId &&
    (p.role === "leftShin" || p.role === "rightShin"));
  const leg = shin && rig.parts.find(p => p.id === shin.parentId &&
    (p.role === "leftLeg" || p.role === "rightLeg"));
  if (!shin || !leg || !shin.parentId || !foot.parentId || foot.assetId ||
      (Math.abs(frame.joints?.[shin.id]?.angle ?? 0) > 1)) return frame;
  const poses = puppetTransforms(rig, frame.joints);
  const hip = poses[rig.parts.indexOf(leg)];
  // Aim at the center of the sole while retaining existing custom artwork.
  const sole = foot.height / 2 - foot.pivotY;
  const local = fromStage(element, frame, { x: target.x, y: target.y - sole * frame.scale });
  const upper = Math.hypot(shin.x, shin.y), lower = Math.hypot(foot.x, foot.y);
  if (upper < 8 || lower < 8) return frame;
  const solution = solveTwoBone(hip, local, upper, lower,
    leg.role === "leftLeg" ? -1 : 1);
  if (!solution) return frame;
  const desiredHip = solution.upperAngle - degrees(Math.atan2(shin.y, shin.x));
  const desiredKnee = solution.lowerAngle - desiredHip - degrees(Math.atan2(foot.y, foot.x));
  const upperJoint = frame.joints?.[leg.id] ?? neutralJoint;
  const lowerJoint = frame.joints?.[shin.id] ?? neutralJoint;
  const hipOffset = clamp(normAngle(desiredHip - hip.angle), -14, 14) * weight * 0.55;
  const kneeOffset = clamp(normAngle(desiredKnee - lowerJoint.angle), -20, 20) * weight * 0.55;
  return { ...frame, joints: { ...frame.joints,
    [leg.id]: { ...upperJoint, angle: upperJoint.angle + hipOffset },
    [shin.id]: { ...lowerJoint, angle: lowerJoint.angle + kneeOffset } } };
}

function plantFoot(rig: PuppetRig, element: SceneElement, frame: ElementFrame,
  foot: PuppetPart, target: Point, weight: number): ElementFrame {
  const parent = rig.parts.find(part => part.id === foot.parentId);
  if (!parent || !["leftLeg", "rightLeg", "leftShin", "rightShin"].includes(parent.role) ||
      foot.assetId) return frame;
  // Correct boot orientation BEFORE finding its sole contact point. Rotating
  // after planting can drop the shoe slightly through the floor and make the
  // shadow snap when the actor bobs upward.
  const footIndex = rig.parts.indexOf(foot);
  const initial = puppetTransforms(rig, frame.joints)[footIndex];
  const footJoint = frame.joints?.[foot.id] ?? neutralJoint;
  const angle = clamp(normAngle(-initial.angle -
    frame.rotation * (element.flip ? -1 : 1)), -16, 16) * weight;
  const angledFoot = { ...footJoint, angle: footJoint.angle + angle };
  const angled: ElementFrame = { ...frame, joints: { ...frame.joints, [foot.id]: angledFoot } };

  const poses = puppetTransforms(rig, angled.joints);
  const current = footPoint(rig, element, angled, foot);
  const deltaStage = { x: clamp(target.x - current.x, -19 * frame.scale, 19 * frame.scale) * weight,
    y: clamp(target.y - current.y, -13 * frame.scale, 13 * frame.scale) * weight };
  // Convert the remaining contact correction into the parent-leg frame. The
  // joint's original authored offsets still remain the baseline.
  const stageLocal = rotate(deltaStage, -frame.rotation);
  const local = { x: stageLocal.x / frame.scale * (element.flip ? -1 : 1),
    y: stageLocal.y / frame.scale * (element.flipY ? -1 : 1) };
  const parentAngle = poses[rig.parts.indexOf(parent)].angle;
  const correction = rotate(local, -parentAngle);
  return { ...angled, joints: { ...angled.joints, [foot.id]: {
    ...angledFoot, x: footJoint.x + correction.x, y: footJoint.y + correction.y } } };
}
/**
 * Deterministic opt-in walking polish. No timeline edits or stored gait state.
 * The exact final frame is shared with Stage, grounding, hand anchors and WebM.
 * Unsupported and image-backed rigs fall back to the existing animation.
 */
export function cinematicGaitAt(
  project: Pick<Project, "visualStyle" | "characters">,
  element: SceneElement,
  frame: ElementFrame,
  time: number,
  duration: number,
  calm: boolean,
  sample: (time: number) => ElementFrame,
): ElementFrame {
  if (project.visualStyle !== "storybook-cinematic" || calm || !element.characterId ||
      !(frame.scale > 0) || element.flipY) return frame;
  const rig = project.characters.find(c => c.id === element.characterId)?.puppet;
  if (!rig) return frame;
  const feet = rig.parts.filter(p => (p.role === "leftFoot" || p.role === "rightFoot") &&
    !p.assetId && rig.parts.some(parent => parent.id === p.parentId));
  if (feet.length !== 2) return frame;

  const dt = 0.16, a = sample(clamp(time - dt, 0, duration));
  const b = sample(clamp(time + dt, 0, duration));
  const seconds = clamp(time + dt, 0, duration) - clamp(time - dt, 0, duration);
  if (!(seconds > 0)) return frame;
  const speed = Math.hypot(b.x - a.x, b.y - a.y) / seconds;
  const weight = clamp((speed - 4) / 14, 0, 1);
  if (weight === 0) return frame;

  const authored = sample(clamp(time, 0, duration));
  const rest = puppetTransforms(rig);
  const soleHeights = feet.map(foot => {
    const pose = rest[rig.parts.indexOf(foot)];
    const sole = foot.height / 2 - foot.pivotY +
      (rig.costume === "workshop" ? 2 : 0);
    const tip = rotate({ x: -foot.pivotX, y: sole }, pose.angle);
    return pose.y + tip.y;
  });
  const floorY = authored.y + Math.max(...soleHeights) * authored.scale;
  const period = gaitPeriod(element);
  let result = frame;
  for (const foot of feet) {
    const offset = foot.role === "rightFoot" ? 0.5 : 0;
    const phase = time / period + offset;
    const cycle = Math.floor(phase);
    const progress = phase - cycle;
    const start = (cycle - offset) * period;
    const first = footPoint(rig, element, sample(clamp(start, 0, duration)), foot);
    const last = footPoint(rig, element, sample(clamp(start + period, 0, duration)), foot);
    const stance = progress < 0.58;
    const swing = clamp((progress - 0.58) / 0.42, 0, 1);
    const target: Point = { x: stance ? first.x : mix(first.x, last.x, smooth(swing)),
      y: floorY - (stance ? 0 : 7 * Math.sin(swing * Math.PI) * authored.scale) };
    result = assistShin(rig, element, result, foot, target, weight);
    result = plantFoot(rig, element, result, foot, target, weight);
  }
  return result;
}
