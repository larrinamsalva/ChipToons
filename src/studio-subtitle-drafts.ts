import { formatSrt } from "./production";
import { validateShotBeats } from "./studio-shot-beats";
import type { ShotBeat } from "./studio-shot-beats";
import { storyReelFrameAt } from "./studio-story-reel";
import type { ReelPlan } from "./studio-story-reel";

export interface DraftSubtitleCue {
  start: number;
  end: number;
  text: string;
}

/**
 * A *written* subtitle timing draft only. It covers the actual selected
 * scene interval, not detected words or recorded audio. The user must
 * review and retime against their eventual performance before publishing.
 */
export function draftSubtitleCues(
  plan: ReelPlan, beats: readonly ShotBeat[],
): DraftSubtitleCue[] {
  if (plan.shots.length < 2 || plan.shots.length > 3 ||
      !Number.isFinite(plan.duration) || plan.duration <= 0)
    throw new Error("Select a complete 2–3 shot storyboard before preparing subtitles.");
  const notes = validateShotBeats(plan.shots, beats);
  return plan.shots.flatMap(shot => {
    const text = notes.get(shot.prefix.toLowerCase())!.narration
      .replace(/\s+/gu, " ").trim();
    return text
      ? [{ start: shot.start, end: shot.start + shot.duration, text }]
      : [];
  });
}

export function storyboardSubtitleSrt(
  plan: ReelPlan, beats: readonly ShotBeat[],
): string {
  return formatSrt(draftSubtitleCues(plan, beats));
}

/** Show the current shot's written subtitle without changing any frames. */
export function storyboardSubtitleAt(
  plan: ReelPlan, beats: readonly ShotBeat[], seconds: number,
): string {
  const notes = validateShotBeats(plan.shots, beats);
  const active = storyReelFrameAt(plan, seconds);
  return notes.get(active.prefix.toLowerCase())?.narration
    .replace(/\s+/gu, " ").trim() ?? "";
}
