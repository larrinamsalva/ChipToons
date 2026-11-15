import type { ElementFrame } from "./timeline";

export interface CinematicWalkAnticipation {
  torsoTilt: number;
  headTilt: number;
}

const still: Readonly<CinematicWalkAnticipation> = { torsoTilt: 0, headTilt: 0 };
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));

/**
 * Deterministic, restrained anticipation before an existing authored walk.
 *
 * Compare nearby past/present position samples with a short look-ahead:
 * only when the character is actually stationary and a horizontal walk
 * is about to start do they lean very slightly against the coming step.
 * This modifies neither the walk path nor the character's saved keyframes.
 *
 * Pure scene-local timing; no wall-clock state, animation loops, simulated
 * physics, new scene movements, auto-keyframing or sound edits.
 */
export function cinematicWalkAnticipationAt(
  time: number,
  duration: number,
  sample: (time: number) => Pick<ElementFrame, "x" | "y">,
): CinematicWalkAnticipation {
  if (!Number.isFinite(time) || !Number.isFinite(duration) ||
      time < 0.55 || time >= duration - 0.45)
    return still;
  const velocity = (a: number, b: number) => {
    const left = clamp(a, 0, duration);
    const right = clamp(b, 0, duration);
    if (right - left < 0.001) return { x: 0, y: 0 };
    const before = sample(left);
    const after = sample(right);
    return {
      x: (after.x - before.x) / (right - left),
      y: (after.y - before.y) / (right - left),
    };
  };
  const past = velocity(time - 0.48, time - 0.24);
  const present = velocity(time - 0.05, time + 0.05);
  const soon = velocity(time + 0.13, time + 0.42);
  const pastSpeed = Math.hypot(past.x, past.y);
  const presentSpeed = Math.hypot(present.x, present.y);
  const soonSpeed = Math.hypot(soon.x, soon.y);

  // No pre-lean while already walking, at a constant speed, or for
  // negligible/subpixel and purely vertical scene motion.
  if (pastSpeed > 4 || Math.abs(soon.x) < 4) return still;
  const onset = clamp((soonSpeed - Math.max(presentSpeed, pastSpeed) - 5) / 50, 0, 1);
  if (onset < 0.01) return still;
  const direction = clamp(soon.x / 60, -1, 1);
  const torsoTilt = -direction * onset * 1.0;
  return { torsoTilt, headTilt: -torsoTilt * 1.45 };
}
