import type { Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
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
  if (!Number.isFinite(selectedIndex)) return undefined;
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
