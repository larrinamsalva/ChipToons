import { newFocusGraphic } from "./focus-studio";
import { littleFixersToyWagonRepair } from "./little-fixers-toy-wagon-repair";
import { makeScene, uid, validateProject } from "./model";
import type { Emotion, Project, Scene, SceneElement } from "./model";
import { newAudioClip } from "./production";
import { neutralJoint } from "./puppet-model";
import { blankLine, withScript } from "./script";
import { elementBase } from "./timeline";

export const SCOUT_TIDY_WORKSHOP_TITLE =
  "Little Fixers Club — Tidy Up Together (4:30 original cartoon; newer voices unrecorded)";

function independent(item: SceneElement): SceneElement {
  const result: SceneElement = { ...item, id: uid(), animation: undefined };
  delete result.voiceMouth;
  return result;
}

function prop(name: NonNullable<SceneElement["prop"]>, x: number, y: number,
  scale: number, depth?: SceneElement["sceneryDepth"]): SceneElement {
  return { id: uid(), name: "Workshop " + name.replaceAll("-", " "),
    kind: "prop", characterId: "", prop: name,
    x, y, scale, rotation: 0, flip: false, emotion: "calm",
    motion: "still", ...(depth ? { sceneryDepth: depth } : {}) };
}

type Beat = readonly [number, number, number, number, number, number, Emotion];
function act(item: SceneElement, beats: readonly Beat[]) {
  item.animation = { idle: "breathe", blink: true,
    keyframes: beats.map(([time, x, leftLeg, rightLeg, arm, head, emotion]) => ({
      ...elementBase(item), id: uid(), time, x, emotion,
      easing: "ease-in-out" as const,
      joints: {
        leftLeg: { ...neutralJoint, angle: leftLeg },
        rightLeg: { ...neutralJoint, angle: rightLeg },
        leftArm: { ...neutralJoint, angle: -arm * 0.4 },
        rightArm: { ...neutralJoint, angle: arm },
        head: { ...neutralJoint, angle: head },
      },
    })),
  };
}

function label(scene: Scene, at: number, length: number, text: string) {
  return { ...newFocusGraphic(scene, at), kind: "label" as const,
    text, length, target: { kind: "screen" as const, x: 577, y: 86 } };
}

function cast(p: Project, oldScene: Scene) {
  const scoutOld = oldScene.elements.find(e => e.characterId === p.characters[0].id);
  const joOld = oldScene.elements.find(e => e.characterId === p.characters[1].id);
  if (!scoutOld || !joOld || !p.characters[0].puppet || !p.characters[1].puppet)
    throw new Error("Existing original full-body Scout and Helper Jo are missing.");
  const scout = independent(scoutOld), jo = independent(joOld);
  scout.x = 212; scout.y = 381; scout.scale = 1.20; scout.motion = "still";
  scout.emotion = "happy";
  jo.x = 424; jo.y = 382; jo.scale = 1.53; jo.motion = "still";
  jo.emotion = "happy";
  return { scout, jo };
}

/**
 * Two new vector-animation scenes preserve the first seven scenes exactly.
 * The child carries ONLY a picture checklist to a low table. The adult alone
 * returns the toolbox to a higher shelf; no tool use or unsafe chair repair.
 * In the next scene the FIXED toy wagon genuinely travels to its parking spot
 * while both original rigged cartoon characters walk beside it.
 */
export async function littleFixersTidyWorkshop(): Promise<Project> {
  const previous = await littleFixersToyWagonRepair();
  const last = previous.scenes[6];

  // Scene 8: two simultaneous, separately owned hand-attached put-down actions.
  const first = cast(previous, last);
  act(first.scout, [
    [0, 212, 0, 0, 9, 0, "happy"],
    [2.3, 232, 18, -18, -12, -4, "happy"],
    [4.1, 257, -20, 20, 18, 4, "happy"],
    [5.8, 268, 0, 0, 43, -7, "calm"],
    [7.5, 293, 18, -18, -13, 4, "calm"],
    [9.2, 327, -18, 18, 18, -6, "calm"],
    [11.3, 362, 19, -19, -15, 3, "calm"],
    [13.3, 393, -14, 14, 25, -8, "calm"],
    [15.5, 426, 0, 0, 49, -5, "happy"],
    [18.5, 426, 0, 0, 12, 5, "happy"],
    [23.8, 426, 0, 0, 40, -7, "happy"],
    [29.8, 426, 0, 0, 9, 2, "happy"],
  ]);
  act(first.jo, [
    [0, 424, 0, 0, 9, 0, "calm"],
    [2.8, 440, -18, 18, 21, 3, "happy"],
    [5.3, 466, 20, -20, -11, -5, "happy"],
    [7.6, 486, 0, 0, 35, -8, "calm"],
    [10, 512, 17, -17, 44, -5, "calm"],
    [12.8, 548, -18, 18, 22, 8, "calm"],
    [15.2, 580, 20, -20, 31, -4, "calm"],
    [18.5, 615, 0, 0, 53, -8, "calm"],
    [21.5, 615, 0, 0, 65, -10, "happy"],
    [24.5, 615, 0, 0, 16, 3, "happy"],
    [29.8, 615, 0, 0, 45, 0, "excited"],
  ]);

  const lowTable = prop("table", 522, 362, 0.90, "behind");
  const adultShelf = prop("shelf", 715, 296, 1.03, "behind");
  const picturePlan = prop("book", 264, 376, 0.46);
  picturePlan.name = "Scout's picture checklist — safe paper activity";
  const adultToolbox = prop("toolbox", 482, 375, 0.54);
  adultToolbox.name = "Helper Jo's adult-only toolbox — closed and secured";
  const repairedToy = prop("toy-wagon", 123, 399, 0.67, "front");
  repairedToy.propAppearance = "fixed-wheel";
  repairedToy.name = "Parked child-safe repaired wagon with attached wheel";

  const childPut = {
    id: uid(), kind: "put" as const,
    actorId: first.scout.id, objectId: picturePlan.id,
    start: 4.5, attach: 6.1, finish: 17.8,
    grip: { hand: "right" as const, x: 0, y: 0 },
    release: { time: 15.5, position: { x: 504, y: 344 } },
  };
  const adultPut = {
    id: uid(), kind: "put" as const,
    actorId: first.jo.id, objectId: adultToolbox.id,
    start: 7, attach: 9.4, finish: 25,
    grip: { hand: "right" as const, x: 0, y: 0 },
    release: { time: 21.5, position: { x: 698, y: 290 } },
  };
  const tidy = withScript({
    ...makeScene([], 7), duration: 30,
    title: "Different helpers, different jobs — put everything in its place",
    chapter: "exploration", background: "classroom", transition: "cut",
    gentleDepth: true,
    backgroundAnimation: { enabled: true, style: "parallax", keyframes: [] },
    action: "With the repaired toy nearby and the damaged chair still off limits elsewhere, Scout walks the picture checklist to a low table and puts it down using a genuine moving puppet hand. Helper Jo separately carries the CLOSED adult toolbox to a high, adult-only shelf. Scout does not handle tools. Both stop, release their own objects and smile at the clear workspace.",
    elements: [lowTable, adultShelf, first.scout, first.jo, picturePlan, adultToolbox, repairedToy],
    interactions: [childPut, adultPut],
    cameraShots: [
      { id: uid(), style: "medium", start: 0.5, end: 8.4, move: 0.9,
        frame: { x: 398, y: 258, zoom: 1.21 }, targets: [],
        follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Scout reaches for the safe paper checklist while Jo handles the adult-only toolbox." },
      { id: uid(), style: "pair", start: 10, end: 22.3, move: 1.0,
        frame: { x: 526, y: 262, zoom: 1.25 }, targets: [],
        follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Actually show two hand-attached objects moving and releasing in different places." },
      { id: uid(), style: "wide", start: 23, end: 29.9, move: 0.7,
        frame: { x: 424, y: 224, zoom: 1.04 }, targets: [],
        follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Clear tabletop, secured adult shelf and parked repaired toy." },
    ],
  }, {
    acting: "Scout walks and returns the picture plan to the child-level table. Jo moves the closed toolbox to the adult-only shelf. Both objects follow animated hands. No child touches adult tools. Dialogue is written but not recorded.",
    emotion: "Responsible and satisfied",
    lines: [
      { ...blankLine("dialogue", "I can put our picture plan back on the table. That is a safe job for me!"),
        speakerId: first.scout.characterId },
      { ...blankLine("dialogue", "And I'll put the grown-up toolbox away. We each have safe jobs, and our workspace stays tidy."),
        speakerId: first.jo.characterId },
    ],
  });
  tidy.focusGraphics = [
    label(tidy, 0.8, 5.8, "EVERYONE has a safe job"),
    label(tidy, 7, 6, "SCOUT: picture plan"),
    label(tidy, 15.2, 6.7, "JO: adult-only toolbox"),
    label(tidy, 24, 5.2, "PUT things back"),
  ];
  tidy.learningSteps = [
    { id: uid(), text: "Choose a child-safe tidy-up job.", at: 2.1 },
    { id: uid(), text: "Carry and put down the picture checklist.", at: 6.1,
      cue: { kind: "action", interactionId: childPut.id, moment: "Attach" } },
    { id: uid(), text: "Let the adult return their tools to storage.", at: 9.4,
      cue: { kind: "action", interactionId: adultPut.id, moment: "Attach" } },
    { id: uid(), text: "Look at the clear work surface.", at: 25 },
  ];

  // Scene 9: never use the unsafe chair; park the already checked toy.
  const second = cast(previous, last);
  second.scout.x = 176;
  second.jo.x = 382;
  act(second.scout, [
    [0, 176, 0, 0, 9, 0, "happy"],
    [2.5, 192, 17, -17, 19, -3, "happy"],
    [4, 216, -18, 18, -12, 3, "happy"],
    [6.2, 244, 20, -20, 18, -5, "happy"],
    [8.5, 276, -19, 19, -15, 4, "happy"],
    [11, 309, 18, -18, 16, -6, "happy"],
    [14.8, 333, -17, 17, 33, 2, "happy"],
    [18.8, 355, 0, 0, 38, -7, "excited"],
    [21.5, 355, 0, 0, 54, 5, "excited"],
    [26.5, 355, 0, 0, 41, -6, "happy"],
    [29.8, 355, 0, 0, 3, 0, "happy"],
  ]);
  act(second.jo, [
    [0, 382, 0, 0, 11, 2, "happy"],
    [3, 397, -16, 16, 28, -5, "happy"],
    [5.5, 430, 17, -17, -10, 4, "happy"],
    [8.5, 472, -18, 18, 18, -4, "happy"],
    [11.5, 512, 18, -18, 24, 7, "happy"],
    [15.2, 548, -19, 19, 44, -7, "happy"],
    [18.6, 569, 0, 0, 37, 7, "happy"],
    [23.8, 569, 0, 0, 56, -4, "excited"],
    [28.2, 569, 0, 0, 27, 4, "happy"],
    [29.8, 569, 0, 0, 8, 0, "happy"],
  ]);
  const wagon = prop("toy-wagon", 255, 389, 0.81);
  wagon.propAppearance = "fixed-wheel";
  wagon.name = "Child-safe fixed-wheel wagon rolling to its parking place after adult check";
  wagon.animation = {
    idle: "none", blink: false,
    keyframes: [
      [0, 255, 0], [3, 255, 0], [5, 269, -3], [8, 329, 2],
      [11, 387, -2], [14.5, 452, 1], [18.4, 526, -1],
      [21.3, 585, 0], [24, 617, 0], [29.8, 617, 0],
    ].map(([time, x, rotation]) => ({
      ...elementBase(wagon), id: uid(), time, x, rotation,
      easing: "ease-in-out" as const,
    })),
  };
  const parking = prop("sign", 708, 375, 0.60, "behind");
  parking.name = "Toy parking spot — safe clean play area";
  const shelf = prop("shelf", 760, 295, 0.70, "behind");
  const finish = withScript({
    ...makeScene([], 8), duration: 30,
    title: "Park the fixed wagon and celebrate doing the job safely",
    chapter: "exploration", background: "classroom", transition: "cut",
    gentleDepth: true,
    backgroundAnimation: { enabled: true, style: "parallax", keyframes: [] },
    action: "After Helper Jo verifies the large wheel remains secure, the fixed-wheel toy wagon actually rolls toward its designated parking place. Scout and Jo walk alongside on their own alternating-leg animation tracks, then slow down and gesture as the wagon stops. The damaged chair remains marked out of use in its separate area. They thank each other for spotting, asking, fixing a safe toy, checking and tidying.",
    elements: [parking, shelf, second.scout, second.jo, wagon],
    cameraShots: [
      { id: uid(), style: "medium", start: 0.6, end: 5, move: 0.7,
        frame: { x: 392, y: 251, zoom: 1.21 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Begin on the genuinely fixed wheel, not a text-only story slide." },
      { id: uid(), style: "follow", start: 5.5, end: 21.2, move: 0.95,
        frame: { x: 515, y: 283, zoom: 1.22 }, targets: [wagon.id],
        follow: true, offset: { x: 0, y: 0 }, placement: "center",
        note: "Track the actually rolling original wagon with independently walking Scouts and Jo." },
      { id: uid(), style: "wide", start: 22, end: 29.9, move: 0.9,
        frame: { x: 427, y: 226, zoom: 1.04 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Wagon parks, characters stop and exchange a real animated wave." },
    ],
  }, {
    acting: "A final choreographed full-body walk with the moving wagon, then stop, point, smile and wave. No unapproved voice is played.",
    emotion: "Proud and thoughtful",
    lines: [
      { ...blankLine("dialogue", "The wagon goes back in its spot! And we always keep broken things marked until a grown-up checks them."),
        speakerId: second.scout.characterId },
      { ...blankLine("dialogue", "Nice work! We noticed, asked, fixed a safe toy, tested it, and cleaned up together."),
        speakerId: second.jo.characterId },
    ],
  });
  finish.focusGraphics = [
    label(finish, 1, 5.5, "FIXED WHEEL checked"),
    label(finish, 7.5, 7, "ROLL to the toy parking spot"),
    label(finish, 17, 5.8, "PARK the toy"),
    label(finish, 24, 5, "CLEAN UP together"),
  ];
  finish.learningSteps = [
    { id: uid(), text: "Confirm the large toy wheel is attached.", at: 1.5 },
    { id: uid(), text: "Walk with the rolling toy to its parking area.", at: 8.3 },
    { id: uid(), text: "Stop the wagon in its spot.", at: 23 },
    { id: uid(), text: "Remember: an unsafe chair stays out of use for an adult.", at: 26 },
  ];

  const findSound = (name: string) => previous.audioAssets.find(a => a.name === name);
  const room = findSound("Subtle workshop activity");
  const paper = findSound("Paper folding");
  const place = findSound("Wooden object set down");
  const wheels = findSound("Toy wheels rolling");
  const success = findSound("Friendly success cue");
  const steps = findSound("Little footsteps");
  if (!room || !paper || !place || !wheels || !success || !steps)
    throw new Error("Previously approved original workshop sounds are missing.");
  const project: Project = {
    ...previous,
    templateId: "little-fixers-scout-tidy-and-park",
    title: SCOUT_TIDY_WORKSHOP_TITLE,
    plannedMinutes: 5,
    idea: "A character-led learning cartoon: a child puts away a safe picture plan, an adult returns their tools, and the repaired toy rolls to its parking spot.",
    lesson: "Keep adult tools with adults. Return paper plans and toys after a safe grown-up-guided repair. Leave unsafe items out of use.",
    scenes: [...previous.scenes, tidy, finish],
  };
  const clips = [
    { ...newAudioClip(project, room, "effects", 7), duration: 30, loop: true, volume: 0.12 },
    { ...newAudioClip(project, steps, "effects", 7, 2), duration: 11.5, loop: true, volume: 0.16 },
    { ...newAudioClip(project, paper, "effects", 7, 15.5), volume: 0.35 },
    { ...newAudioClip(project, place, "effects", 7, 21.5), volume: 0.42 },
    { ...newAudioClip(project, room, "effects", 8), duration: 30, loop: true, volume: 0.11 },
    { ...newAudioClip(project, wheels, "effects", 8, 6.2), volume: 0.29 },
    { ...newAudioClip(project, wheels, "effects", 8, 11.7), volume: 0.27 },
    { ...newAudioClip(project, wheels, "effects", 8, 17.4), volume: 0.25 },
    { ...newAudioClip(project, success, "effects", 8, 25.2), volume: 0.36 },
  ];
  return validateProject({
    ...project, audioClips: [...previous.audioClips, ...clips],
  });
}
