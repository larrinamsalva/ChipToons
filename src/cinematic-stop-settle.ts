import type { ElementFrame } from "./timeline";

export interface CinematicStopSettle {
  torsoTilt: number;
  headTilt: number;
}

const none: Readonly<CinematicStopSettle> = { torsoTilt: 0, headTilt: 0 };
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/** Add a brief, restrained body/head counter-action when the CREATOR'S
 * actual translation slows down. This is not a physics simulation or
 * a new keyframe. It samples the same deterministic authored timeline
 * that editor, player, interactions and export already share.
 *
 * Scene boundaries, stationary actors and constant-speed walking get
 * no extra stop reaction. It never displaces a foot or hand anchor on
 * its own; the caller applies the small rotation to the shared frame.
 */
export function cinematicStopSettleAt(
  time: number,
  duration: number,
  sample: (time: number) => Pick<ElementFrame, "x" | "y">,
): CinematicStopSettle {
  if (!Number.isFinite(time) || !Number.isFinite(duration) ||
      time < 0.6 || time >= duration || duration <= 0.75)
    return none;

  const velocity = (a: number, b: number) => {
    if (b - a <= 0.001) return { x: 0, y: 0 };
    const before = sample(a), after = sample(b);
    return { x: (after.x - before.x) / (b - a),
      y: (after.y - before.y) / (b - a) };
  };
  // The older window carries the walk's momentum; the immediate
  // window describes where the artist has actually settled. The
  // difference fades away naturally after the last moving key.
  const past = velocity(Math.max(0, time - 0.55), Math.max(0, time - 0.22));
  const now = velocity(Math.max(0, time - 0.05), Math.min(duration, time + 0.05));
  const pastSpeed = Math.hypot(past.x, past.y);
  const nowSpeed = Math.hypot(now.x, now.y);
  const deceleration = clamp((pastSpeed - nowSpeed) / 55, 0, 1);
  const direction = clamp(past.x / 60, -1, 1);
  const torsoTilt = direction * deceleration * 1.1;
  return { torsoTilt, headTilt: -torsoTilt * 1.5 };
}
