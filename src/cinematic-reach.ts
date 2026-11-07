import type { SceneElement } from "./model";
import type { ElementFrame } from "./timeline";
import type { Point } from "./interaction-model";
import { puppetTransforms } from "./puppet-model";
import type { Joint, PuppetPart, PuppetRig } from "./puppet-model";

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const wrapped = (angle: number) => ((angle + 540) % 360) - 180;

/**
 * Aim an *existing* free upper arm toward an interaction target, without
 * teleporting the hand or replacing any saved joint/keyframe.
 *
 * The normal interaction engine remains the sole source for prop attachment,
 * hand-off, painting order and release. Its eased strength controls the blend,
 * making approach and departure smooth in preview AND exported video.
 *
 * Returns undefined for missing/illustrated rigs, distant objects or invalid
 * geometry; callers retain the previous hand-gesture fallback.
 */
export function cinematicReachJoint(
  rig: PuppetRig,
  actor: SceneElement,
  frame: ElementFrame,
  upper: PuppetPart,
  target: Point,
  strength: number,
): Joint | undefined {
  if (upper.role !== "leftArm" && upper.role !== "rightArm" ||
      upper.assetId || !Number.isFinite(frame.scale) ||
      Math.abs(frame.scale) < 0.001 || !Number.isFinite(frame.rotation) ||
      !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;

  const index = rig.parts.indexOf(upper);
  if (index < 0) return;
  const shoulder = puppetTransforms(rig, frame.joints)[index];
  if (!shoulder) return;

  // Undo the same stage translation, rotation, scale and flips as stagePoint.
  const dx = target.x - frame.x, dy = target.y - frame.y;
  const c = Math.cos(frame.rotation * RAD), s = Math.sin(frame.rotation * RAD);
  const local = {
    x: (dx * c + dy * s) / (frame.scale * (actor.flip ? -1 : 1)),
    y: (-dx * s + dy * c) / (frame.scale * (actor.flipY ? -1 : 1)),
  };
  const reachX = local.x - shoulder.x, reachY = local.y - shoulder.y;
  const distance = Math.hypot(reachX, reachY);
  // A shoulder cannot reach a prop on the far side of the stage. Keeping the
  // legacy stylized gesture avoids pretending to solve impossible geometry.
  if (!Number.isFinite(distance) || distance < 12 || distance > 195) return;

  const tipX = -upper.pivotX;
  const tipY = upper.height / 2 - upper.pivotY;
  if (Math.hypot(tipX, tipY) < 0.01) return;

  const targetAngle = Math.atan2(reachY, reachX) * DEG;
  const originalAngle = shoulder.angle + Math.atan2(tipY, tipX) * DEG;
  const correction = clamp(wrapped(targetAngle - originalAngle), -62, 62);
  const amount = clamp(strength, 0, 1);
  // Normalize signed zero so no-motion frames compare and serialize consistently.
  return { x: 0, y: 0, angle: amount === 0 ? 0 : correction * amount };
}
