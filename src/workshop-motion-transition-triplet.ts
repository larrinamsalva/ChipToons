import type { Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
import type { WorkshopRotationRateChange } from "./workshop-rate-change-finder";
import {
  workshopMotionInspectionFrame,
  type WorkshopMotionInspectionFrame,
} from "./workshop-motion-frame-stepper";

export interface WorkshopMotionTransitionTriplet {
  before: WorkshopMotionInspectionFrame;
  middle: WorkshopMotionInspectionFrame;
  after: WorkshopMotionInspectionFrame;
}

/**
 * Return three *existing Stage inspection samples* around a recorded
 * joint-rate transition. No authored frames, keyframes or new motion.
 *
 * The selected rate-change finding spans two adjacent timing intervals:
 * (before -> middle) and (middle -> after). The middle is the shared
 * genuine 24-fps Stage sample. Endpoints use actual saved keyframes.
 */
export function workshopMotionTransitionTriplet(
  scene: Scene,
  actorId: string,
  step: WorkshopMotionStep | undefined,
  change: WorkshopRotationRateChange | undefined,
): WorkshopMotionTransitionTriplet | undefined {
  if (!change || !Number.isInteger(change.sharedFrameIndex) ||
    !Number.isInteger(change.afterFrameIndex) ||
    change.sharedFrameIndex < 1 ||
    change.afterFrameIndex !== change.sharedFrameIndex + 1 ||
    !Number.isFinite(change.seconds)) return undefined;

  const before = workshopMotionInspectionFrame(
    scene, actorId, step, change.sharedFrameIndex - 1);
  const middle = workshopMotionInspectionFrame(
    scene, actorId, step, change.sharedFrameIndex);
  const after = workshopMotionInspectionFrame(
    scene, actorId, step, change.afterFrameIndex);
  if (!before || !middle || !after ||
    before.index !== change.sharedFrameIndex - 1 ||
    middle.index !== change.sharedFrameIndex ||
    after.index !== change.afterFrameIndex ||
    !Number.isFinite(before.seconds) ||
    !Number.isFinite(middle.seconds) ||
    !Number.isFinite(after.seconds) ||
    !(before.seconds < middle.seconds && middle.seconds < after.seconds) ||
    Math.abs(middle.seconds - change.seconds) > 0.000001) {
    return undefined;
  }

  return { before, middle, after };
}
