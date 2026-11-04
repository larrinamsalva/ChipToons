import { gardenInteractionDemo } from "./garden-demo";
import { wateringWindow } from "./interaction-model";
import { uid, validateProject } from "./model";
import type { Project } from "./model";
import { newAudioClip } from "./production";
import { blankLine, chooseScriptTake, setLineApproval, withScript } from "./script";
import { originalSound, prepareSound } from "./sound-director";
import type { SoundDraft } from "./sound-director";
import type { SoundAnchor } from "./sound-cues";
import type { SoundId } from "./sounds";
import { duplicateAnimatedScene, keyAt } from "./timeline";

export const SOUND_GARDEN_TITLE = "Helping Hands — A Garden Full of Sounds";
export const GARDEN_LESSON = "Living things need gentle care. Give a thirsty plant a little water, then give it time to grow.";
export const GARDEN_NARRATION_START = 0.55;

export function gardenSoundDemo(): Project {
  const base = gardenInteractionDemo();
  const original = base.scenes[0];
  const cast = original.elements.filter(item => item.characterId);
  const [hero, shine] = cast;
  const action = original.interactions![0];
  const watering = wateringWindow(action);
  const first = { ...original, narration: "", suggestedAtmosphere: "garden" as const,
    elements: original.elements.map(element => element.id === shine.id && element.animation ? {
      ...element, animation: { ...element.animation, keyframes: element.animation.keyframes.map(key => key.heart === "helping"
        ? { ...key, time: 9.15 } : key) },
    } : element),
  };
  const duration = 8;
  const copied = duplicateAnimatedScene(first);
  const ending = withScript({ ...copied, title: "A little care helps", duration, action: "Shine and Helping Hands smile as the narrator explains the lesson.",
    interactions: undefined, question: undefined,
    elements: copied.elements.map(element => {
      const item = { ...element, animation: undefined };
      if (element.characterId === hero.characterId) return { ...item, x: 265, emotion: "happy" as const };
      if (element.characterId === shine.characterId) return { ...item, emotion: "happy" as const,
        animation: { idle: "none" as const, blink: true, keyframes: [
          { ...keyAt(item, 0, duration), heart: "helping" as const, heartStrength: 0.78, mouth: "smile" as const },
          { ...keyAt(item, 7.9, duration), heart: "warm" as const, heartStrength: 0.55, mouth: "smile" as const },
        ] },
      };
      return item.prop === "watering-can" ? { ...item, x: 236, y: 393 } : item;
    }),
    cameraAnimation: { keyframes: [{ ...copied.cameraAnimation!.keyframes.at(-1)!, time: 0 }] },
  }, { acting: "Leave room to hear the garden under the voice.", emotion: "Warm and curious",
    lines: [blankLine("narration", GARDEN_LESSON)] });
  let project = validateProject({
    ...base, title: SOUND_GARDEN_TITLE, scenes: [first, ending], mixer: { ...base.mixer, duckMusic: true },
    captions: [...base.captions, { id: uid(), sceneId: ending.id, text: GARDEN_LESSON, start: GARDEN_NARRATION_START, end: 6.8 }],
  });
  const actionAt = (moment: string): SoundAnchor => ({ kind: "action", id: action.id, moment });
  const key = (id: string): SoundAnchor => ({ kind: "key", id });
  const walk = hero.animation!.keyframes;
  const chime = first.elements.find(item => item.id === shine.id)!.animation!.keyframes.at(-1)!;
  const effects: [SoundId, SoundAnchor, number, number][] = [
    ["steps", key(walk.find(item => item.time === 0.55)!.id), 1.25, 0.76],
    ["pickup", actionAt("Attach"), 0.46, 0.8],
    ["steps", key(walk.find(item => item.time === 2.85)!.id), 1.75, 0.58],
    ["pour", actionAt("Pour"), watering.end - watering.start, 0.77],
    ["place", actionAt("Release"), 0.58, 0.68],
    ["success", key(chime.id), 0.92, 0.51],
  ];
  const add = (id: SoundId, draft: Omit<SoundDraft, "asset">) => {
    project = prepareSound(project, 0, { ...draft, asset: originalSound(project, id) }).project;
  };
  for (const [id, anchor, duration, volume] of effects)
    add(id, { anchor, at: 0, offset: 0, duration, volume, fadeIn: 0.015, fadeOut: 0.035 });
  const ambience = { first: first.id, last: ending.id };
  add("garden", { ambience, at: 0, offset: 0, duration: 1, volume: 0.2, fadeIn: 0.4, fadeOut: 0.7 });
  add("birds", { ambience, at: 0, offset: 0, duration: 1, volume: 0.17, fadeIn: 0.4, fadeOut: 0.7 });
  return project;
}

export async function voicedGardenSoundDemo() {
  const [{ default: voice }, { readAudio }] = await Promise.all([import("./samples/garden/lesson.mp3?inline"), import("./audio-files")]);
  const sample = await (await fetch(voice)).blob();
  const source = await readAudio(new File([sample], "Original garden lesson · offline synthesized narration.mp3", { type: "audio/mpeg" }));
  const project = gardenSoundDemo();
  const [ , ending ] = project.scenes;
  const lineId = ending.script!.lines[0].id;
  const recorded = chooseScriptTake(project, lineId, source, true);
  const assigned = recorded.scenes[1].script!.lines[0].clipId!;
  const clip = { ...newAudioClip(project, source, "narration", 1, GARDEN_NARRATION_START),
    id: assigned, volume: 0.88 };
  return validateProject(setLineApproval({ ...recorded, audioClips: recorded.audioClips.map(item => item.id === assigned ? clip : item) }, lineId, true));
}
