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
  "Little Fixers Club — Episode 1: Safety First (3-minute animation preview; voice pending)";

function label(scene: Scene, at: number, length: number, text: string, x = 600, y = 100) {
  return { ...newFocusGraphic(scene, at), kind: "label" as const,
    text, length, target: { kind: "screen" as const, x, y } };
}

/**
 * A separate, editable 3:00 movie including the existing 1:59 voiced cartoon.
 * The next 61 seconds contain real character/prop/camera motion and sound effects.
 * The new dialogue is deliberately unrecorded; never claim an approved voice take.
 */
export async function littleFixersSafetyPreview(source: Asset): Promise<Project> {
  const opening = await littleFixersOpening(source);
  const oldScene = opening.scenes[7];
  const oldHost = oldScene.elements.find(element => element.characterId);
  if (!oldHost) throw new Error("The original Little Fixers host is missing.");

  const host: SceneElement = {
    ...oldHost, id: uid(), x: 255, y: 421, scale: 1.65,
    motion: "still", emotion: "happy",
  };
  delete host.voiceMouth;
  host.animation = workshopHostKeys(host, [
    [0, -3, -6, "happy"], [4, 7, 23], [9, -6, 8],
    [15, 10, 21], [19, -8, 28], [24, 2, 4],
    [29, 8, -12], [34, -5, 17], [41, 4, 28],
    [47, -9, 12], [54, 10, 25, "excited"], [60, 0, 0, "happy"],
  ]);

  const props = oldScene.elements.filter(element => !element.characterId)
    .map(element => ({ ...element, id: uid(), animation: undefined }));
  const chair = props.find(element => !!element.assetId);
  if (chair) { chair.x = 735; chair.y = 385; chair.scale = 0.88; }
  const toy: SceneElement = {
    id: uid(), kind: "prop", prop: "toy", name: "Toy blocking the walkway",
    characterId: "", x: 431, y: 412, scale: 0.55, rotation: 0, flip: false,
    emotion: "calm", motion: "still",
  };
  toy.animation = {
    idle: "none", blink: false,
    keyframes: ([
      [0, 431, 412], [14, 431, 412], [18, 450, 385],
      [22, 531, 332], [25, 635, 273], [61, 635, 273],
    ] as const).map(([time, x, y]) =>
      ({ ...elementBase(toy), id: uid(), time, x, y, easing: "ease-in-out" as const })),
  };

  const script = LITTLE_FIXERS_REMAINDER[0];
  const lines = [
    "Welcome back to our workbench. Before we fix anything, safety comes first!",
    "See the toy in our walkway? Watch us move it to a safe spot. A clear floor helps us all.",
    "Tools are not toys. When something is sharp, hot, broken or plugged in, stop and ask a trusted grown-up.",
    "Can you spot our safe, clear path? Great noticing, Little Fixers!",
  ].map(text => ({ ...blankLine("dialogue", text), speakerId: host.characterId }));

  const scene = withScript({
    ...makeScene([], opening.scenes.length),
    title: "Safety First — Clear the Walkway (animated; narration to record)",
    duration: 61, background: "classroom", chapter: "introduction",
    transition: "cut",
    action: "The host notices a toy in the walkway. The toy moves visibly onto a shelf, the camera checks the clear floor, and the host gestures toward a safe work zone. Adults supervise all repairs. Final dialogue needs recording and approval.",
    elements: [...props, host, toy],
  }, { acting: script.direction + " " + script.participation,
    emotion: "Friendly, encouraging safety demonstration", lines });
  scene.focusGraphics = [
    label(scene, 2, 8, "Safety first!", 580, 75),
    label(scene, 13.5, 13, "Look: a blocked walkway", 555, 90),
    label(scene, 26, 10, "A clear path", 600, 90),
    label(scene, 37, 10, "Stop and ask a grown-up", 560, 90),
    label(scene, 51, 9, "Spot the safe path!", 595, 90),
  ];
  scene.cameraShots = [
    { id: uid(), style: "medium", start: 12, end: 26,
      frame: { x: 457, y: 315, zoom: 1.5 }, move: 1.5,
      targets: [], follow: false, offset: { x: 0, y: 0 },
      placement: "center", note: "Show the toy moving away from the walkway." },
    { id: uid(), style: "medium", start: 31, end: 42,
      frame: { x: 630, y: 285, zoom: 1.35 }, move: 1,
      targets: [], follow: false, offset: { x: 0, y: 0 },
      placement: "center", note: "Show shelf and tools without unsafe handling." },
    { id: uid(), style: "medium", start: 47, end: 53,
      frame: { x: 250, y: 320, zoom: 1.35 }, move: 0.5,
      targets: [], follow: false, offset: { x: 0, y: 0 },
      placement: "center", note: "Return to the host's final safety question." },
  ];

  const room = builtInSound("workshop");
  const tidy = builtInSound("sweep");
  const placed = builtInSound("place");
  const cheer = builtInSound("success");
  const project: Project = {
    ...opening, title: SAFETY_PREVIEW_TITLE, plannedMinutes: 3,
    scenes: [...opening.scenes, scene],
    audioAssets: [...opening.audioAssets, room, tidy, placed, cheer],
  };
  const effects = [
    { ...newAudioClip(project, room, "effects", 8, 0), duration: 61, loop: true, volume: 0.12 },
    { ...newAudioClip(project, tidy, "effects", 8, 18), volume: 0.45 },
    { ...newAudioClip(project, placed, "effects", 8, 24.8), volume: 0.55 },
    { ...newAudioClip(project, cheer, "effects", 8, 55), volume: 0.45 },
  ];
  return validateProject({ ...project, audioClips: [...opening.audioClips, ...effects] });
}
