import { starterProject } from "../src/demo-starter";
import { emptyProduction } from "../src/media-model";
import { makeScene, uid } from "../src/model";
import {
  duplicateAnimatedScene,
  elementBase,
  retimeScene,
} from "../src/timeline";
import { builtInSound } from "../src/sounds";
import { newAudioClip } from "../src/production";
export const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=";
export function longProject() {
  const p = { ...starterProject(), ...emptyProduction() };
  p.title = "Twenty minutes of kind little moments";
  p.plannedMinutes = 20;
  p.assets = Array.from({ length: 40 }, (_, i) => ({
    id: uid(),
    type: "image" as const,
    name: `Original artwork ${i + 1}`,
    mime: "image/png" as const,
    dataUrl: pixel,
  }));
  p.scenes = Array.from({ length: 120 }, (_, i) => {
    const scene = retimeScene(duplicateAnimatedScene(p.scenes[i % 6]), 10);
    return {
      ...scene,
      title: `Moment ${i + 1}`,
      elements: [
        ...scene.elements,
        ...Array.from({ length: 6 }, (_, j) => ({
          ...makeScene(p.characters).elements[0],
          id: uid(),
          characterId: "",
          kind: "art" as const,
          assetId: p.assets[(i + j) % 40].id,
          name: `Artwork ${j + 1}`,
          x: 90 + j * 120,
          y: 410,
          scale: 0.3,
          motion: "still" as const,
          animation: undefined,
        })),
      ],
    };
  });
  return p;
}
export function segmentedProject(dataUrl = pixel) {
  const p = { ...starterProject(), ...emptyProduction() };
  p.title = "Kindness in two little parts";
  p.assets = [
    {
      id: uid(),
      type: "image",
      name: "Original moving marker",
      mime: "image/png",
      dataUrl,
    },
  ];
  p.scenes = p.scenes.slice(0, 4).map((s, i) => {
    const scene = retimeScene(s, 2),
      el = {
        ...scene.elements[0],
        id: uid(),
        kind: "art" as const,
        characterId: "",
        assetId: p.assets[0].id,
        name: "Moving original artwork",
        motion: "still" as const,
        x: 400,
        y: 235,
        scale: 1,
        width: 60,
        height: 60,
        rotation: 0,
        opacity: 1,
      };
    const middle = [250, 450, 550, 300][i],
      base = elementBase(el);
    el.animation = {
      blink: false,
      idle: "none",
      keyframes: [
        { id: uid(), time: 0, easing: "linear", ...base, x: middle - 100 },
        { id: uid(), time: 0.65, easing: "linear", ...base, x: middle },
        { id: uid(), time: 1.35, easing: "linear", ...base, x: middle },
        { id: uid(), time: 2, easing: "linear", ...base, x: middle + 100 },
      ],
    };
    const cam = { x: 400 + i * 20, y: 225, zoom: 1.05 + i * 0.05 };
    return {
      ...scene,
      elements: [el],
      cameraAnimation: {
        keyframes: [
          {
            id: uid(),
            time: 0,
            easing: "linear" as const,
            x: 380,
            y: 225,
            zoom: 1,
          },
          { id: uid(), time: 0.65, easing: "linear" as const, ...cam },
          { id: uid(), time: 1.35, easing: "linear" as const, ...cam },
          {
            id: uid(),
            time: 2,
            easing: "linear" as const,
            x: cam.x + 20,
            y: 225,
            zoom: cam.zoom,
          },
        ],
      },
    };
  });
  const source = builtInSound("melody"),
    music = newAudioClip(p, source, "music", 0);
  Object.assign(music, {
    trimStart: 1,
    trimEnd: 7,
    duration: 8,
    loop: true,
    volume: 0.8,
    fadeIn: 0.2,
    fadeOut: 0.2,
  });
  p.audioAssets = [source];
  p.audioClips = [music];
  const speech = starterProject().audioAssets.find(
    (a) => a.name !== "Kindness melody" && a.duration > 1,
  )!;
  p.audioAssets.push(speech);
  const voice = newAudioClip(p, speech, "dialogue", 0);
  Object.assign(voice, {
    sceneId: undefined,
    start: 3.5,
    duration: 1,
    trimStart: 0,
    trimEnd: speech.duration,
    fadeIn: 0.05,
    fadeOut: 0.05,
    volume: 0.6,
  });
  p.audioClips.push(voice);
  p.mixer.duckMusic = true;
  p.captions = p.scenes.map((s, i) => ({
    id: uid(),
    sceneId: s.id,
    start: 0.25,
    end: 1.6,
    text: `Scene ${i + 1}: a kind hello makes room for a friend.`,
  }));
  return p;
}
