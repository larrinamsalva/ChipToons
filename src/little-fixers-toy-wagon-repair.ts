import { newFocusGraphic } from "./focus-studio";
import { littleFixersMarkItSafe } from "./little-fixers-mark-it-safe";
import { makeScene, uid, validateProject } from "./model";
import type { Emotion, Project, Scene, SceneElement } from "./model";
import { newAudioClip } from "./production";
import { neutralJoint } from "./puppet-model";
import { blankLine, withScript } from "./script";
import { builtInSound } from "./sounds";
import { elementBase } from "./timeline";
import { newObjectTrack } from "./transform-studio";

export const SCOUT_WAGON_REPAIR_TITLE =
  "Little Fixers Club — Fix the Little Wagon (3:30 original cartoon; new voices pending)";

function fresh(item: SceneElement): SceneElement {
  const next = { ...item, id: uid(), animation: undefined };
  delete next.voiceMouth;
  return next;
}

type Beat = readonly [number, number, number, number, number, number, Emotion];
function animatePerson(actor: SceneElement, beats: readonly Beat[]) {
  actor.animation = { idle: "breathe", blink: true,
    keyframes: beats.map(([time, x, leftLeg, rightLeg, arm, head, emotion]) => ({
      ...elementBase(actor), id: uid(), time, x, emotion,
      easing: "ease-in-out" as const,
      joints: {
        leftLeg: { ...neutralJoint, angle: leftLeg },
        rightLeg: { ...neutralJoint, angle: rightLeg },
        leftArm: { ...neutralJoint, angle: -arm * 0.35 },
        rightArm: { ...neutralJoint, angle: arm },
        head: { ...neutralJoint, angle: head },
      },
    })),
  };
}

function captionCard(scene: Scene, at: number, length: number, text: string) {
  return { ...newFocusGraphic(scene, at), kind: "label" as const,
    text, length, target: { kind: "screen" as const, x: 578, y: 85 } };
}

function wagon(x: number, y: number, fixed = false): SceneElement {
  return {
    id: uid(), kind: "prop", characterId: "", prop: "toy-wagon",
    propAppearance: fixed ? "fixed-wheel" : "loose-wheel",
    name: fixed ? "Child-safe toy wagon with attached wheel" : "Toy wagon with loose, large snap-on wheel",
    x, y, scale: 0.83, rotation: 0, flip: false,
    emotion: "calm", motion: "still",
  };
}

function adultAndScout(project: Project, source: Scene, newScene: 5 | 6) {
  const scoutOriginal = source.elements.find(e => e.characterId === project.characters[0].id);
  const joOriginal = source.elements.find(e => e.characterId === project.characters[1].id);
  if (!scoutOriginal || !joOriginal) throw new Error("Little Fixers actors are missing.");
  const scout = fresh(scoutOriginal), jo = fresh(joOriginal);
  scout.x = 228; scout.y = 381; scout.scale = 1.2; scout.motion = "still";
  jo.x = 440; jo.y = 382; jo.scale = 1.53; jo.motion = "still";
  const first = newScene === 5;
  animatePerson(scout, first ? [
    [0, 228, 0, 0, 4, 0, "happy"],
    [2.0, 238, 15, -15, 18, 2, "happy"],
    [3.3, 256, -15, 15, -18, -4, "surprised"],
    [5.4, 256, 0, 0, 26, 12, "worried"],
    [8.6, 246, 0, 0, -12, -7, "calm"],
    [11, 246, 0, 0, 8, 5, "calm"],
    [14, 246, 0, 0, 35, -9, "calm"],
    [18, 246, 0, 0, 28, 7, "happy"],
    [23.5, 246, 0, 0, 45, -2, "excited"],
    [29.8, 246, 0, 0, 9, 2, "happy"],
  ] : [
    [0, 236, 0, 0, 6, 1, "calm"],
    [3, 236, 0, 0, 26, -7, "calm"],
    [7.1, 244, 0, 0, 34, 6, "happy"],
    [11, 244, 0, 0, 42, -6, "happy"],
    [14.5, 260, 16, -16, 24, 3, "happy"],
    [16, 271, -12, 12, 38, -3, "excited"],
    [20, 271, 0, 0, 52, 7, "excited"],
    [24.5, 271, 0, 0, 50, -3, "happy"],
    [29.8, 271, 0, 0, 18, 0, "happy"],
  ]);
  animatePerson(jo, first ? [
    [0, 440, 0, 0, 11, 1, "happy"],
    [2, 448, 14, -14, 24, -3, "calm"],
    [3.8, 465, -17, 17, 35, 5, "calm"],
    [5.5, 482, 0, 0, 40, -6, "calm"],
    [8, 491, 0, 0, 50, -9, "calm"],
    [10.8, 491, 0, 0, 62, -12, "calm"],
    [13.2, 491, 0, 0, 77, -7, "calm"],
    [15.5, 491, 0, 0, 71, 6, "calm"],
    [17, 491, 0, 0, 47, 3, "happy"],
    [20, 485, 0, 0, 30, 7, "happy"],
    [25, 485, 0, 0, 43, -4, "happy"],
    [29.8, 485, 0, 0, 12, 1, "happy"],
  ] : [
    [0, 469, 0, 0, 5, 0, "calm"],
    [4, 469, 0, 0, 25, -8, "calm"],
    [7, 469, 0, 0, 40, 4, "calm"],
    [10.4, 469, 0, 0, 55, -8, "happy"],
    [14.5, 469, 0, 0, 51, 4, "happy"],
    [18, 469, 0, 0, 38, 8, "happy"],
    [23, 469, 0, 0, 62, -9, "excited"],
    [27.6, 469, 0, 0, 34, 4, "happy"],
    [29.8, 469, 0, 0, 10, 0, "happy"],
  ]);
  return { scout, jo };
}

/**
 * Two genuine new animated scenes: adult-led visual snap-wheel repair followed
 * by a rolling test. The wheel state changes *on the toy wagon itself*, exactly
 * while Helper Jo leans/reaches. This is a simplified cartoon demonstration
 * of a large child-safe snap-on toy, not an instruction to handle a real loose
 * wheel, hardware, damaged furniture, or choking-size parts.
 */
export async function littleFixersToyWagonRepair(): Promise<Project> {
  const previous = await littleFixersMarkItSafe();
  const safeRoom = previous.scenes[4];
  const first = adultAndScout(previous, safeRoom, 5);
  const loose = wagon(584, 392);
  loose.animation = {
    idle: "none", blink: false,
    keyframes: [
      [0, 584, 0], [2, 598, -7], [3.1, 610, 6],
      [4.4, 609, 0], [12, 609, 0], [14.4, 606, -4],
      [15.5, 608, 2], [16.3, 609, 0], [29.8, 609, 0],
    ].map(([time, x, rotation]) => ({
      ...elementBase(loose), id: uid(), time, x, rotation,
      easing: "ease-in-out" as const,
    })),
  };
  const track = newObjectTrack(loose);
  const fixedState = track.states.find(state =>
    state.art.kind === "prop" && state.art.appearance === "fixed-wheel");
  if (!fixedState) throw new Error("Fixed wheel artwork is unavailable.");
  const adjust = {
    id: uid(), kind: "point" as const, actorId: first.jo.id, objectId: loose.id,
    start: 10, attach: 10, finish: 15.5,
    grip: { hand: "right" as const, x: 0, y: 0 },
  };
  const wheelChange = {
    id: uid(), to: fixedState.id, at: 15.5, transition: "fade" as const,
    length: 0.6, sparkle: false,
    cue: { interactionId: adjust.id, moment: "Finish" },
  };
  track.changes = [wheelChange];
  const scene5 = withScript({
    ...makeScene([], 5), duration: 30,
    title: "Repair a large snap-on toy wheel — Helper Jo demonstrates",
    chapter: "exploration", background: "classroom", transition: "cut",
    gentleDepth: true,
    backgroundAnimation: { enabled: true, style: "parallax", keyframes: [] },
    action: "Away from the unsafe chair, Scout notices a loose wheel on a large, child-safe toy wagon and asks Jo. Helper Jo checks the toy, steadies it and presses the large snap-on wheel into place while the actual wheel artwork changes from loose to fixed. No sharp tools, screws or small loose parts. Scout observes from a safe distance.",
    question: "Who should you ask before fixing a toy?",
    elements: [first.scout, first.jo, loose],
    interactions: [adjust], objectTracks: [track],
    cameraShots: [
      { id: uid(), style: "medium", start: 1, end: 7, move: 0.9,
        frame: { x: 427, y: 255, zoom: 1.21 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Scout spots the wobbly toy wagon while Jo stands nearby." },
      { id: uid(), style: "detail", start: 10, end: 17.4, move: 0.75,
        frame: { x: 587, y: 322, zoom: 1.64 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Show Jo's moving hand and the actual toy wheel artwork changing to attached." },
      { id: uid(), style: "wide", start: 19, end: 29.8, move: 0.9,
        frame: { x: 413, y: 224, zoom: 1.08 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Scout and Jo look at the restored toy and prepare to test it." },
    ],
  }, {
    acting: "Jo presses a large toy snap-on wheel in the cartoon as the wheel visibly becomes attached. Scout observes. All new dialogue awaits recording.",
    emotion: "Curious, careful, reassuring",
    lines: [
      { ...blankLine("dialogue", "This little wagon has a wobbly wheel. Can we ask Jo for help?"),
        speakerId: first.scout.characterId },
      { ...blankLine("dialogue", "Yes! This big toy wheel snaps into place with a gentle push. I'll check it first, then we'll test together."),
        speakerId: first.jo.characterId },
    ],
  });
  scene5.focusGraphics = [
    captionCard(scene5, 1.3, 5, "SPOT the loose toy wheel"),
    captionCard(scene5, 6.8, 5, "ASK before fixing"),
    captionCard(scene5, 12, 6.1, "JO gently fits the wheel"),
    captionCard(scene5, 22.5, 6, "READY to test?"),
  ];
  scene5.learningSteps = [
    { id: uid(), text: "Notice the large toy wheel wobble.", at: 2.2, lineId: scene5.script!.lines[0].id },
    { id: uid(), text: "Ask a grown-up before touching broken toys.", at: 7.8 },
    { id: uid(), text: "Watch the wheel visibly become attached as Jo fixes it.", at: 15.5,
      cue: { kind: "change" as const, changeId: wheelChange.id } },
    { id: uid(), text: "Plan a gentle test after Jo checks the toy.", at: 22 },
  ];

  const second = adultAndScout(previous, safeRoom, 6);
  const fixed = wagon(422, 392, true);
  fixed.name = "Repaired child-safe snap-wheel wagon — gentle rolling test";
  fixed.animation = {
    idle: "none", blink: false,
    keyframes: [
      [0, 422, 0], [4.3, 422, 0], [7, 445, -3],
      [10, 510, 2], [13, 565, -2], [16, 620, 0],
      [19, 649, 0], [23, 649, 0], [29.8, 649, 0],
    ].map(([time, x, rotation]) => ({
      ...elementBase(fixed), id: uid(), time, x, rotation,
      easing: "ease-in-out" as const,
    })),
  };
  const scene6 = withScript({
    ...makeScene([], 6), duration: 30,
    title: "Test the toy wagon gently — roll, observe, celebrate",
    chapter: "exploration", background: "classroom", transition: "cut",
    gentleDepth: true,
    backgroundAnimation: { enabled: true, style: "parallax", keyframes: [] },
    action: "Jo has already secured and checked the large toy wheel. Together they gently roll the toy wagon along the clear floor. The repaired wheel remains attached as the real wagon prop moves across the scene; Scout points, smiles and thanks Jo. The unsafe chair in the other room remains off limits.",
    question: "What do you check after a safe toy repair?",
    elements: [second.scout, second.jo, fixed],
    cameraShots: [
      { id: uid(), style: "medium", start: 1.5, end: 7, move: 0.9,
        frame: { x: 433, y: 267, zoom: 1.23 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Jo checks the finished wagon before testing." },
      { id: uid(), style: "follow", start: 7.2, end: 19.5, move: 0.95,
        frame: { x: 555, y: 300, zoom: 1.31 }, targets: [fixed.id],
        follow: true, offset: { x: 0, y: 0 }, placement: "center",
        note: "Follow the actual rolling movement of the repaired toy." },
      { id: uid(), style: "wide", start: 20.3, end: 29.9, move: 1,
        frame: { x: 419, y: 225, zoom: 1.04 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Celebrate thoughtful, grown-up-guided toy repair." },
    ],
  }, {
    acting: "Jo checks the repaired wagon. It genuinely rolls across the stage; Scout turns, points, smiles and celebrates. Dialogue unrecorded.",
    emotion: "Careful, excited and thankful",
    lines: [
      { ...blankLine("dialogue", "Look! The wagon rolls smoothly now. We checked it together!"),
        speakerId: second.scout.characterId },
      { ...blankLine("dialogue", "First we ask for help, then we make a safe fix, and finally we test. Nice teamwork!"),
        speakerId: second.jo.characterId },
    ],
  });
  scene6.focusGraphics = [
    captionCard(scene6, 1.5, 4.7, "CHECK the attached wheel"),
    captionCard(scene6, 8, 7, "ROLL the wagon gently"),
    captionCard(scene6, 17, 5.6, "LOOK: it rolls smoothly"),
    captionCard(scene6, 24.2, 5.3, "THANK your helper!"),
  ];
  scene6.learningSteps = [
    { id: uid(), text: "Check that the toy wheel is attached.", at: 2.1 },
    { id: uid(), text: "Give the wagon a gentle rolling test.", at: 8.0 },
    { id: uid(), text: "Notice how the toy rolls after the safe fix.", at: 17.4 },
    { id: uid(), text: "Thank the helper and put your toys away.", at: 24.8 },
  ];

  const source = (name: string) => previous.audioAssets.find(a => a.name === name);
  const room = source("Subtle workshop activity");
  const success = source("Friendly success cue");
  if (!room || !success) throw new Error("Existing workshop effects are unavailable.");
  const wheelEffect = builtInSound("wheels");
  const notice = builtInSound("notice");
  const project: Project = {
    ...previous, templateId: "little-fixers-scout-wagon-wheel-repair",
    title: SCOUT_WAGON_REPAIR_TITLE, plannedMinutes: 4,
    idea: "The Little Fixers perform a real child-safe snap-on toy wheel repair in two character-driven animated scenes, then test the wagon.",
    lesson: "Spot a problem, ask an adult, observe a gentle large-toy repair, test safely, and thank your helper.",
    scenes: [...previous.scenes, scene5, scene6],
    audioAssets: [...previous.audioAssets, wheelEffect, notice],
  };
  const clips = [
    { ...newAudioClip(project, room, "effects", 5), duration: 30, loop: true, volume: 0.11 },
    { ...newAudioClip(project, notice, "effects", 5, 2.1), volume: 0.32 },
    { ...newAudioClip(project, success, "effects", 5, 16.4), volume: 0.25 },
    { ...newAudioClip(project, room, "effects", 6), duration: 30, loop: true, volume: 0.11 },
    { ...newAudioClip(project, wheelEffect, "effects", 6, 7.2), volume: 0.35 },
    { ...newAudioClip(project, wheelEffect, "effects", 6, 11), volume: 0.31 },
    { ...newAudioClip(project, wheelEffect, "effects", 6, 14.8), volume: 0.29 },
    { ...newAudioClip(project, success, "effects", 6, 23), volume: 0.38 },
  ];
  return validateProject({ ...project, audioClips: [...previous.audioClips, ...clips] });
}
