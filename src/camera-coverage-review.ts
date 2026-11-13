import type { CameraShot } from "./camera-shots";
import type { Project, Scene } from "./model";
import { clipStart } from "./production";
import { sceneStart } from "./timeline";

export interface CoverageWindow {
  start: number;
  end: number;
}
export interface VoiceCoverage {
  clipId: string;
  start: number;
  /** A voice can start in a custom camera shot or the scene's default view. */
  shotId?: string;
  category: "dialogue" | "narration";
}
export interface CameraCoverageReview {
  coveredSeconds: number;
  totalSeconds: number;
  gaps: CoverageWindow[];
  voices: VoiceCoverage[];
}

/** Read-only custom-shot coverage review for a creator's actual scene.
 * Gaps are not errors: the normal default camera still shows the cartoon.
 * This does not modify audio, shots, project IDs or creator overrides. */
export function cameraCoverageReview(
  project: Project,
  scene: Scene,
  proposedShots: readonly CameraShot[] = scene.cameraShots ?? [],
): CameraCoverageReview {
  const totalSeconds = Math.max(0, scene.duration);
  const windows = proposedShots
    .filter(shot => Number.isFinite(shot.start) &&
      Number.isFinite(shot.end) && shot.end > shot.start)
    .map(shot => ({
      start: Math.min(totalSeconds, Math.max(0, shot.start)),
      end: Math.min(totalSeconds, Math.max(0, shot.end)),
    }))
    .filter(window => window.end > window.start)
    .sort((a,b) => a.start - b.start || a.end - b.end);
  const gaps: CoverageWindow[] = [];
  let cursor = 0;
  for (const window of windows) {
    if (window.start > cursor + 1e-7) gaps.push({
      start: cursor, end: window.start,
    });
    cursor = Math.max(cursor, window.end);
  }
  if (cursor < totalSeconds - 1e-7) gaps.push({
    start: cursor, end: totalSeconds,
  });
  const coveredSeconds = Math.max(0, totalSeconds -
    gaps.reduce((sum, window) => sum + window.end - window.start, 0));

  const index = project.scenes.findIndex(item => item.id === scene.id);
  const start = index < 0 ? 0 : sceneStart(project, index);
  const voices: VoiceCoverage[] = index < 0 ? [] :
    project.audioClips.flatMap(clip => {
      if ((clip.category !== "dialogue" && clip.category !== "narration") ||
          clip.muted || clip.volume <= 0) return [];
      const localTime = clipStart(project, clip) - start;
      if (!Number.isFinite(localTime) || localTime < 0 ||
          localTime >= totalSeconds) return [];
      // At a precise cut, the newly started shot owns the first frame.
      const shot = proposedShots.find(item =>
        localTime >= item.start && localTime < item.end);
      return [{
        clipId: clip.id, start: localTime,
        category: clip.category, shotId: shot?.id,
      }];
    }).sort((a,b) => a.start - b.start || a.clipId.localeCompare(b.clipId));
  return { coveredSeconds, totalSeconds, gaps, voices };
}
