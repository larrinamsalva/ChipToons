import { newFocusGraphic } from "./focus-studio";
import { littleFixersSafetyPreview } from "./little-fixers-safety";
import { makeScene, uid, validateProject } from "./model";
import type { Asset, Project, Scene, SceneElement } from "./model";
import { workshopHostKeys } from "./picture-demo";
import { newAudioClip } from "./production";
import { blankLine, withScript } from "./script";
import { builtInSound } from "./sounds";
import { elementBase } from "./timeline";

export const TOOLS_PREVIEW_TITLE =
  "Little Fixers Club — Episode 1: Meet the Tools (4-minute motion preview; voices pending)";

function duplicate(item: SceneElement): SceneElement {
  const next: SceneElement = { ...item, id: uid(), animation: undefined };
  delete next.voiceMouth;
  return next;
}
function teaching(scene: Scene, at: number, length: number, text: string, x = 575, y = 90) {
  return { ...newFocusGraphic(scene, at), kind: "label" as const, text, length,
    target: { kind: "screen" as const, x, y } };
}
function onShelf(scene: Scene, at: number, duration: number) {
  return { id: uid(), style: "medium" as const, start: at, end: at + duration,
    frame: { x: 610, y: 300, zoom: 1.4 }, move: 0.8,
    targets: [], follow: false, offset: { x: 0, y: 0 },
    placement: "center" as const, note: "Focus on stored adult-only tools and the picture checklist." };
}

/**
 * Continue the independently voiced 1:59 opening and the animated 61-second
 * Safety First lesson with two distinct 30-second motion scenes.
 *
 * The new written dialogue is NOT a recorded/approved voice track.
 * The resulting 4:00 is an animated-effects preview, not a finished release.
 */
export async function littleFixersToolsPreview(source: Asset): Promise<Project> {
  const before = await littleFixersSafetyPreview(source);
  const previous = before.scenes.at(-1)!;
  const presenter = previous.elements.find(item => item.characterId);
  if (!presenter) throw new Error("Little Fixers workshop presenter is missing.");
  const scenery = previous.elements.filter(item => !item.characterId)
    .map(duplicate);
  const host1: SceneElement = { ...duplicate(presenter), x: 265, y: 418,
    scale: 1.63, emotion: "happy", motion: "still" };
  host1.animation = workshopHostKeys(host1, [
    [0, 2, 0, "happy"], [4, -6, 15], [8, 11, 31],
    [13, 5, 8], [18, -9, 25], [23, 8, 15],
    [27, -4, 28], [29.8, 0, 5],
  ]);
  const checklist: SceneElement = {
    id: uid(), kind: "prop", prop: "book", name: "Picture checklist",
    characterId: "", x: 510, y: 378, scale: 0.85, rotation: 0, flip: false,
    motion: "still", emotion: "calm",
  };
  checklist.animation = { idle: "none", blink: false, keyframes: ([
    [0, 510, 378, 0], [8, 510, 378, 0], [13, 535, 340, -11],
    [17, 575, 293, 0], [23, 575, 293, 5], [29.8, 575, 293, 0],
  ] as const).map(([time, x, y, rotation]) =>
    ({ ...elementBase(checklist), id: uid(), time, x, y, rotation,
      easing: "ease-in-out" as const })) };

  const scene1 = withScript({
    ...makeScene([], 10), title: "Meet the Tools · 1 — Helpers, Not Toys (motion; voice pending)",
    duration: 30, background: "classroom", chapter: "introduction", transition: "cut",
    action: "The host gestures toward the stored adult-only toolbox and a picture checklist. The checklist moves from the work surface into view. No child handles a tool.",
    elements: [...scenery, host1, checklist],
  }, {
    acting: "Warm, clear, age-appropriate safety guidance; pause for viewers to notice the adult-only toolbox.",
    emotion: "Curious and reassuring",
    lines: [
      "Tools are helpers, but they are not toys. Our grown-up keeps the toolbox safely out of reach.",
      "We can help by making a picture list. Look, our checklist is ready! First, let's find the safe supplies.",
    ].map(text => ({ ...blankLine("dialogue", text), speakerId: host1.characterId })),
  });
  scene1.cameraShots = [onShelf(scene1, 7, 13)];
  scene1.focusGraphics = [
    teaching(scene1, 2, 9, "Tools help grown-ups"),
    teaching(scene1, 12, 11, "Tools are not toys"),
    teaching(scene1, 24, 5, "Picture checklist"),
  ];

  const host2: SceneElement = { ...duplicate(presenter), x: 252, y: 418,
    scale: 1.63, emotion: "happy", motion: "still" };
  host2.animation = workshopHostKeys(host2, [
    [0, -4, -4, "happy"], [3, 6, 27], [7, -5, 18],
    [12, 9, 32], [16, -8, 9], [21, 7, 24],
    [26, -3, 19, "excited"], [29.8, 0, 0],
  ]);
  const list: SceneElement = { ...duplicate(checklist), x: 575, y: 293, rotation: 0 };
  list.animation = { idle: "none", blink: false, keyframes: ([
    [0, 575, 293, 0], [6, 570, 289, -8], [11, 577, 296, 8],
    [17, 568, 291, -6], [23, 574, 288, 5], [29.8, 575, 293, 0],
  ] as const).map(([time, x, y, rotation]) =>
    ({ ...elementBase(list), id: uid(), time, x, y, rotation,
      easing: "ease-in-out" as const })) };
  const scene2 = withScript({
    ...makeScene([], 11), title: "Meet the Tools · 2 — Count Safe Supplies (motion; voice pending)",
    duration: 30, background: "classroom", chapter: "introduction", transition: "cut",
    action: "The host points to three large counting labels while the picture checklist tilts for attention. Children can help count a cloth, a tray, and a checklist while an adult handles all sharp tools.",
    elements: [...scenery.map(duplicate), host2, list],
  }, {
    acting: "Count slowly with the viewer. Acknowledge their choice and offer a pause.",
    emotion: "Encouraging and playful",
    lines: [
      "Let's count our safe helpers. One soft cloth. Two, a little parts tray. Three, our picture checklist.",
      "We don't touch sharp tools, glue, or electrical parts without a grown-up. Which helper can we use right now? The checklist! Great thinking!",
    ].map(text => ({ ...blankLine("dialogue", text), speakerId: host2.characterId })),
  });
  scene2.cameraShots = [
    { ...onShelf(scene2, 5, 12),
      frame: { x: 565, y: 300, zoom: 1.37 },
      note: "Follow the illustrated list as the host counts safe items." },
    { id: uid(), style: "medium", start: 21, end: 28,
      frame: { x: 265, y: 295, zoom: 1.37 }, move: 1,
      targets: [], follow: false, offset: { x: 0, y: 0 },
      placement: "center", note: "Return to the host for the safe-choice reveal." },
  ];
  scene2.focusGraphics = [
    teaching(scene2, 1, 6, "1 · Soft cloth"),
    teaching(scene2, 8, 7, "2 · Parts tray"),
    teaching(scene2, 16, 6, "3 · Picture checklist"),
    teaching(scene2, 23, 6, "Ask a grown-up!"),
  ];

  const room = builtInSound("workshop");
  const paper = builtInSound("paper");
  const place = builtInSound("place");
  const success = builtInSound("success");
  const project: Project = {
    ...before, title: TOOLS_PREVIEW_TITLE, plannedMinutes: 4,
    scenes: [...before.scenes, scene1, scene2],
    audioAssets: [...before.audioAssets, room, paper, place, success],
    lesson: "Use a picture checklist and count safe supplies; adult-only tools are not toys.",
  };
  const sounds = [
    { ...newAudioClip(project, room, "effects", 10, 0), duration: 30, loop: true, volume: 0.10 },
    { ...newAudioClip(project, paper, "effects", 10, 14), volume: 0.55 },
    { ...newAudioClip(project, place, "effects", 10, 18), volume: 0.45 },
    { ...newAudioClip(project, room, "effects", 11, 0), duration: 30, loop: true, volume: 0.10 },
    { ...newAudioClip(project, paper, "effects", 11, 11), volume: 0.48 },
    { ...newAudioClip(project, success, "effects", 11, 26), volume: 0.46 },
  ];
  return validateProject({ ...project, audioClips: [...before.audioClips, ...sounds] });
}
