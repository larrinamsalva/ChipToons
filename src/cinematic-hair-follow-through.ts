import type { ElementFrame } from "./timeline";

export interface CinematicHairFollowThrough {
  /** Local angle of the hair drawing, not the head or eye joints. */
  angle: number;
  /** Small upward bounce within the authored walk, in puppet-local pixels. */
  lift: number;
}
const REST: Readonly<CinematicHairFollowThrough> = { angle: 0, lift: 0 };
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * Light, seekable hair follow-through for opt-in ORIGINAL workshop hairstyles.
 *
 * Only samples the author's keyframe curve. A moving body gently tips the
 * hair against horizontal travel; a turning head lets the hair catch up a
 * little later. The face, head joint, hands and prop anchors never move.
 * Never reads wall-clock time or mutates frames, rigs or scene data.
 */
export function cinematicHairFollowThroughAt(
  time: number,
  duration: number,
  sample: (at: number) => Pick<ElementFrame, "x" | "joints">,
  calm = false,
): CinematicHairFollowThrough {
  if (calm || !Number.isFinite(time) || !Number.isFinite(duration) ||
      duration <= 0 || time < 0 || time > duration) return REST;
  const dt = 0.15;
  const from = clamp(time - dt, 0, duration);
  const to = clamp(time + dt, 0, duration);
  if (to - from < 0.001) return REST;
  const before = sample(from), after = sample(to);
  const speed = (after.x - before.x) / (to - from);
  const headSpeed = ((after.joints?.head?.angle ?? 0) -
    (before.joints?.head?.angle ?? 0)) / (to - from);
  if (!Number.isFinite(speed) || !Number.isFinite(headSpeed)) return REST;
  const walking = clamp((Math.abs(speed) - 1.5) / 18, 0, 1);
  const turning = clamp(Math.abs(headSpeed) / 25, 0, 1);
  if (walking === 0 && turning === 0) return REST;
  const phase = time * 7.6;
  const angle = clamp(-speed * .055 - headSpeed * .075 +
    walking * .55 * Math.sin(phase), -3.25, 3.25);
  const lift = clamp(walking * .8 * Math.abs(Math.sin(phase)) +
    turning * .16, 0, 1);
  return { angle, lift };
}
