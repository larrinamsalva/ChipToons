import type { Asset, Project, SceneElement } from "./model";
import { makeScene, uid, validateProject } from "./model";
import { littleFixersCluesPreview } from "./little-fixers-clues";
import { LITTLE_FIXERS_REMAINDER } from "./little-fixers-remainder-script";
import { applyPanel, fixersPanels } from "./picture-studio";
import { blankLine, withScript } from "./script";

/**
 * Create a separate, editable 20-minute SCRIPT DRAFT.
 *
 * Preserve the independently animated and voiced 1:59 opening, then the
 * moving Safety First, Meet the Tools and Look for Clues sections.
 * Only the remaining 15 scenes are SCRIPT DRAFTS: do not represent them
 * as finished animation or verified media.
 */
export async function littleFixersEpisodeScriptPlan(source: Asset): Promise<Project> {
  const opening = await littleFixersCluesPreview(source);
  const hostId = opening.characters[0]?.id;
  const preparedHost = opening.scenes.flatMap(scene => scene.elements)
    .find(element => element.characterId === hostId);
  if (!hostId || !preparedHost) throw new Error("The Little Fixers workshop host was not prepared.");

  const planned = LITTLE_FIXERS_REMAINDER.slice(3).map((beat, index) => {
    // Reuse the existing art, but deliberately omit a finished animation track.
    const actor: SceneElement = {
      ...preparedHost, id: uid(), x: 300, y: 417,
      motion: "still", emotion: "calm",
    };
    // The original host's voice-mouth cues belong to the voiced opening.
    // Do not carry those clip IDs into new, deliberately unvoiced scenes.
    delete actor.animation;
    delete actor.voiceMouth;
    const draft = withScript({
      ...makeScene([], opening.scenes.length + index),
      title: "Script draft · " + beat.title,
      duration: beat.seconds,
      background: "classroom",
      transition: "cut",
      action: "SCRIPT ONLY — needs original character motion, recorded dialogue and sound. " + beat.direction,
      elements: [actor],
    }, {
      acting: beat.direction + " " + beat.participation,
      emotion: "Friendly, curious and reassuring",
      lines: [{
        ...blankLine("dialogue", beat.dialogue),
        speakerId: hostId,
      }],
    });
    return applyPanel(draft, source, { ...fixersPanels[beat.panelIndex], visible: false });
  });

  return validateProject({
    ...opening,
    title: "Little Fixers Club — Episode 1 (20-minute script; motion through Look for Clues, voice pending)",
    plannedMinutes: 20,
    scenes: [...opening.scenes, ...planned],
    outline: {
      beginning: "The host spots a wobbling chair and introduces look, stop and ask.",
      conflict: "A safe repair requires planning and adult inspection; a fan may need expert help.",
      response: "The team supervises a safe chair demonstration and reuses prepared wood for a birdhouse.",
      ending: "Celebrate thoughtful choices, kindness, teamwork, and knowing when to stop.",
    },
  });
}
