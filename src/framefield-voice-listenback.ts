import type { Project } from "./model";
import { clipStart } from "./production";

/** Original audio metadata only. Voice-lane assignment does not prove speech. */
export function framefieldSceneVoiceSources(project: Project, sceneIndex: number) {
  if (project.templateId !== "frame-sequence-storyboard")
    throw new Error("Voice listen-back is for imported PNG storyboards only.");
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0 ||
      sceneIndex >= project.scenes.length)
    throw new RangeError("Selected storyboard scene is out of range.");
  const start = project.scenes.slice(0, sceneIndex)
    .reduce((sum, scene) => sum + scene.duration, 0);
  const end = start + project.scenes[sceneIndex].duration;
  const mixerAudible = !project.mixer.muted &&
    project.mixer.master > 0 && project.mixer.voice > 0;
  return project.audioClips.flatMap(clip => {
    if (clip.category !== "narration" && clip.category !== "dialogue")
      return [];
    const episodeStart = clipStart(project, clip);
    const episodeEnd = episodeStart + clip.duration;
    if (episodeStart >= end || episodeEnd <= start) return [];
    return [{
      clip,
      asset: project.audioAssets.find(asset => asset.id === clip.assetId),
      episodeStart,
      episodeEnd,
      audibleInMix: mixerAudible && !clip.muted && clip.volume > 0,
    }];
  }).sort((a, b) =>
    a.episodeStart - b.episodeStart || a.clip.id.localeCompare(b.clip.id));
}
