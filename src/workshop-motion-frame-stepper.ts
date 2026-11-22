import type { Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
import { workshopMotionFilmstrip } from "./workshop-motion-filmstrip";

/** The inspection grid is 24 fps; it does not change export frame rates. */
export const WORKSHOP_INSPECTION_FPS = 24;

export interface WorkshopMotionInspectionFrame {
  /** Zero-based inspection frame, including both existing saved endpoints. */
  index: number;
  /** Zero-based index of the last inspectable frame. */
  lastIndex: number;
  /** Actual scene-local sample time passed directly to Stage. */
  seconds: number;
  savedKeyframe: boolean;
}

/**
 * Sample the real authored Stage timeline at 24-fps positions between
 * two validated saved keyframes. The final sample is the exact end pose,
 * even when the interval is not an integral multiple of 1/24 second.
 *
 * This is a read-only inspection grid, NOT an edit, export, or generated
 * in-between frame sequence. It never changes authored motion or its keys.
 */
export function workshopMotionInspectionFrame(
  scene: Scene,
  actorId: string,
  step: WorkshopMotionStep | undefined,
  requestedIndex: number,
): WorkshopMotionInspectionFrame | undefined {
  if (!Number.isFinite(requestedIndex) || !step ||
      workshopMotionFilmstrip(scene, actorId, step).length !== 3)
    return undefined;
  const from = step.from.seconds;
  const to = step.to.seconds;
  const durationFrames = (to - from) * WORKSHOP_INSPECTION_FPS;
  if (!Number.isFinite(durationFrames) || durationFrames <= 0)
    return undefined;
  const lastIndex = Math.ceil(durationFrames - 1e-9);
  const index = Math.max(0, Math.min(lastIndex, Math.trunc(requestedIndex)));
  const time = index === lastIndex
    ? to
    : Math.min(to, from + index / WORKSHOP_INSPECTION_FPS);
  const seconds = Math.round(time * 1_000_000) / 1_000_000;
  const keys = scene.elements.find(element => element.id === actorId)?.animation?.keyframes;
  return {
    index,
    lastIndex,
    seconds,
    savedKeyframe: !!keys?.some(key => Math.abs(key.time - seconds) <= 0.0005),
  };
}
