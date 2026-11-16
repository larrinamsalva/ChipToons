import type { ElementFrame } from "./timeline";

export interface CinematicTurnAnticipation {
  /** Tiny counterbalance opposite the upcoming horizontal direction. */
  torsoTilt: number;
  /** A subtle leading head tilt toward the actual next direction. */
  headTilt: number;
}
const still: Readonly<CinematicTurnAnticipation> = { torsoTilt: 0, headTilt: 0 };
const clamp = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, n));
const smooth = (n: number) => {
  const t = clamp(n, 0, 1);
  return t * t * (3 - 2 * t);
};

/** A small visual preparation for a REAL direction reversal in the creator's
 * existing horizontal motion path. It samples fixed intervals either side
 * of scene time, never writes keyframes or invents a new travel path.
 *
 * Only a clear moving-right -> moving-left (or reverse) change triggers it.
 * Walking straight, slowing to a stop, walking vertically or standing still
 * continue to use the existing motion system. Results are deterministic.
 */
export function cinematicTurnAnticipationAt(
  time: number,
  duration: number,
  sample: (time: number) => Pick<ElementFrame, "x" | "y">,
): CinematicTurnAnticipation {
  if (!Number.isFinite(time) || !Number.isFinite(duration) ||
      time < 0.38 || time >= duration - 0.38) return still;
  const vx = (start: number, end: number) => {
    const a = sample(clamp(start, 0, duration));
    const b = sample(clamp(end, 0, duration));
    return (b.x - a.x) / (end - start);
  };
  // Leave a narrow margin around the current sample, so a keyframe
  // reversal gives an eased counter-lean before and after that moment.
  const incoming = vx(time - 0.34, time - 0.1);
  const outgoing = vx(time + 0.1, time + 0.34);
  if (!Number.isFinite(incoming) || !Number.isFinite(outgoing) ||
      incoming * outgoing >= 0 ||
      Math.abs(incoming) < 5 || Math.abs(outgoing) < 5)
    return still;
  const weight = smooth((Math.min(Math.abs(incoming), Math.abs(outgoing)) - 5) / 50);
  if (weight < 0.001) return still;
  const direction = Math.sign(outgoing);
  return {
    torsoTilt: -direction * 0.9 * weight,
    headTilt: direction * 1.35 * weight,
  };
}
