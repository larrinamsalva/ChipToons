import { formatSrt } from "./production";
import { validateShotBeats } from "./studio-shot-beats";
import type { ShotBeat } from "./studio-shot-beats";
import type { ReelPlan } from "./studio-story-reel";

export interface DraftSubtitleCue {
  start: number;
  end: number;
  text: string;
}

/** User-selected preview-only caption words and optional second subtitle. */
export interface SubtitleDraftAdjustment {
  prefix: string;
  first: string;
  second: string;
  /** First cue ends here; second cue starts here, as % of this scene. */
  splitPercent: number;
}

export const SUBTITLE_DRAFT_TEXT_LIMIT = 300;
export const SUBTITLE_MIN_SPLIT_PERCENT = 20;
export const SUBTITLE_MAX_SPLIT_PERCENT = 80;

export function suggestedSubtitleAdjustment(prefix: string, narration: string): SubtitleDraftAdjustment {
  return { prefix, first: narration, second: "", splitPercent: 50 };
}

const safeText = (value: unknown): value is string =>
  typeof value === "string" && value.length <= SUBTITLE_DRAFT_TEXT_LIMIT &&
  !Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
  });

/**
 * Sparse edits must belong to the EXACT selected, locally validated
 * shots. No unknown keys or unsafe control characters. These edits are
 * NOT applied to project narration, audio, scene duration or captions.
 */
export function validateSubtitleAdjustments(
  plan: ReelPlan, adjustments?: readonly SubtitleDraftAdjustment[],
): ReadonlyMap<string, SubtitleDraftAdjustment> {
  const result = new Map<string, SubtitleDraftAdjustment>();
  if (adjustments === undefined) return result;
  if (!Array.isArray(adjustments) || adjustments.length > plan.shots.length)
    throw new Error("Subtitle edits do not match the selected shots.");
  const validPrefixes = new Set(plan.shots.map(shot => shot.prefix.toLowerCase()));
  if (validPrefixes.size !== plan.shots.length) throw new Error("Subtitle shot names must be unique.");
  for (const item of adjustments) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).some(key =>
          !["prefix", "first", "second", "splitPercent"].includes(key)) ||
        typeof item.prefix !== "string" ||
        !validPrefixes.has(item.prefix.toLowerCase()) ||
        result.has(item.prefix.toLowerCase()) ||
        !safeText(item.first) || !safeText(item.second) ||
        !Number.isInteger(item.splitPercent) ||
        item.splitPercent < SUBTITLE_MIN_SPLIT_PERCENT ||
        item.splitPercent > SUBTITLE_MAX_SPLIT_PERCENT ||
        item.splitPercent % 5 !== 0)
      throw new Error("Invalid subtitle draft: check shot, wording and split timing.");
    result.set(item.prefix.toLowerCase(), item);
  }
  return result;
}

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();

/**
 * Original narration remains a single full-scene cue by default.
 * The optional manual override can replace it with one or two
 * non-overlapping, time-bounded cues. The split is only a DRAFT:
 * it is not measured from speech or burned into an exported movie.
 */
export function draftSubtitleCues(
  plan: ReelPlan,
  beats: readonly ShotBeat[],
  adjustments?: readonly SubtitleDraftAdjustment[],
): DraftSubtitleCue[] {
  if (plan.shots.length < 2 || plan.shots.length > 3 ||
      !Number.isFinite(plan.duration) || plan.duration <= 0)
    throw new Error("Select a complete 2–3 shot storyboard before preparing subtitles.");
  const notes = validateShotBeats(plan.shots, beats);
  const overrides = validateSubtitleAdjustments(plan, adjustments);
  return plan.shots.flatMap(shot => {
    const override = overrides.get(shot.prefix.toLowerCase());
    const start = shot.start, end = shot.start + shot.duration;
    if (!override) {
      const text = clean(notes.get(shot.prefix.toLowerCase())!.narration);
      return text ? [{ start, end, text }] : [];
    }
    const first = clean(override.first);
    const second = clean(override.second);
    if (!second) return first ? [{ start, end, text: first }] : [];
    const cut = start + shot.duration * override.splitPercent / 100;
    // The first part may be intentionally blank for a later cue; never
    // generate a zero-length or empty subtitle entry.
    return [
      ...(first ? [{ start, end: cut, text: first }] : []),
      { start: cut, end, text: second },
    ];
  });
}

export function storyboardSubtitleSrt(
  plan: ReelPlan, beats: readonly ShotBeat[],
  adjustments?: readonly SubtitleDraftAdjustment[],
): string {
  return formatSrt(draftSubtitleCues(plan, beats, adjustments));
}

/** Preview the text for the currently selected exact scene/cue time. */
export function storyboardSubtitleAt(
  plan: ReelPlan, beats: readonly ShotBeat[], seconds: number,
  adjustments?: readonly SubtitleDraftAdjustment[],
): string {
  const time = Number.isFinite(seconds)
    ? Math.max(0, Math.min(seconds, plan.duration)) : 0;
  return draftSubtitleCues(plan, beats, adjustments).find(cue =>
    (time >= cue.start && time < cue.end) ||
    (time === plan.duration && cue.end === plan.duration))?.text ?? "";
}
