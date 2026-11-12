import { FRAME_SEQUENCE_RATES } from "./frame-sequence-model";
import { arrangeShotDirections } from "./studio-multishot";
import { MIN_STORYBOARD_SHOTS, MAX_STORYBOARD_SHOTS } from "./studio-storyboard-limits";
import type { NumberedShot, ShotDirection } from "./studio-multishot";

export interface ReelShot {
  prefix: string;
  files: readonly File[];
  start: number;
  duration: number;
  holdSeconds: number;
}
export interface ReelPlan {
  fps: number;
  shots: ReelShot[];
  duration: number;
}
export interface ReelFrame {
  prefix: string;
  shotIndex: number;
  frameIndex: number;
  frame: File;
  time: number;
  localTime: number;
  holding: boolean;
}

/** Match the existing multi-shot scene builder's scene durations and holds. */
export function planStoryReel(
  shots: readonly NumberedShot[],
  fps: number,
  direction?: readonly ShotDirection[],
): ReelPlan {
  if (!FRAME_SEQUENCE_RATES.some(rate => rate === fps))
    throw new Error("Choose a supported frame rate.");
  const ordered = arrangeShotDirections(shots, direction);
  if (ordered.length < MIN_STORYBOARD_SHOTS || ordered.length > MAX_STORYBOARD_SHOTS ||
      ordered.some(item => item.shot.files.length < 2 ||
        item.shot.files.length > 24))
    throw new Error("Choose 2–8 validated shots with 2–24 numbered PNG frames each.");
  let offset = 0;
  const entries = ordered.map(({ shot, holdSeconds }) => {
    const duration = Math.max(2, Math.ceil(shot.files.length / fps)) + holdSeconds;
    const entry: ReelShot = {
      prefix: shot.prefix, files: shot.files, holdSeconds,
      start: offset, duration,
    };
    offset += duration;
    return entry;
  });
  return { fps, shots: entries, duration: offset };
}

/**
 * Pure, repeatable read-only seek sampler. At a cut, the NEXT shot begins
 * immediately; during a hold, the last REAL PNG persists. No interpolation,
 * asset writes, synthetic frames or modified export timelines.
 */
export function storyReelFrameAt(plan: ReelPlan, seconds: number): ReelFrame {
  if (!plan.shots.length) throw new Error("A story reel needs numbered shots.");
  const t = Number.isFinite(seconds)
    ? Math.max(0, Math.min(seconds, plan.duration)) : 0;
  const shotIndex = plan.shots.findIndex((shot, index) =>
    t < shot.start + shot.duration || index === plan.shots.length - 1);
  const shot = plan.shots[shotIndex];
  const localTime = Math.max(0, t - shot.start);
  const frameIndex = Math.min(shot.files.length - 1,
    Math.max(0, Math.floor(localTime * plan.fps + 1e-9)));
  return {
    prefix: shot.prefix, shotIndex, frameIndex,
    frame: shot.files[frameIndex], time: t, localTime,
    holding: localTime >= shot.files.length / plan.fps,
  };
}
