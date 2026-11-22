import type { Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
import { workshopSeatingReviewMoments } from "./workshop-seating-review";
import {
  workshopMotionInspectionFrame,
  type WorkshopMotionInspectionFrame,
} from "./workshop-motion-frame-stepper";

export interface WorkshopAdjacentFramePair {
  before: WorkshopMotionInspectionFrame;
  after: WorkshopMotionInspectionFrame;
  /** Actual spacing, including the potentially shorter final interval. */
  spacingSeconds: number;
}

/**
 * Read-only comparison of two neighboring real Stage inspection samples.
 * At the first frame compare first → second; otherwise compare the
 * previous sample → the selected sample. Never invent saved keyframes.
 */
export function workshopAdjacentFramePair(
  scene: Scene,
  actorId: string,
  step: WorkshopMotionStep | undefined,
  selectedIndex: number,
): WorkshopAdjacentFramePair | undefined {
  if (!Number.isFinite(selectedIndex) || !step) return undefined;
  // A saved key inside the animation is not necessarily an endpoint of
  // the SELECTED recorded movement. Verify the original adjacent review
  // moments as well as the true keyframe times before displaying a pair.
  const moments = workshopSeatingReviewMoments(scene, actorId);
  const recordedStep = moments.slice(1).some((to, index) => {
    const from = moments[index];
    return step.id === `${from.id}-to-${to.id}` &&
      step.from.id === from.id && step.to.id === to.id &&
      Math.abs(step.from.seconds - from.seconds) < 0.001 &&
      Math.abs(step.to.seconds - to.seconds) < 0.001;
  });
  if (!recordedStep) return undefined;
  const current = workshopMotionInspectionFrame(scene, actorId, step, selectedIndex);
  if (!current || current.lastIndex < 1) return undefined;
  const beforeIndex = current.index === 0 ? 0 : current.index - 1;
  const afterIndex = current.index === 0 ? 1 : current.index;
  const before = workshopMotionInspectionFrame(scene, actorId, step, beforeIndex);
  const after = workshopMotionInspectionFrame(scene, actorId, step, afterIndex);
  if (!before || !after || !(after.seconds > before.seconds)) return undefined;
  return {
    before,
    after,
    spacingSeconds: Math.round((after.seconds - before.seconds) * 1_000_000) / 1_000_000,
  };
}
