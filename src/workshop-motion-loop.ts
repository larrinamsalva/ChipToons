import type { Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
import {
  workshopMotionScrubSample,
  type WorkshopMotionScrubSample,
} from "./workshop-motion-scrub";

export type WorkshopMotionLoopSpeed = 0.5 | 1 | 2;

/**
 * Repeatedly sample the existing Stage timeline between two validated saved
 * keyframes. The preview has its own clock; it never changes the real
 * scene playhead, keyframes, media timeline or exported movie.
 */
export function workshopMotionLoopFrame(
  scene: Scene,
  actorId: string,
  step: WorkshopMotionStep | undefined,
  startPercent: number,
  elapsedMilliseconds: number,
  speed: WorkshopMotionLoopSpeed,
): WorkshopMotionScrubSample | undefined {
  if (!Number.isFinite(startPercent) || !Number.isFinite(elapsedMilliseconds) ||
      elapsedMilliseconds < 0 || ![0.5, 1, 2].includes(speed))
    return undefined;
  const start = workshopMotionScrubSample(scene, actorId, step, startPercent);
  if (!start || !step) return undefined;
  const durationMilliseconds = (step.to.seconds - step.from.seconds) * 1000;
  if (!Number.isFinite(durationMilliseconds) || !(durationMilliseconds > 0))
    return undefined;

  // The ending pose intentionally loops back to the initial starting pose.
  // Rounding to whole percentages matches the existing scrubber granularity.
  const position = (start.percent + elapsedMilliseconds * speed /
    durationMilliseconds * 100) % 100;
  const percent = Math.round(position) % 100;
  return workshopMotionScrubSample(scene, actorId, step, percent);
}
