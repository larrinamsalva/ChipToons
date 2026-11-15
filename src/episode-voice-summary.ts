import type { Project } from "./model";
import { sceneAssignedVoiceCoverage } from "./episode-voice-coverage";
import { sceneStart } from "./timeline";

export interface EpisodeUnassignedVoiceInterval {
  sceneIndex: number;
  /** Scene-local start and end timecodes, matching Sound Studio's insertion time. */
  start: number;
  end: number;
  /** Absolute episode timecodes, only for display. */
  episodeStart: number;
  episodeEnd: number;
  duration: number;
}
export interface EpisodeAssignedVoiceSummary {
  totalSeconds: number;
  assignedSeconds: number;
  unassignedSeconds: number;
  intervalCount: number;
  /** Up to five unassigned intervals, longest first, ties by episode time. */
  longestGaps: EpisodeUnassignedVoiceInterval[];
}

/** Whole-episode summary of saved voice clip timing, not verified speech.
 * Reuses the tested per-scene union so overlapping or cross-scene clips
 * are not counted twice. Unassigned intervals are creative options, not
 * failed recordings or proof that the soundtrack is silent.
 */
export function episodeAssignedVoiceSummary(
  project: Project,
): EpisodeAssignedVoiceSummary {
  let totalSeconds = 0;
  let assignedSeconds = 0;
  const gaps: EpisodeUnassignedVoiceInterval[] = [];
  project.scenes.forEach((scene, sceneIndex) => {
    const coverage = sceneAssignedVoiceCoverage(project, sceneIndex);
    const absoluteStart = sceneStart(project, sceneIndex);
    totalSeconds += coverage.totalSeconds;
    assignedSeconds += coverage.assignedSeconds;
    for (const gap of coverage.gaps) {
      gaps.push({
        sceneIndex,
        start: gap.start, end: gap.end,
        episodeStart: absoluteStart + gap.start,
        episodeEnd: absoluteStart + gap.end,
        duration: gap.end - gap.start,
      });
    }
  });
  const ordered = gaps.sort((a, b) =>
    b.duration - a.duration || a.episodeStart - b.episodeStart ||
    a.sceneIndex - b.sceneIndex);
  return {
    totalSeconds,
    assignedSeconds,
    unassignedSeconds: Math.max(0, totalSeconds - assignedSeconds),
    intervalCount: gaps.length,
    longestGaps: ordered.slice(0, 5),
  };
}
