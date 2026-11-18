import type { Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";

export interface WorkshopFilmstripFrame {
  id: "start" | "middle" | "end";
  label: "Start" | "Middle" | "End";
  seconds: number;
  /** The midpoint may be interpolated by the real Stage timeline. */
  savedKeyframe: boolean;
}

/**
 * Three read-only REAL Stage sample timestamps for a saved motion step.
 * Start/end MUST be existing keyframes. Middle is evaluated from the
 * actual animation timeline at exactly halfway, with no generated keys.
 */
export function workshopMotionFilmstrip(
  scene: Scene,
  actorId: string,
  step: WorkshopMotionStep | undefined,
): WorkshopFilmstripFrame[] {
  if (!step || !(step.to.seconds > step.from.seconds) ||
      !Number.isFinite(step.from.seconds) || !Number.isFinite(step.to.seconds))
    return [];
  const keys = scene.elements.find(item => item.id === actorId)?.animation?.keyframes;
  if (!keys?.length) return [];
  const savedAt = (seconds: number) =>
    keys.some(key => Math.abs(key.time - seconds) < 0.001);
  const from = step.from.seconds, to = step.to.seconds;
  if (!savedAt(from) || !savedAt(to)) return [];
  // Millisecond precision mirrors the Stage's existing time granularity.
  const middle = Math.round((from + to) * 500) / 1000;
  if (!(middle > from && middle < to)) return [];
  return [
    { id: "start", label: "Start", seconds: from, savedKeyframe: true },
    { id: "middle", label: "Middle", seconds: middle, savedKeyframe: savedAt(middle) },
    { id: "end", label: "End", seconds: to, savedKeyframe: true },
  ];
}
