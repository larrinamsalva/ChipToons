import type { Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
import { workshopMotionFilmstrip } from "./workshop-motion-filmstrip";

export interface WorkshopMotionScrubSample {
  /** Position within the selected real saved motion step, 0–100%. */
  percent: number;
  /** Scene-local time for the genuine Stage renderer. */
  seconds: number;
  /** True only when this exact time has an existing creator-owned key. */
  savedKeyframe: boolean;
}

/**
 * Read-only sample time inside a validated original motion step.
 * A sample does not create a keyframe: the real Stage timeline performs
 * its normal interpolation at the requested intermediate time.
 */
export function workshopMotionScrubSample(
  scene: Scene,
  actorId: string,
  step: WorkshopMotionStep | undefined,
  requestedPercent: number,
): WorkshopMotionScrubSample | undefined {
  if (!Number.isFinite(requestedPercent)) return undefined;
  // Reuse the exact saved-endpoint validation from the three-frame filmstrip.
  if (!workshopMotionFilmstrip(scene, actorId, step).length || !step) return undefined;
  const percent = Math.min(100, Math.max(0, Math.round(requestedPercent)));
  const seconds = Math.round(
    (step.from.seconds + (step.to.seconds - step.from.seconds) * percent / 100) * 1000,
  ) / 1000;
  const keys = scene.elements.find(element => element.id === actorId)?.animation?.keyframes;
  return {
    percent,
    seconds,
    savedKeyframe: !!keys?.some(frame => Math.abs(frame.time - seconds) < .001),
  };
}
