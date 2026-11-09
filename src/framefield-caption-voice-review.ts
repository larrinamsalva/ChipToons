import type { Project } from "./model";
import { clipStart } from "./production";
import { framefieldCueTimingCoverage } from "./framefield-caption-coverage";

/**
 * A read-only check of *assigned clip intervals*, not waveform analysis or
 * speech recognition. A listed voice clip may still be wrong or silent and
 * must be listened to by the creator.
 */
export function framefieldCaptionVoiceReview(project: Project) {
  const clipAudible = project.mixer.master > 0 &&
    project.mixer.voice > 0 && !project.mixer.muted;
  let offset = 0;
  const scenes = project.scenes.map((scene, sceneIndex) => {
    const start = offset;
    offset += scene.duration;
    const voices = project.audioClips.filter(clip =>
      (clip.category === "narration" || clip.category === "dialogue") &&
      clipAudible && !clip.muted && clip.volume > 0 &&
      clipStart(project, clip) < start + scene.duration &&
      clipStart(project, clip) + clip.duration > start);
    const captions = project.captions
      .filter(caption => caption.sceneId === scene.id)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const voiceWindows = voices.map(clip => {
      const voiceStart = clipStart(project, clip);
      return { start: voiceStart, end: voiceStart + clip.duration };
    });

    const cues = captions.map(caption => {
      const absoluteStart = start + caption.start;
      const absoluteEnd = start + caption.end;
      const coverage = framefieldCueTimingCoverage(
        absoluteStart, absoluteEnd, voiceWindows,
      );
      return {
        id: caption.id,
        text: caption.text,
        start: caption.start,
        end: caption.end,
        overlapsVoice: coverage.coveredSeconds > 0,
        coverageFraction: coverage.coverageFraction,
        uncovered: coverage.gaps.map(gap => ({
          start: gap.start - start,
          end: gap.end - start,
        })),
      };
    });
    const written = !!(scene.narration.trim() || scene.dialogue.trim());
    const missingVoice = written && voices.length === 0;
    const missingCaptions = (written || voices.length > 0) && captions.length === 0;
    const unmatchedCues = cues.filter(cue => !cue.overlapsVoice).length;
    const partiallyCoveredCues = cues.filter(cue =>
      cue.overlapsVoice && cue.uncovered.length > 0).length;
    return {
      sceneIndex, sceneId: scene.id, title: scene.title, duration: scene.duration,
      voiceClips: voices.length, captions: captions.length, written,
      missingVoice, missingCaptions, unmatchedCues, partiallyCoveredCues, cues,
    };
  });

  return {
    scenes,
    scenesWithWrittenWords: scenes.filter(scene => scene.written).length,
    scenesWithAssignedVoice: scenes.filter(scene => scene.voiceClips > 0).length,
    captions: scenes.reduce((sum, scene) => sum + scene.captions, 0),
    captionsWithoutOverlappingVoice: scenes.reduce(
      (sum, scene) => sum + scene.unmatchedCues, 0),
    partiallyCoveredCues: scenes.reduce((n, scene) => n + scene.partiallyCoveredCues, 0),
    scenesNeedingVoice: scenes.filter(scene => scene.missingVoice).length,
    scenesNeedingCaptions: scenes.filter(scene => scene.missingCaptions).length,
  };
}
