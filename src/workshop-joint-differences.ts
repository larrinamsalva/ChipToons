import type { Scene } from "./model";
import type { PuppetRig } from "./puppet-model";

/** A review-only measurement, never a transform or an animation edit. */
export interface WorkshopJointDifference {
  partId: string;
  label: string;
  role: string;
  beforeAngle: number;
  afterAngle: number;
  angleDelta: number;
  xDelta: number;
  yDelta: number;
}

/**
 * Compare the actual saved joint snapshots at two existing editor review
 * points. Missing joint keys are the canonical sparse neutral (0, 0, 0).
 * Only changes above 0.1 degrees/pixels are displayed to avoid noisy UI.
 * Angles are local joint rotations, not world-space hand/foot positions.
 */
export function workshopJointDifferences(
  scene: Scene,
  actorId: string,
  rig: PuppetRig | undefined,
  beforeSeconds: number,
  afterSeconds: number,
): WorkshopJointDifference[] {
  if (!rig?.parts.length || !Number.isFinite(beforeSeconds) ||
      !Number.isFinite(afterSeconds)) return [];
  const actor = scene.elements.find(element => element.id === actorId);
  const frames = actor?.animation?.keyframes;
  if (!frames) return [];

  const before = frames.find(frame => Math.abs(frame.time - beforeSeconds) < 0.001);
  const after = frames.find(frame => Math.abs(frame.time - afterSeconds) < 0.001);
  if (!before || !after) return [];
  const zero = { angle: 0, x: 0, y: 0 };

  return rig.parts.flatMap(part => {
    const from = before.joints?.[part.id] ?? zero;
    const to = after.joints?.[part.id] ?? zero;
    const angleDelta = to.angle - from.angle;
    const xDelta = to.x - from.x;
    const yDelta = to.y - from.y;
    if (Math.max(Math.abs(angleDelta), Math.abs(xDelta), Math.abs(yDelta)) <= 0.1)
      return [];
    const title = part.role.replace(/([a-z])([A-Z])/g, "$1 $2");
    return [{
      partId: part.id,
      label: title.charAt(0).toUpperCase() + title.slice(1),
      role: part.role,
      beforeAngle: from.angle,
      afterAngle: to.angle,
      angleDelta,
      xDelta,
      yDelta,
    }];
  });
}
