import type { SceneAssignedVoiceCoverage } from "./episode-voice-coverage";

export interface VoiceTimingBand {
  kind: "assigned" | "unassigned";
  start: number;
  end: number;
  /** Percentage of this scene's saved duration, not a volume level. */
  widthPercent: number;
}

/** A compact, ordered visual key for a scene's verified clip *timing*
 * intervals. This does not analyze waveform silence or spoken words.
 * Gaps are never classified as failed recordings or export blockers.
 */
export function voiceTimingBands(
  coverage: SceneAssignedVoiceCoverage,
): VoiceTimingBand[] {
  const duration = coverage.totalSeconds;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const bands: VoiceTimingBand[] = [];
  const add = (kind: VoiceTimingBand["kind"], start: number, end: number) => {
    if (end <= start) return;
    bands.push({ kind, start, end,
      widthPercent: (end - start) / duration * 100,
    });
  };
  let cursor = 0;
  for (const gap of coverage.gaps) {
    const start = Math.max(cursor, Math.min(duration, gap.start));
    const end = Math.max(start, Math.min(duration, gap.end));
    add("assigned", cursor, start);
    add("unassigned", start, end);
    cursor = end;
  }
  add("assigned", cursor, duration);
  return bands;
}
