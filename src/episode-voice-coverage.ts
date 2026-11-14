import type { Project } from "./model";
import { clipStart } from "./production";
import { sceneStart } from "./timeline";

export interface AssignedVoiceSpan {
  clipId: string;
  category: "dialogue" | "narration";
  /** Scene-local seconds, clipped to the actual scene boundary. */
  start: number;
  end: number;
}
export interface UnassignedVoiceInterval {
  start: number;
  end: number;
}
export interface SceneAssignedVoiceCoverage {
  totalSeconds: number;
  assignedSeconds: number;
  spans: AssignedVoiceSpan[];
  gaps: UnassignedVoiceInterval[];
}

/** Read-only timing coverage of assigned, unmuted dialogue/narration.
 * No assignments does NOT prove silence, and a present assignment does
 * NOT establish decodable audio, actual speech, script accuracy or approval.
 * Supports overlapping clips and voices spilling into adjacent scenes.
 */
export function sceneAssignedVoiceCoverage(
  project: Project, sceneIndex: number,
): SceneAssignedVoiceCoverage {
  const scene = project.scenes[sceneIndex];
  if (!scene) return { totalSeconds: 0, assignedSeconds: 0, spans: [], gaps: [] };
  const totalSeconds = Number.isFinite(scene.duration)
    ? Math.max(0, scene.duration) : 0;
  const episodeStart = sceneStart(project, sceneIndex);
  const spans: AssignedVoiceSpan[] = project.audioClips.flatMap(clip => {
    if ((clip.category !== "narration" && clip.category !== "dialogue") ||
      clip.muted || !Number.isFinite(clip.volume) || clip.volume <= 0 ||
      !Number.isFinite(clip.duration) || clip.duration <= 0) return [];
    const absolute = clipStart(project, clip);
    if (!Number.isFinite(absolute)) return [];
    const start = Math.max(0, absolute - episodeStart);
    const end = Math.min(totalSeconds, absolute + clip.duration - episodeStart);
    if (end <= start) return [];
    return [{ clipId: clip.id, category: clip.category, start, end }];
  }).sort((a, b) => a.start - b.start || a.end - b.end ||
    a.clipId.localeCompare(b.clipId));
  const gaps: UnassignedVoiceInterval[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor + 1e-7) {
      gaps.push({ start: cursor, end: span.start });
    }
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < totalSeconds - 1e-7) {
    gaps.push({ start: cursor, end: totalSeconds });
  }
  const assignedSeconds = Math.max(0, totalSeconds -
    gaps.reduce((total, gap) => total + gap.end - gap.start, 0));
  return { totalSeconds, assignedSeconds, spans, gaps };
}
