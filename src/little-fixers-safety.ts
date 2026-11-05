import { newFocusGraphic } from "./focus-studio";
import { LITTLE_FIXERS_REMAINDER } from "./little-fixers-remainder-script";
import { littleFixersOpening } from "./little-fixers-opening";
import { makeScene, uid, validateProject } from "./model";
import type { Asset, Project, Scene, SceneElement } from "./model";
import { workshopHostKeys } from "./picture-demo";
import { newAudioClip } from "./production";
import { blankLine, withScript } from "./script";
import { builtInSound } from "./sounds";
import { elementBase } from "./timeline";

export const SAFETY_PREVIEW_TITLE =
  "Little Fixers Club — Episode 1: Safety First (3-minute motion preview; voice to record)";

function label(scene: Scene, at: number, length: number, text: string, x = 600, y = 95) {
  return { ...newFocusGraphic(scene, at), kind: "label" as const,
    text, length, target: { kind: "screen" as const, x, y } };
}

function snapshot(element: SceneElement): SceneElement {
  const copy: SceneElement = { ...element, id: uid(), animation: undefined };
  delete copy.voiceMouth;
  return copy;
}

/**
 * Real reusable animation for the 1:59–3:00 safety lesson. The first 1:59
 * stays identical to PR #25. Two new scenes (31s + 30s) are phone-exportable.
 *
 * The new host dialogue is deliberately UNRECORDED. It must be recorded,
 * approved and independently checked before describing this as fully voiced.
 */
export async function littleFixersSafetyPreview(source: Asset): Promise<Project> {
  const opening = await littleFixersOpening(source);
  const last = opening.scenes[7];
  const originalHost = last.elements.find(element => element.characterId);
  if (!originalHost) throw new Error("The original Little Fixers host is missing.");

  // Retain the original character art and workshop props, with fresh IDs
  // so animations and future edits cannot affect the preceding scenes.
  const scenery = last.elements.filter(element => !element.characterId).map(snapshot);
  const chair = scenery.find(element => !!element.assetId);
  if (chair) { chair.x = 731; chair.y = 380; chair.scale = 0.88; }
  const host1: SceneElement = { ...snapshot(originalHost), x: 255, y: 421, scale: 1.65,
    motion: "still", emotion: "happy" };
  host1.animation = workshopHostKeys(host1, [
    [0, -3, -6, "happy"], [4, 7, 23], [9, -6, 8],
    [15, 10, 21], [19, -8, 28], [24, 2, 4], [30.8, 0, 8],
  ]);
  const toy: SceneElement = {
    id: uid(), kind: "prop", prop: "toy", name: "Toy blocking the walkway",
    characterId: "", x: 431, y: 412, scale: 0.55, rotation: 0, flip: false,
    emotion: "calm", motion: "still",
  };
  toy.animation = { idle: "none", blink: false,
    keyframes: ([
      [0, 431, 412], [14, 431, 412], [18, 450, 385],
      [22, 531, 332], [25, 635, 273], [30.8, 635, 273],
    ] as const).map(([time, x, y]) =>
      ({ ...elementBase(toy), id: uid(), time, x, y, easing: "ease-in-out" as const })),
  };
  const scene1 = withScript({
    ...makeScene([], 8), title: "Safety First · 1 — Clear the Walkway (motion, voice pending)",
    duration: 31, background: "classroom", chapter: "introduction", transition: "cut",
    action: "Host gestures; a toy visibly moves off the walkway and onto the shelf. The damaged chair remains set aside. Spoken lines are written but not recorded.",
    elements: [...scenery, host1, toy],
  }, {
    acting: "Friendly and encouraging; leave time to see the toy move.",
    emotion: "Warm and curious",
    lines: [
      "Welcome back to our workbench. Before we fix anything, safety comes first!",
      "See the toy in our walkway? Watch us move it to a safe spot. A clear floor helps us all.",
    ].map(text => ({ ...blankLine("dialogue", text), speakerId: host1.characterId })),
  });
  scene1.focusGraphics = [
    label(scene1, 2, 9, "Safety first!", 575, 85),
    label(scene1, 13, 13, "Clear the walkway", 575, 85),
    label(scene1, 26, 4, "Safe path", 575, 85),
  ];
  scene1.cameraShots = [
    { id: uid(), style: "medium", start: 12, end: 26,
      frame: { x: 455, y: 310, zoom: 1.45 }, move: 1.5,
      targets: [], follow: false, offset: { x: 0, y: 0 },
      placement: "center", note: "Show the toy moving off the walkway." },
  ];

  const host2: SceneElement = { ...snapshot(originalHost), x: 270, y: 421, scale: 1.65,
    motion: "still", emotion: "calm" };
  host2.animation = workshopHostKeys(host2, [
    [0, 3, -8, "happy"], [4, -7, 17], [10, 8, 24], [16, -6, 8],
    [21, 10, 30], [26, -8, 14, "excited"], [29.8, 0, 0, "happy"],
  ]);
  const safeToy: SceneElement = { ...snapshot(toy), x: 635, y: 273, name: "Toy stored safely" };
  const scene2 = withScript({
    ...makeScene([], 9), title: "Safety First · 2 — Stop and Ask (motion, voice pending)",
    duration: 30, background: "classroom", chapter: "introduction", transition: "cut",
    action: "The camera shows the cleared walkway and the grown-up-only tools. The host points out safe choices and smiles at the viewer. Dialogue still needs a new approved take.",
    elements: [...scenery.map(snapshot), host2, safeToy],
  }, {
    acting: "Warm safety reminder and gentle viewer participation. No tool use by children.",
    emotion: "Calm and reassuring",
    lines: [
      "Tools are not toys. When something is sharp, hot, broken or plugged in, stop and ask a trusted grown-up.",
      "Can you spot our safe, clear path? Great noticing, Little Fixers!",
    ].map(text => ({ ...blankLine("dialogue", text), speakerId: host2.characterId })),
  });
  scene2.focusGraphics = [
    label(scene2, 3, 10, "Tools are not toys", 580, 85),
    label(scene2, 14, 9, "Stop and ask a grown-up", 570, 85),
    label(scene2, 23, 6, "You spotted the safe path!", 565, 85),
  ];
  scene2.cameraShots = [
    { id: uid(), style: "medium", start: 6, end: 13,
      frame: { x: 620, y: 290, zoom: 1.35 }, move: 1,
      targets: [], follow: false, offset: { x: 0, y: 0 },
      placement: "center", note: "Show tools without unsafe handling." },
    { id: uid(), style: "medium", start: 19, end: 25,
      frame: { x: 260, y: 315, zoom: 1.35 }, move: 0.5,
      targets: [], follow: false, offset: { x: 0, y: 0 },
      placement: "center", note: "Return to the host for the final safety choice." },
  ];

  const workshop = builtInSound("workshop");
  const sweep = builtInSound("sweep");
  const placed = builtInSound("place");
  const success = builtInSound("success");
  const project: Project = {
    ...opening, title: SAFETY_PREVIEW_TITLE, plannedMinutes: 3,
    scenes: [...opening.scenes, scene1, scene2],
    audioAssets: [...opening.audioAssets, workshop, sweep, placed, success],
    lesson: "Clear the walkway, keep tools for grown-ups, and stop and ask.",
    // These remaining scenes have unique motion and effects but no approved
    // dialogue takes or synced voice-to-mouth animation yet.
  };
  const effects = [
    { ...newAudioClip(project, workshop, "effects", 8, 0), duration: 31, loop: true, volume: 0.13 },
    { ...newAudioClip(project, sweep, "effects", 8, 18), volume: 0.44 },
    { ...newAudioClip(project, placed, "effects", 8, 24.8), volume: 0.55 },
    { ...newAudioClip(project, workshop, "effects", 9, 0), duration: 30, loop: true, volume: 0.13 },
    { ...newAudioClip(project, success, "effects", 9, 25), volume: 0.43 },
  ];
  return validateProject({ ...project, audioClips: [...opening.audioClips, ...effects] });
}
