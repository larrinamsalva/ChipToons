import type { Project } from "./model";
import { lineStatus, selectedTake } from "./script";
import { mouthTrackIsCurrent, supportsVoiceMouth } from "./voice-mouth";

export const LITTLE_FIXERS_VOICE_BOARD_TITLE = "Little Fixers · Finish the Voices";

// The board is for the editable Scout story only; never mutate older demo
// templates or incorrectly label a generic 20-minute test fixture as finished.
export function isLittleFixersVoiceProject(project: Project) {
  return project.templateId === "little-fixers-scout-wobbly-chair-story" ||
    project.templateId === "little-fixers-scout-helper-jo-handoff" ||
    project.templateId === "little-fixers-mark-it-safe" ||
    project.templateId === "little-fixers-scout-wagon-wheel-repair" ||
    project.templateId === "little-fixers-scout-tidy-and-park";
}

export function littleFixersVoiceReadiness(project: Project) {
  const lines = project.scenes.flatMap((scene, sceneIndex) =>
    (scene.script?.lines ?? []).map((line, lineIndex) => {
      const status = lineStatus(project, line);
      const { clip } = selectedTake(project, line);
      const actor = scene.elements.find(e => !!line.speakerId && e.characterId === line.speakerId);
      const character = project.characters.find(c => c.id === line.speakerId);
      const needsMouth = line.kind === "dialogue" &&
        !!actor && supportsVoiceMouth(character, actor);
      const mouthReady = !needsMouth || (!!clip && !!actor?.voiceMouth?.some(track =>
        track.clipId === clip.id && mouthTrackIsCurrent(project, scene, actor, track)));
      // Captions must actually overlap the approved recorded take. A caption
      // elsewhere in the scene cannot make an unfinished line look complete.
      const captionReady = !!clip && status === "Approved" &&
        project.captions.some(caption => caption.sceneId === scene.id &&
          caption.start < clip.start + clip.duration - 0.005 &&
          caption.end > clip.start + 0.005);
      return {
        sceneId: scene.id, sceneIndex, sceneTitle: scene.title,
        lineId: line.id, lineIndex, text: line.text,
        status, clipId: clip?.id, needsMouth, mouthReady,
        captionReady, approved: status === "Approved",
      };
    }),
  );
  return {
    lines,
    total: lines.length,
    approved: lines.filter(line => line.approved).length,
    unrecorded: lines.filter(line => line.status === "Not recorded").length,
    mouthReady: lines.filter(line => line.approved && line.mouthReady).length,
    captionReady: lines.filter(line => line.captionReady).length,
    complete: !!lines.length && lines.every(line =>
      line.approved && line.mouthReady && line.captionReady),
  };
}

export function littleFixersVoiceCueSheet(project: Project) {
  const board = littleFixersVoiceReadiness(project);
  return [
    "LITTLE FIXERS CLUB — VOICE RECORDING CUE SHEET",
    project.title,
    "",
    `${board.approved}/${board.total} approved recordings; ${board.unrecorded} unrecorded lines.`,
    "Record only words you own or have permission to use. A recorded take is not approved until listened to and reviewed.",
    "For every approved spoken line, review waveform mouth animation and timed captions. Keep original takes and project backups.",
    "",
    ...board.lines.flatMap(line => [
      `Scene ${line.sceneIndex + 1}, line ${line.lineIndex + 1}: ${line.sceneTitle}`,
      `Status: ${line.status}; mouth: ${line.mouthReady ? "ready/not needed" : "needed"}; captions: ${line.captionReady ? "ready" : "needed"}`,
      `Words: ${line.text}`,
      "",
    ]),
    "NOTE: Existing 20-minute export test footage is a studio fixture, not a finished Little Fixers episode.",
  ].join("\n");
}
