import { newFocusGraphic } from "./focus-studio";
import { littleFixersToolsPreview } from "./little-fixers-tools";
import { makeScene, uid, validateProject } from "./model";
import type { Asset, Project, Scene, SceneElement } from "./model";
import { workshopHostKeys } from "./picture-demo";
import { newAudioClip } from "./production";
import { blankLine, withScript } from "./script";
import { elementBase } from "./timeline";

export const CLUES_PREVIEW_TITLE =
  "Little Fixers Club — Episode 1: Look for Clues (5-minute motion preview; new voices pending)";

function duplicate(item: SceneElement): SceneElement {
  const next: SceneElement = { ...item, id: uid(), animation: undefined };
  delete next.voiceMouth;
  return next;
}
function textCue(scene: Scene, at: number, length: number, text: string) {
  return { ...newFocusGraphic(scene, at), kind: "label" as const, text, length,
    target: { kind: "screen" as const, x: 578, y: 86 } };
}
function jointCue(scene: Scene, chair: SceneElement, at: number, length: number) {
  return { ...newFocusGraphic(scene, at, { objectId: chair.id }), kind: "circle" as const,
    length, size: 70,
    target: { kind: "object" as const, id: chair.id, x: chair.x, y: chair.y,
      dx: 18, dy: -50 } };
}
function shot(at: number, end: number, x: number, y: number, zoom: number, note: string) {
  return { id: uid(), style: "detail" as const, start: at, end, move: 1,
    frame: { x, y, zoom }, targets: [], follow: false,
    offset: { x: 0, y: 0 }, placement: "center" as const, note };
}

/** Extend real cartoon motion to 5:00 without altering any completed earlier scenes.
 * The newly scripted dialogue is NOT recorded; no fake lip sync or captions.
 * The chair is never used or handled by a child. Actual repair is adult-only.
 */
export async function littleFixersCluesPreview(source: Asset): Promise<Project> {
  const before = await littleFixersToolsPreview(source);
  const previous = before.scenes.at(-1)!;
  const oldHost = previous.elements.find(element => element.characterId);
  if (!oldHost) throw new Error("Little Fixers host was not found.");
  const baseProps = previous.elements.filter(element => !element.characterId &&
    !(element.prop === "book" && element.name === "Picture checklist"));
  const firstProps = baseProps.map(duplicate);
  const chair1 = firstProps.find(element => !!element.assetId);
  if (!chair1) throw new Error("The original wobbly chair artwork was not found.");
  chair1.x = 595; chair1.y = 370; chair1.scale = 1.10; chair1.rotation = 0;
  chair1.animation = { idle: "none", blink: false,
    keyframes: ([
      [0, 595, 0], [8, 595, 0], [10, 592, -2], [12, 599, 2],
      [15, 595, 0], [29.8, 595, 0],
    ] as const).map(([time, x, rotation]) =>
      ({ ...elementBase(chair1), id: uid(), time, x, rotation,
        easing: "ease-in-out" as const })) };
  const host1: SceneElement = { ...duplicate(oldHost), x: 205, y: 420,
    scale: 1.65, motion: "still", emotion: "calm" };
  host1.animation = workshopHostKeys(host1, [
    [0, 0, 1, "happy"], [4, 12, 15], [8, -9, 30, "surprised"],
    [12, 4, 6], [17, 11, 29], [23, -4, 17], [29.8, 0, 2],
  ]);
  const scene1 = withScript({
    ...makeScene([], 12), title: "Look for Clues · 1 — Observe the Chair (motion; voice pending)",
    duration: 30, background: "classroom", chapter: "middle", transition: "cut",
    action: "From a safe distance the host notices a small chair wobble and gestures toward its legs. The chair remains out of use for adult inspection. No child handles it.",
    elements: [...firstProps, host1],
  }, { acting: "Curious and careful; model observing before touching.",
    emotion: "Thoughtful and reassuring", lines: [
      "Here's our mystery: why does the chair wobble? Good fixers begin by noticing clues.",
      "Our chair stays out of use. We look at the legs, and a grown-up will check it. Did you spot a little movement?",
    ].map(text => ({ ...blankLine("dialogue", text), speakerId: host1.characterId })) });
  scene1.focusGraphics = [
    textCue(scene1, 2, 8, "Look for clues"),
    textCue(scene1, 15, 8, "Notice the wobble"),
    textCue(scene1, 25, 4, "Do not sit on it"),
  ];
  scene1.cameraShots = [shot(8, 20, 585, 335, 1.65,
    "Observe the unoccupied chair legs as the chair shifts slightly.")];

  const secondProps = baseProps.map(duplicate);
  const chair2 = secondProps.find(element => !!element.assetId);
  if (!chair2) throw new Error("The original chair was not found in the next scene.");
  chair2.x = 585; chair2.y = 366; chair2.scale = 1.19; chair2.rotation = 0;
  const host2: SceneElement = { ...duplicate(oldHost), x: 205, y: 420,
    scale: 1.65, motion: "still", emotion: "happy" };
  host2.animation = workshopHostKeys(host2, [
    [0, -3, 7, "happy"], [4, 12, 33], [8, -7, 16],
    [13, 8, 31], [19, -6, 11], [25, 12, 28, "excited"],
    [29.8, 0, 0],
  ]);
  const scene2 = withScript({
    ...makeScene([], 13), title: "Look for Clues · 2 — Find the Gap (motion; voice pending)",
    duration: 30, background: "classroom", chapter: "middle", transition: "cut",
    action: "The camera closes in on the joint behind the seat, and a circle shows a possible gap. The host asks the audience what they notice, then points to the safe grown-up inspection choice.",
    elements: [...secondProps, host2],
  }, { acting: "Speak slowly for the close-up and allow a thinking pause.",
    emotion: "Curious and encouraging", lines: [
      "Look where the chair back meets the seat. Do the pieces line up, or can you see a little gap?",
      "A gap is a clue, not a reason to rush. We stop and ask the grown-up to inspect the chair. That's careful observing!",
    ].map(text => ({ ...blankLine("dialogue", text), speakerId: host2.characterId })) });
  scene2.focusGraphics = [
    textCue(scene2, 1, 5, "Look closely"),
    jointCue(scene2, chair2, 8, 9),
    textCue(scene2, 19, 10, "A gap is a clue"),
  ];
  scene2.cameraShots = [
    shot(6, 18, 575, 311, 2.1, "Show the chair's joint and the highlighted potential gap."),
    shot(21, 28, 270, 307, 1.35, "Return to the host for the safe-choice reveal."),
  ];

  // All five sounds already exist in preceding scenes. DO NOT create
  // duplicate audio assets: the original project is near its 24-asset limit.
  const sound = (name: string) => {
    const asset = before.audioAssets.find(a => a.name === name);
    if (!asset) throw new Error("Missing original Little Fixers sound: " + name);
    return asset;
  };
  const room = sound("Subtle workshop activity");
  const paper = sound("Paper folding");
  const place = sound("Wooden object set down");
  const success = sound("Friendly success cue");
  const project: Project = {
    ...before, title: CLUES_PREVIEW_TITLE, plannedMinutes: 5,
    scenes: [...before.scenes, scene1, scene2],
    lesson: "Observe safely, notice clues, and ask a trusted grown-up before attempting a repair.",
  };
  const effects = [
    { ...newAudioClip(project, room, "effects", 12), duration: 30, loop: true, volume: 0.12 },
    { ...newAudioClip(project, place, "effects", 12, 10), volume: 0.44 },
    { ...newAudioClip(project, room, "effects", 13), duration: 30, loop: true, volume: 0.12 },
    { ...newAudioClip(project, paper, "effects", 13, 8), volume: 0.26 },
    { ...newAudioClip(project, success, "effects", 13, 26), volume: 0.40 },
  ];
  return validateProject({ ...project, audioClips: [...before.audioClips, ...effects] });
}
