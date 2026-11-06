import { newFocusGraphic } from "./focus-studio";
import { littleFixersHelperJoStory } from "./little-fixers-helper-jo-story";
import { makeScene, uid, validateProject } from "./model";
import type { Emotion, Project, Scene, SceneElement } from "./model";
import { newAudioClip } from "./production";
import { neutralJoint } from "./puppet-model";
import { blankLine, withScript } from "./script";
import { elementBase } from "./timeline";

export const SCOUT_MARK_IT_SAFE_TITLE =
  "Little Fixers Club — Mark It Safe (2:30 original cartoon; later dialogue unrecorded)";

function newElement(item: SceneElement): SceneElement {
  // Each new scene owns its keyframes and objects; no existing approval,
  // voice-mouth track or earlier approved motion is changed.
  const result: SceneElement = { ...item, id: uid(), animation: undefined };
  delete result.voiceMouth;
  return result;
}

type Beat = readonly [number, number, number, number, number, number, Emotion];
function poseTrack(actor: SceneElement, beats: readonly Beat[]) {
  actor.animation = {
    idle: "breathe", blink: true,
    keyframes: beats.map(([time, x, leftLeg, rightLeg, arm, head, emotion]) => ({
      ...elementBase(actor), id: uid(), time, x, emotion,
      easing: "ease-in-out" as const,
      joints: {
        head: { ...neutralJoint, angle: head },
        leftLeg: { ...neutralJoint, angle: leftLeg },
        rightLeg: { ...neutralJoint, angle: rightLeg },
        leftArm: { ...neutralJoint, angle: -arm * 0.3 },
        rightArm: { ...neutralJoint, angle: arm },
      },
    })),
  };
}

function lessonCard(scene: Scene, time: number, length: number, text: string) {
  return {
    ...newFocusGraphic(scene, time), kind: "label" as const,
    text, length,
    target: { kind: "screen" as const, x: 577, y: 85 },
  };
}

/**
 * Original child-safe "pre-repair" lesson: stop using a damaged item, tell an
 * adult, and let the adult mark it out of use while planning an inspection.
 * The warning sign truly attaches to Helper Jo's animated hand and is placed
 * BESIDE the chair, not on the damaged furniture. No one tests or repairs it.
 * Dialogue in this scene is deliberately not recorded or voice-simulated.
 */
export async function littleFixersMarkItSafe(): Promise<Project> {
  const previous = await littleFixersHelperJoStory();
  const scene4 = previous.scenes[3];
  const scoutOld = scene4.elements.find(item =>
    item.characterId === previous.characters[0].id);
  const helperOld = scene4.elements.find(item =>
    item.characterId === previous.characters[1].id);
  const chairOld = scene4.elements.find(item => item.prop === "chair");
  if (!scoutOld || !helperOld || !chairOld)
    throw new Error("The existing Scout, Helper Jo or unsafe chair is missing.");

  const scout = newElement(scoutOld);
  scout.x = 277; scout.y = 381; scout.scale = 1.23;
  scout.motion = "still"; scout.emotion = "calm";
  poseTrack(scout, [
    [0, 277, 0, 0, 3, 0, "calm"],
    [3, 283, 0, 0, 32, -5, "happy"],
    [5.5, 283, 0, 0, 49, 11, "calm"],
    [8, 283, 0, 0, 8, -6, "calm"],
    [10, 271, 14, -14, -12, 8, "calm"],
    [11.8, 263, 0, 0, 3, 1, "calm"],
    [15.4, 263, 0, 0, 19, -8, "happy"],
    [19.5, 263, 0, 0, 37, 8, "happy"],
    [24, 263, 0, 0, 11, -2, "happy"],
    [27.7, 263, 0, 0, 42, -5, "excited"],
    [29.8, 263, 0, 0, 5, 0, "happy"],
  ]);

  const helper = newElement(helperOld);
  helper.x = 476; helper.y = 382; helper.scale = 1.54;
  helper.motion = "still"; helper.emotion = "happy";
  poseTrack(helper, [
    [0, 476, 0, 0, 13, 1, "happy"],
    [2, 478, 0, 0, 24, 7, "happy"],
    [4.3, 481, 0, 0, 42, -6, "calm"],
    [6, 486, 13, -13, 20, 2, "calm"],
    [7.3, 498, -13, 13, 34, 1, "calm"],
    [8.5, 509, 0, 0, 58, -8, "calm"],
    [10.7, 513, 0, 0, 50, -3, "happy"],
    [13.5, 518, 0, 0, 41, 7, "happy"],
    [16.5, 518, 0, 0, 54, -9, "calm"],
    [19.5, 518, 0, 0, 22, 3, "calm"],
    [21, 518, 0, 0, 18, -4, "happy"],
    [23.8, 518, 0, 0, 44, 6, "happy"],
    [27.4, 518, 0, 0, 62, -9, "excited"],
    [29.8, 518, 0, 0, 4, 1, "happy"],
  ]);

  const chair = newElement(chairOld);
  chair.x = 723; chair.y = 395; chair.scale = 0.92;
  chair.name = "Wobbly chair remains out of service until a trusted adult inspects it";
  chair.motion = "still";
  chair.animation = undefined;

  const sign: SceneElement = {
    id: uid(), characterId: "", kind: "prop", prop: "sign",
    name: "Out of Use — safety warning sign handled only by Helper Jo",
    x: 488, y: 362, scale: 0.58, rotation: 0,
    flip: false, emotion: "calm", motion: "still",
  };

  const decor = scene4.elements.filter(item =>
    !item.characterId && item.prop !== "chair" &&
    item.prop !== "book").map(newElement);

  const scene = withScript({
    ...makeScene([], 4),
    duration: 30,
    title: "Mark the chair out of use — the first safe repair-planning step",
    chapter: "exploration", background: "classroom", transition: "cut",
    gentleDepth: true,
    backgroundAnimation: {
      enabled: true, style: "parallax", keyframes: [],
    },
    action: "Scout explains that the chair should stay out of use. Helper Jo agrees, walks to collect a warning sign, picks it up with the puppet hand and places it next to the chair, without touching the furniture. Scout stays back and points out the repair plan: notice, stop, label, and ask an adult to inspect.",
    elements: [
      ...decor.filter(item => item.sceneryDepth === "behind"),
      chair, scout, helper, sign,
      ...decor.filter(item => item.sceneryDepth !== "behind"),
    ],
    interactions: [{
      id: uid(), kind: "put",
      actorId: helper.id, objectId: sign.id,
      start: 7.0, attach: 9.0, finish: 23.0,
      grip: { hand: "right", x: 0, y: 1 },
      release: {
        time: 20.4,
        position: { x: 632, y: 385 },
      },
    }],
    cameraShots: [
      {
        id: uid(), style: "medium", start: 2.5, end: 8.0, move: 1.2,
        frame: { x: 430, y: 270, zoom: 1.33 },
        targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Keep Scout and Helper Jo in view as they discuss the unsafe chair.",
      },
      {
        id: uid(), style: "pair", start: 9, end: 22.5, move: 1.2,
        frame: { x: 555, y: 283, zoom: 1.37 },
        targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Show Helper Jo actually holding and placing the safety sign beside the chair.",
      },
      {
        id: uid(), style: "wide", start: 23.1, end: 29.9, move: 0.8,
        frame: { x: 420, y: 232, zoom: 1.06 },
        targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "End with both characters standing clear and the warning sign beside the unused chair.",
      },
    ],
  }, {
    acting: "A child-safe, clearly observable pre-repair step. Jo physically attaches the sign to the puppet hand and sets it down next to, not on, the wobbly chair. No one touches the chair or uses tools. New dialogue remains unrecorded.",
    emotion: "Thoughtful, reassuring, confidently careful",
    lines: [
      { ...blankLine("dialogue",
        "We saw that chair wobble. Let's make sure nobody tries to sit on it."),
        speakerId: scout.characterId },
      { ...blankLine("dialogue",
        "That's right! I'll put our warning sign beside it. First we notice, then stop, mark it, and plan a safe inspection."),
        speakerId: helper.characterId },
    ],
  });
  scene.focusGraphics = [
    lessonCard(scene, 1.2, 5.0, "1. NOTICE a problem"),
    lessonCard(scene, 7.5, 5.0, "2. STOP using it"),
    lessonCard(scene, 14, 7.0, "3. MARK it: OUT OF USE"),
    lessonCard(scene, 23.2, 5.8, "4. PLAN with a grown-up"),
  ];

  const room = previous.audioAssets.find(a => a.name === "Subtle workshop activity");
  const paper = previous.audioAssets.find(a => a.name === "Paper folding");
  const place = previous.audioAssets.find(a => a.name === "Wooden object set down");
  const reassure = previous.audioAssets.find(a => a.name === "Reassuring chimes");
  if (!room || !paper || !place || !reassure)
    throw new Error("Existing safe workshop sound sources are missing.");
  const project: Project = {
    ...previous,
    templateId: "little-fixers-mark-it-safe",
    title: SCOUT_MARK_IT_SAFE_TITLE, plannedMinutes: 3,
    idea: "Two original full-body cartoon characters demonstrate how to recognize and mark unsafe furniture before a grown-up plans repairs.",
    lesson: "Spot a problem, stop using unsafe furniture, warn others, and make a repair plan with a trusted adult.",
    scenes: [...previous.scenes, scene],
  };
  const clips = [
    { ...newAudioClip(project, room, "effects", 4), duration: 30, loop: true, volume: 0.13 },
    { ...newAudioClip(project, paper, "effects", 4, 9.2), volume: 0.39 },
    { ...newAudioClip(project, place, "effects", 4, 20.4), volume: 0.44 },
    { ...newAudioClip(project, reassure, "effects", 4, 26.5), volume: 0.34 },
  ];
  return validateProject({
    ...project, audioClips: [...previous.audioClips, ...clips],
  });
}
