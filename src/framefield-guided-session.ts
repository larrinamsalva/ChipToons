import type { Project } from "./model";
import { framefieldCaptionVoiceReview } from "./framefield-caption-voice-review";

/** Exact current-scene timing, original words and clip-overlap hints. Read only. */
export function framefieldGuidedSession(project: Project) {
  if (project.templateId !== "frame-sequence-storyboard")
    throw new Error("Guided recording is for imported PNG storyboards only.");
  const review = framefieldCaptionVoiceReview(project);
  let elapsed = 0;
  const scenes = review.scenes.map(scene => {
    const authored = project.scenes[scene.sceneIndex];
    const start = elapsed;
    elapsed += scene.duration;
    return {
      ...scene,
      episodeStart: start,
      episodeEnd: elapsed,
      narration: authored.narration,
      dialogue: authored.dialogue,
      cues: scene.cues.map(cue => ({
        ...cue,
        episodeStart: start + cue.start,
        episodeEnd: start + cue.end,
      })),
    };
  });
  return {
    scenes,
    scenesWithAssignedVoice: review.scenesWithAssignedVoice,
    scenesNeedingVoice: review.scenesNeedingVoice,
  };
}
