import { newFocusGraphic } from "./focus-studio";
import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { littleFixersWobblyChairStory } from "./little-fixers-wobbly-chair-story";
import { makeScene, uid, validateProject } from "./model";
import type { Emotion, Project, Scene, SceneElement } from "./model";
import { newAudioClip } from "./production";
import { neutralJoint } from "./puppet-model";
import { blankLine, withScript } from "./script";
import { builtInSound } from "./sounds";
import { elementBase } from "./timeline";

export const SCOUT_HELPER_JO_TITLE =
  "Little Fixers Club — Scout Asks Helper Jo (2-minute original cartoon; new voices pending)";

function freshElement(item: SceneElement): SceneElement {
  // Existing project scenes, voice approvals and mouth tracks never change.
  const result: SceneElement = { ...item, id: uid(), animation: undefined };
  delete result.voiceMouth;
  return result;
}

function titleCue(scene: Scene, start: number, length: number, text: string) {
  return { ...newFocusGraphic(scene, start), kind: "label" as const,
    text, length, target: { kind: "screen" as const, x: 581, y: 86 } };
}

type Beat = readonly [number, number, number, number, number, number, Emotion];

function animateActor(element: SceneElement, beats: readonly Beat[]) {
  element.animation = {
    idle: "breathe", blink: true,
    keyframes: beats.map(([time, x, leftLeg, rightLeg, rightArm, head, emotion]) => ({
      ...elementBase(element), id: uid(), time, x, emotion,
      easing: "ease-in-out" as const,
      joints: {
        head: { ...neutralJoint, angle: head },
        leftLeg: { ...neutralJoint, angle: leftLeg },
        rightLeg: { ...neutralJoint, angle: rightLeg },
        leftArm: { ...neutralJoint, angle: -rightArm * 0.4 },
        rightArm: { ...neutralJoint, angle: rightArm },
      },
    })),
  };
}

/**
 * First genuine two-character original Little Fixers story. Helper Jo walks
 * in, listens to Scout, and receives a real checklist through the existing
 * animated puppet hand-to-hand transfer. Neither approaches or repairs the
 * unsafe chair. Jo's new voice is intentionally unrecorded, not faked.
 */
export async function littleFixersHelperJoStory(): Promise<Project> {
  const previous = await littleFixersWobblyChairStory();
  const previousScene = previous.scenes[2];
  const scoutOriginal = previousScene.elements.find(e => e.characterId === previous.characters[0].id);
  const chairOriginal = previousScene.elements.find(e => e.prop === "chair");
  const checklistOriginal = previous.scenes[1].elements.find(e => e.prop === "book");
  if (!scoutOriginal || !chairOriginal || !checklistOriginal)
    throw new Error("Scout, chair or checklist from the original story is missing.");

  // Independent, genuine vector puppet with a visibly taller adult size,
  // distinct wardrobe and its own rig. No imported picture or look-alike
  // voice: the lines below await human recordings.
  const helper = fullBodyWorkshopCharacter();
  helper.name = "Helper Jo — Trusted Grown-Up";
  helper.shirt = "#954c68";
  helper.hair = "#3c2947";
  helper.skin = "#bf876a";
  helper.puppet!.description =
    "Original larger full-body grown-up helper with mauve work clothes, tool belt and dark boots; no picture cutout.";

  const scout = freshElement(scoutOriginal);
  scout.x = 296; scout.y = 381; scout.scale = 1.21;
  scout.motion = "still"; scout.emotion = "calm";
  animateActor(scout, [
    [0, 296, 0, 0, 6, 2, "calm"],
    [2.8, 304, 0, 0, 22, 4, "happy"],
    [5.6, 307, 0, 0, 45, -6, "happy"],
    [8.5, 311, 0, 0, 19, 2, "calm"],
    [11.3, 311, 0, 0, 32, 13, "calm"],
    [13.5, 311, 0, 0, 58, -6, "happy"],
    [16.5, 311, 0, 0, 47, 0, "happy"],
    [19.7, 311, 0, 0, 8, -4, "calm"],
    [23.8, 311, 0, 0, -5, 8, "happy"],
    [28.5, 311, 0, 0, 33, -2, "excited"],
    [29.8, 311, 0, 0, 6, 3, "happy"],
  ]);

  const jo: SceneElement = {
    ...freshElement(scoutOriginal),
    characterId: helper.id, kind: "character",
    x: 790, y: 382, scale: 1.54, rotation: 0,
    flip: false, emotion: "happy", motion: "still",
    sceneryDepth: undefined,
  };
  animateActor(jo, [
    [0, 790, 0, 0, 0, 0, "happy"],
    [1.2, 764, 19, -19, -13, 2, "happy"],
    [2.4, 720, -22, 22, 14, -3, "happy"],
    [3.7, 678, 20, -20, -15, 4, "happy"],
    [5, 638, -20, 20, 19, -6, "happy"],
    [6.2, 602, 19, -19, -13, 1, "happy"],
    [7.5, 568, -19, 19, 16, 2, "happy"],
    [8.7, 545, 0, 0, 5, -7, "calm"],
    [11, 544, 0, 0, 16, 9, "calm"],
    [13.7, 543, 0, 0, 44, -7, "happy"],
    [16.3, 542, 0, 0, 57, 4, "happy"],
    [19.8, 542, 0, 0, 28, -10, "calm"],
    [23.3, 541, 0, 0, 42, 9, "calm"],
    [26.3, 541, 0, 0, 61, -5, "happy"],
    [29.8, 541, 0, 0, 12, 0, "happy"],
  ]);

  // The chair remains out of use. It is never a movable story object,
  // never held by a child and never used for a demonstration repair.
  const chair = freshElement(chairOriginal);
  chair.x = 708; chair.y = 397; chair.scale = 0.92;
  chair.name = "Unsafe chair — do not use until inspected by an adult";
  chair.motion = "still"; chair.emotion = "calm";

  const book = freshElement(checklistOriginal);
  book.x = 373; book.y = 367; book.scale = 0.46;
  book.name = "Scout's picture safety checklist";
  book.kind = "prop"; book.prop = "book";
  book.sceneryDepth = undefined;

  const decor = previousScene.elements.filter(e =>
    !e.characterId && e.prop !== "chair" && e.prop !== "book").map(freshElement);
  const scene = withScript({
    ...makeScene([], 3), duration: 30,
    title: "Scout gives Helper Jo the checklist — a safe grown-up handoff",
    chapter: "exploration", background: "classroom", transition: "cut",
    gentleDepth: true,
    backgroundAnimation: { enabled: true, style: "parallax", keyframes: [] },
    action: "Scout remains far from a wobbly chair. The trusted grown-up Helper Jo walks over. Scout explains the problem and hands over a picture checklist through actual moving puppet hands. Jo listens, nods and keeps the chair off limits pending an adult inspection. No repair or chair testing is shown.",
    elements: [
      ...decor.filter(e => e.sceneryDepth === "behind"),
      chair, scout, jo, book,
      ...decor.filter(e => e.sceneryDepth !== "behind"),
    ],
    interactions: [{
      id: uid(), kind: "give", actorId: scout.id, objectId: book.id,
      start: 10.6, attach: 12.1, finish: 22.4,
      grip: { hand: "right", x: 4, y: -5 },
      transfer: { time: 16.2, actorId: jo.id,
        grip: { hand: "left", x: 0, y: 2 } },
    }],
    cameraShots: [
      { id: uid(), style: "follow", start: 0.9, end: 8.4, move: 1.3,
        frame: { x: 610, y: 236, zoom: 1.2 },
        targets: [jo.id], follow: true, offset: { x: 0, y: 0 },
        placement: "center", note: "Follow Jo's actual alternating-leg entrance." },
      { id: uid(), style: "pair", start: 9.2, end: 20.5, move: 1.2,
        frame: { x: 437, y: 257, zoom: 1.35 }, targets: [],
        follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Show Scout and Jo together, including genuine hand-to-hand checklist transfer." },
      { id: uid(), style: "wide", start: 21, end: 29.9, move: 1,
        frame: { x: 423, y: 225, zoom: 1.03 }, targets: [],
        follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Show both standing safely away from the unused chair." },
    ],
  }, {
    acting: "Jo enters with full-body steps. Scout waves, hands over the checklist and smiles when Jo listens. Both remain away from the unstable chair. Dialogue is written but UNRECORDED.",
    emotion: "Welcoming, concerned, helpful, calm",
    lines: [
      { ...blankLine("dialogue",
        "I noticed our chair wobbling, so I stepped back. Jo, can you help me keep everyone safe?"),
        speakerId: scout.characterId },
      { ...blankLine("dialogue",
        "Good job stopping and asking! We won't use that chair until a grown-up checks it. Thank you for telling me."),
        speakerId: helper.id },
    ],
  });
  scene.focusGraphics = [
    titleCue(scene, 2, 5, "Here comes Helper Jo!"),
    titleCue(scene, 10.8, 5, "Show Jo the picture plan"),
    titleCue(scene, 17, 5.5, "Jo listens and helps"),
    titleCue(scene, 24, 5.3, "The chair stays off limits"),
  ];

  const room = previous.audioAssets.find(a => a.name === "Subtle workshop activity");
  const steps = previous.audioAssets.find(a => a.name === "Little footsteps");
  const success = previous.audioAssets.find(a => a.name === "Friendly success cue");
  if (!room || !steps || !success)
    throw new Error("Previous Little Fixers effects are missing.");
  const reassure = builtInSound("reassure");
  const project: Project = {
    ...previous,
    templateId: "little-fixers-scout-helper-jo-handoff",
    title: SCOUT_HELPER_JO_TITLE,
    plannedMinutes: 2,
    lesson: "When something is unsafe, tell a trusted grown-up and keep others away from it.",
    idea: "An original character-led cartoon: Scout notices a chair problem and safely asks a caring adult for help.",
    characters: [...previous.characters, helper],
    scenes: [...previous.scenes, scene],
    audioAssets: [...previous.audioAssets, reassure],
  };
  const clips = [
    { ...newAudioClip(project, room, "effects", 3), duration: 30, loop: true, volume: 0.13 },
    { ...newAudioClip(project, steps, "effects", 3, 1), duration: 7.5, loop: true, volume: 0.22 },
    { ...newAudioClip(project, reassure, "effects", 3, 20), volume: 0.31 },
    { ...newAudioClip(project, success, "effects", 3, 27.3), volume: 0.28 },
  ];
  return validateProject({ ...project, audioClips: [...previous.audioClips, ...clips] });
}
