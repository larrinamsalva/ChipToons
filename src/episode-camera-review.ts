import type { Project } from "./model";
import { cameraCoverageReview } from "./camera-coverage-review";

export interface EpisodeCameraScene {
  sceneIndex: number;
  title: string;
  seconds: number;
  customSeconds: number;
  shotCount: number;
  gapCount: number;
  /** The number of ORIGINAL recorded voice clip starts in this scene. */
  voiceStarts: number;
  /** Voice starts are informational, not a failed-export condition. */
  defaultVoiceStarts: number;
}

export interface EpisodeCameraSummary {
  seconds: number;
  customSeconds: number;
  percent: number;
  scenes: EpisodeCameraScene[];
}

/** Passive pre-export whole-episode view of SAVED camera shots. Uncovered
 * time still uses the valid default camera. Do not change export eligibility,
 * recording state, original scene IDs, or creator-authored camera records.
 */
export function episodeCameraSummary(project: Project): EpisodeCameraSummary {
  const scenes = project.scenes.map((scene, sceneIndex) => {
    const report = cameraCoverageReview(project, scene);
    return {
      sceneIndex,
      title: scene.title,
      seconds: report.totalSeconds,
      customSeconds: report.coveredSeconds,
      shotCount: scene.cameraShots?.length ?? 0,
      gapCount: report.gaps.length,
      voiceStarts: report.voices.length,
      defaultVoiceStarts: report.voices.filter(voice => !voice.shotId).length,
    };
  });
  const seconds = scenes.reduce((total, scene) => total + scene.seconds, 0);
  const customSeconds = scenes.reduce((total, scene) =>
    total + scene.customSeconds, 0);
  return {
    seconds, customSeconds,
    percent: seconds > 0 ? Math.round(customSeconds / seconds * 100) : 0,
    scenes,
  };
}
