import { articulatedWorkshopCharacter } from "./little-fixers-articulated-workshop";
import { littleFixersScoutVoiced } from "./little-fixers-scout-voiced";
import { makeScene, uid, validateProject } from "./model";
import { elementBase } from "./timeline";

export const SCOUT_AND_JO_LISTEN_TITLE =
  "Little Fixers Club — Scout Speaks, Helper Jo Listens (34-second voiced cartoon)";

/**
 * An actual openable animated two-performer scene demonstrating PR #100.
 * Reuse Scout's original THREE approved audio takes (and their real saved
 * voice-to-mouth envelopes); no new fake voices, guessed dialogue or edits
 * to the earlier Scout-only demo.
 *
 * Helper Jo does not speak in this showcase: Jo listens while Scout voices
 * his existing approved lines, with real sampled-time eye/head animation.
 */
export async function littleFixersVoicedListeningShowcase() {
  const original = await littleFixersScoutVoiced();
  const scene = original.scenes[0];
  const scout = scene.elements.find(item =>
    item.characterId === original.characters[0].id)!;
  const jo = articulatedWorkshopCharacter("jo");
  const listener = makeScene([jo]).elements[0];
  listener.name = "Helper Jo listens to Scout's original recording";
  listener.x = 518;
  listener.y = 381;
  listener.scale = 1.29;
  listener.emotion = "calm";
  listener.motion = "still";

  // Only Jo's own general mood is authored, never an artificial voice
  // or an imposed head gesture. Conversation gaze/head logic is free to
  // respond to Scout's actual approved speech in Cinematic Storybook.
  const baseline = elementBase(listener);
  listener.animation = {
    idle: "breathe", blink: true,
    keyframes: [
      { ...baseline, id: uid(), time: 0, emotion: "calm",
        easing: "linear" },
      { ...baseline, id: uid(), time: 12, emotion: "happy",
        easing: "ease-in-out" },
      { ...baseline, id: uid(), time: 27, emotion: "excited",
        easing: "ease-in-out" },
    ],
  };

  const index = scene.elements.findIndex(item => item.id === scout.id);
  if (index < 0) throw new Error("Scout is missing from the original voiced cartoon.");
  const elements = [...scene.elements];
  elements.splice(index + 1, 0, listener);
  const updatedScene = {
    ...scene,
    title: "Scout speaks while Helper Jo follows his actual recorded voice",
    action: "Scout walks, speaks three original approved lines, and points out safety. Helper Jo listens and turns toward Scout during his genuine recorded speech, then returns to natural background attention. No new lines or false narration are assigned to Jo.",
    elements,
  };
  return validateProject({
    ...original,
    title: SCOUT_AND_JO_LISTEN_TITLE,
    templateId: "little-fixers-voiced-listening-showcase",
    visualStyle: "storybook-cinematic" as const,
    idea: "Two original vector performers share the real screen: Scout speaks with the existing approved recordings; Helper Jo visually listens. Every original audio clip and lip-sync cue is kept.",
    characters: [...original.characters, jo],
    scenes: [updatedScene],
  });
}
