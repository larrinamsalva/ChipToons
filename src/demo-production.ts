import voices from "./demo-voices.json" with { type: "json" };
import { uid, totalDuration } from "./model";
import type { Project } from "./model";
import type { AudioAsset } from "./media-model";
import { builtInSound } from "./sounds";
import { newAudioClip, captionsFromText } from "./production";
import { putElementKey } from "./timeline";
export function addDemoProduction(p: Project) {
  const narrator: AudioAsset = {
    id: uid(),
    name: "Sample narrator · original synthetic speech",
    mime: "audio/wav",
    channels: 1,
    sampleRate: 24000,
    ...voices.narrator,
  };
  const pip: AudioAsset = {
      ...narrator,
      id: uid(),
      name: "Pip · original synthetic dialogue",
      ...voices.pip,
    },
    sunny: AudioAsset = {
      ...narrator,
      id: uid(),
      name: "Sunny · original synthetic dialogue",
      ...voices.sunny,
    };
  const music = builtInSound("melody"),
    sparkle = builtInSound("sparkle");
  p.audioAssets = [narrator, pip, sunny, music, sparkle];
  const narration = {
    ...newAudioClip(p, narrator, "narration", 0, 0.4),
    name: "A kind hello",
  };
  const first = {
    ...newAudioClip(p, pip, "dialogue", 1, 5.4),
    characterId: p.characters[0].id,
  };
  const second = {
    ...newAudioClip(p, sunny, "dialogue", 5, 6),
    characterId: p.characters[1].id,
  };
  p.audioClips = [
    narration,
    first,
    second,
    {
      ...newAudioClip(p, music, "music", 0),
      loop: true,
      duration: totalDuration(p),
      volume: 0.2,
      fadeIn: 1,
      fadeOut: 2,
    },
    { ...newAudioClip(p, sparkle, "effects", 2, 7), volume: 0.55 },
  ];
  p.captions = p.scenes
    .flatMap(captionsFromText)
    .filter(
      (c) =>
        ![p.scenes[0].id, p.scenes[1].id, p.scenes[5].id].includes(c.sceneId),
    );
  p.captions.push(
    {
      id: uid(),
      sceneId: p.scenes[0].id,
      start: 0.4,
      end: Math.min(2.8, 0.4 + narrator.duration),
      text: "Pip notices a lonely friend.",
    },
    {
      id: uid(),
      sceneId: p.scenes[0].id,
      start: 2.8,
      end: 0.4 + narrator.duration,
      text: "A kind hello can make a day brighter.",
    },
    {
      id: uid(),
      sceneId: p.scenes[1].id,
      start: first.start,
      end: first.start + first.duration,
      text: "Pip: Hi Sunny. Would you like to play with me?",
    },
    {
      id: uid(),
      sceneId: p.scenes[5].id,
      start: second.start,
      end: second.start + second.duration,
      text: "Sunny: Thank you for making room for me.",
    },
  );
  for (const [index, who, clip] of [
    [1, 0, first],
    [5, 1, second],
  ] as const) {
    const scene = p.scenes[index],
      element = scene.elements[who];
    element.animation = putElementKey(element, clip.start, scene.duration, {
      mouth: "talking",
    });
    element.animation = putElementKey(
      element,
      clip.start + clip.duration,
      scene.duration,
      { mouth: "smile" },
    );
  }
}
