import { uid, validateProject } from "./model";
import type { Project } from "./model";
import type { Caption } from "./media-model";
import { draftSubtitleCues } from "./studio-subtitle-drafts";
import type { SubtitleDraftAdjustment, SubtitleTimingPlan } from "./studio-subtitle-drafts";
import type { ShotBeat } from "./studio-shot-beats";
import { MIN_STORYBOARD_SHOTS, MAX_STORYBOARD_SHOTS } from "./studio-storyboard-limits";

export const EDITABLE_CAPTION_TEXT_LIMIT = 280;

/**
 * Validate the REAL, existing ChipToons Caption limits *before* original
 * PNG decoding. Reject rather than truncating a creator's text.
 */
export function verifiedImportCaptionCues(
  plan: SubtitleTimingPlan,
  beats: readonly ShotBeat[],
  adjustments?: readonly SubtitleDraftAdjustment[],
) {
  const cues = draftSubtitleCues(plan, beats, adjustments);
  for (const cue of cues) {
    if (!cue.text.trim() || cue.text.length > EDITABLE_CAPTION_TEXT_LIMIT)
      throw new Error(
        "To include captions in the new cartoon, each subtitle must be 280 characters or shorter. Edit it or turn off caption import.",
      );
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) ||
        cue.start < 0 || cue.end > plan.duration + 1e-7 ||
        cue.end - cue.start < 0.01)
      throw new Error("Subtitle timing is not supported by the editor.");
  }
  return cues;
}

/**
 * Opt-in, new-project ONLY. The imported source project is left untouched.
 * Every original shot is associated with exactly one already-created scene,
 * and absolute subtitle timing becomes that scene's local Caption time.
 * No new schema/voice/audio or synthetic artwork.
 */
export function attachStoryboardCaptionDrafts(
  project: Project,
  orderedShotPrefixes: readonly string[],
  beats: readonly ShotBeat[],
  adjustments?: readonly SubtitleDraftAdjustment[],
): Project {
  if (orderedShotPrefixes.length !== project.scenes.length ||
      orderedShotPrefixes.length < MIN_STORYBOARD_SHOTS ||
      orderedShotPrefixes.length > MAX_STORYBOARD_SHOTS ||
      new Set(orderedShotPrefixes.map(prefix => prefix.toLowerCase())).size !==
        orderedShotPrefixes.length)
    throw new Error("Caption shots no longer match the new cartoon scenes.");
  if (project.captions.length)
    throw new Error("The new cartoon already contains captions; nothing was replaced.");

  let time = 0;
  const timing: SubtitleTimingPlan = {
    shots: project.scenes.map((scene, index) => {
      if (!Number.isFinite(scene.duration) || scene.duration < 2)
        throw new Error("Invalid scene timing for imported captions.");
      const shot = { prefix: orderedShotPrefixes[index], start: time, duration: scene.duration };
      time += scene.duration;
      return shot;
    }),
    duration: time,
  };
  const cues = verifiedImportCaptionCues(timing, beats, adjustments);
  const captions: Caption[] = cues.map(cue => {
    const index = timing.shots.findIndex(shot =>
      cue.start >= shot.start - 1e-7 &&
      cue.end <= shot.start + shot.duration + 1e-7);
    if (index < 0) throw new Error("A subtitle would cross a scene boundary.");
    const scene = project.scenes[index];
    const start = Math.max(0, cue.start - timing.shots[index].start);
    const end = Math.min(scene.duration, cue.end - timing.shots[index].start);
    if (start >= scene.duration - 0.01 || end - start < 0.01)
      throw new Error("A subtitle would be too short for the editor.");
    return { id: uid(), sceneId: scene.id, start, end, text: cue.text };
  });
  return validateProject({ ...project, captions });
}
