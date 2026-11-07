import { solveTwoBone } from "./cinematic-gait";
import type { Grip, Point } from "./interaction-model";
import type { SceneElement } from "./model";
import { neutralJoint, puppetTransforms } from "./puppet-model";
import type { JointSnapshot, PuppetPart, PuppetRig } from "./puppet-model";
import type { ElementFrame } from "./timeline";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const wrapped = (angle: number) => ((angle + 540) % 360) - 180;

/**
 * Deterministic 2-joint (shoulder/elbow) reaching for an existing vector rig
 * with a real parented forearm. No saved keys, schema changes, timers or
 * imaginary limbs: incomplete or authored joints use the existing fallback.
 *
 * Work in local puppet coordinates so mirrors, stage rotation and scale
 * preserve exactly the same end-effector alignment.
 */
export function cinematicArmIK(
  rig: PuppetRig,
  actor: SceneElement,
  frame: ElementFrame,
  upper: PuppetPart,
  grip: Grip,
  stageTarget: Point,
  weight: number,
): JointSnapshot | undefined {
  const side = upper.role === "leftArm" ? "left" :
    upper.role === "rightArm" ? "right" : undefined;
  if (!side || grip.hand !== side || upper.assetId ||
      !Number.isFinite(frame.scale) || Math.abs(frame.scale) < 0.001 ||
      !Number.isFinite(frame.rotation) || !Number.isFinite(frame.x) ||
      !Number.isFinite(frame.y) || !Number.isFinite(stageTarget.x) ||
      !Number.isFinite(stageTarget.y) || !Number.isFinite(weight)) return;

  const elbow = rig.parts.find(p => p.role === `${side}Forearm` && p.parentId === upper.id);
  const hand = elbow && rig.parts.find(p => p.role === `${side}Hand` && p.parentId === elbow.id);
  if (!elbow || elbow.assetId || hand?.assetId ||
      frame.joints?.[upper.id] || frame.joints?.[elbow.id] ||
      (hand && frame.joints?.[hand.id])) return;

  const upperLength = Math.hypot(elbow.x, elbow.y);
  // Match handAt's actual grip anchor, including each part's pivot.
  const tip = hand
    ? { x: hand.x - hand.pivotX, y: hand.y - hand.pivotY }
    : { x: -elbow.pivotX, y: elbow.height / 2 - elbow.pivotY };
  const lowerLength = Math.hypot(tip.x, tip.y);
  if (upperLength < 9 || lowerLength < 9) return;

  const turned = { x: stageTarget.x - frame.x, y: stageTarget.y - frame.y };
  const c = Math.cos(frame.rotation * RAD), s = Math.sin(frame.rotation * RAD);
  const target = {
    x: (turned.x * c + turned.y * s) /
      (frame.scale * (actor.flip ? -1 : 1)) - grip.x,
    y: (-turned.x * s + turned.y * c) /
      (frame.scale * (actor.flipY ? -1 : 1)) - grip.y,
  };
  const pose = puppetTransforms(rig, frame.joints)[rig.parts.indexOf(upper)];
  if (!pose) return;
  const distance = Math.hypot(target.x - pose.x, target.y - pose.y);
  // Never stretch a limb to an impossible point or force it to collapse.
  if (distance < Math.abs(upperLength - lowerLength) + 1 ||
      distance > upperLength + lowerLength - 1) return;

  const solution = solveTwoBone(pose, target, upperLength, lowerLength,
    side === "left" ? -1 : 1);
  if (!solution) return;
  const originalShoulder = pose.angle;
  const upperAxis = Math.atan2(elbow.y, elbow.x) * DEG;
  const lowerAxis = Math.atan2(tip.y, tip.x) * DEG;
  const shoulderTurn = wrapped(solution.upperAngle - upperAxis - originalShoulder);
  const elbowTurn = wrapped(solution.lowerAngle - lowerAxis -
    (originalShoulder + shoulderTurn));
  // Avoid elbows snapping through the torso or suddenly reversing.
  if (Math.abs(shoulderTurn) > 105 || Math.abs(elbowTurn) > 155) return;
  const eased = clamp(weight, 0, 1);
  return {
    [upper.id]: { ...neutralJoint, angle: eased === 0 ? 0 : shoulderTurn * eased },
    [elbow.id]: { ...neutralJoint, angle: eased === 0 ? 0 : elbowTurn * eased },
  };
}
