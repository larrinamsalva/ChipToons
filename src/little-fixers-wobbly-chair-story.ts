import { newFocusGraphic } from "./focus-studio";
import { littleFixersScoutActing } from "./little-fixers-scout-acting";
import { makeScene, uid, validateProject } from "./model";
import type { Emotion, Project, Scene, SceneElement } from "./model";
import { newAudioClip } from "./production";
import { neutralJoint } from "./puppet-model";
import { blankLine, withScript } from "./script";
import { elementBase } from "./timeline";

export const SCOUT_WOBBLY_CHAIR_TITLE =
  "Little Fixers Club — The Wobbly Chair (90-second original cartoon; later scenes need voices)";

function copyForNewScene(item: SceneElement): SceneElement {
  const result: SceneElement = { ...item, id: uid(), animation: undefined };
  delete result.voiceMouth;
  return result;
}

function teachingLabel(scene: Scene, at: number, length: number, text: string) {
  return { ...newFocusGraphic(scene, at), kind: "label" as const,
    text, length, target: { kind: "screen" as const, x: 571, y: 92 } };
}

/**
 * One continuous 90-second original 2.5D cartoon storyline. The first 60
 * seconds remain the original approved voice and object-acting performances;
 * the NEW 30-second scene contains genuinely animated chair wobble and Scout's
 * body/face reactions but has deliberately UNRECORDED dialogue.
 *
 * Safety: Scout never sits on, repairs, tests, or touches the unsafe chair.
 */
export async function littleFixersWobblyChairStory(): Promise<Project> {
  const previous = await littleFixersScoutActing();
  const prior = previous.scenes[1];
  const originalScout = prior.elements.find(item => item.characterId === previous.characters[0].id);
  if (!originalScout) throw new Error("The original Scout workshop character is missing.");
  const scout = copyForNewScene(originalScout);
  scout.x = 192;
  scout.y = 381;
  scout.scale = 1.25;
  scout.emotion = "happy";
  scout.motion = "still";

  // Real keyframed full-body performance: Scout walks forward, notices the
  // unexpected wobble, freezes, backs away, pauses, and points. Avoid any
  // animation that depicts a child trying to fix an unstable piece of furniture.
  const acting: readonly (readonly [
    number, number, number, number, number, number, Emotion
  ])[] = [
    [0, 192, 0, 0, -8, 0, "happy"],
    [1.1, 210, 16, -16, 17, 2, "happy"],
    [2.1, 237, -18, 18, -14, -3, "happy"],
    [3.1, 263, 19, -19, 17, 1, "happy"],
    [4.1, 290, -20, 20, -18, 3, "happy"],
    [5.2, 313, 17, -17, 15, -4, "happy"],
    [6.5, 323, 0, 0, 10, 12, "calm"],
    [8.1, 323, 0, 0, -16, -10, "surprised"],
    [9.4, 322, 0, 0, -35, 16, "worried"],
    [11.1, 301, -13, 13, -20, -7, "worried"],
    [12.4, 286, 13, -13, -12, 6, "calm"],
    [13.8, 286, 0, 0, 4, -6, "calm"],
    [16, 286, 0, 0, 40, -8, "calm"],
    [19.5, 286, 0, 0, 48, 8, "happy"],
    [23.5, 286, 0, 0, -6, 10, "happy"],
    [26, 286, 0, 0, 35, -4, "excited"],
    [29.8, 286, 0, 0, 7, 0, "happy"],
  ];
  scout.animation = {
    idle: "breathe", blink: true,
    keyframes: acting.map(([time, x, leftLeg, rightLeg, rightArm, head, emotion]) => ({
      ...elementBase(scout), id: uid(), time, x, emotion,
      easing: "ease-in-out" as const,
      joints: {
        leftLeg: { ...neutralJoint, angle: leftLeg },
        rightLeg: { ...neutralJoint, angle: rightLeg },
        leftArm: { ...neutralJoint, angle: -rightArm * 0.25 },
        rightArm: { ...neutralJoint, angle: rightArm },
        head: { ...neutralJoint, angle: head },
      },
    })),
  };

  const chair: SceneElement = {
    id: uid(), characterId: "", kind: "prop", prop: "chair",
    name: "The wobbly chair — do not use until checked by a grown-up",
    x: 548, y: 397, scale: 1.0, rotation: 0, flip: false,
    emotion: "calm", motion: "still",
  };
  // Object truly tilts and settles while Scout notices it: no repeated still
  // picture, and no implied child repair or unsafe touching.
  const wobble: readonly (readonly [number, number])[] = [
    [0, 0], [6.4, 0], [7.15, -7], [7.5, 6], [7.85, -4],
    [8.2, 3], [8.6, 0], [19, 0], [29.8, 0],
  ];
  chair.animation = {
    idle: "none", blink: false,
    keyframes: wobble.map(([time, rotation]) => ({
      ...elementBase(chair), id: uid(), time, rotation,
      easing: "linear" as const,
    })),
  };

  const decor = prior.elements
    .filter(item => !item.characterId && item.prop !== "book")
    .map(copyForNewScene);
  const scene = withScript({
    ...makeScene([], 2), duration: 30, title: "A chair wobbles — Scout notices and steps away",
    chapter: "exploration", background: "classroom", transition: "cut",
    gentleDepth: true, backgroundAnimation: {
      enabled: true, style: "parallax", keyframes: [],
    },
    action: "Scout walks toward a chair. It wobbles without anyone touching it. Scout notices, looks surprised, takes two careful steps back, thinks, and points out that nobody should sit on it until a trusted adult inspects it.",
    elements: [
      ...decor.filter(item => item.sceneryDepth === "behind"),
      chair, scout,
      ...decor.filter(item => item.sceneryDepth !== "behind"),
    ],
    cameraShots: [
      {
        id: uid(), style: "follow", start: 0.5, end: 6.3, move: 0.8,
        frame: { x: 320, y: 248, zoom: 1.15 }, targets: [scout.id],
        follow: true, offset: { x: 0, y: 0 }, placement: "center",
        note: "Follow Scout's real walk toward the wobbly chair.",
      },
      {
        id: uid(), style: "detail", start: 6.8, end: 10.1, move: 0.55,
        frame: { x: 548, y: 308, zoom: 2.0 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Reveal the visibly tilting chair joint, not a motionless still.",
      },
      {
        id: uid(), style: "medium", start: 10.5, end: 20.5, move: 0.75,
        frame: { x: 380, y: 280, zoom: 1.23 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Show Scout backing away and choosing a safer action.",
      },
      {
        id: uid(), style: "wide", start: 21, end: 29.9, move: 1,
        frame: { x: 400, y: 225, zoom: 1.04 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "End wide with the untouched chair and a clear safety reminder.",
      },
    ],
  }, {
    acting: "Show the chair wobbling, Scout's surprised face, a cautious backward step, a pause, and a safe-choice gesture. The dialogue for this scene is NOT YET RECORDED.",
    emotion: "Curious, surprised, thoughtful and calm",
    lines: [
      "That chair is wobbling. Let's not sit on it.",
      "We can step back and ask a trusted grown-up to check it safely. Look, stop, ask!",
    ].map(text => ({ ...blankLine("dialogue", text), speakerId: scout.characterId })),
  });
  scene.focusGraphics = [
    teachingLabel(scene, 1, 4.1, "What do you notice?"),
    teachingLabel(scene, 7.3, 4.7, "Uh-oh! The chair wobbles"),
    teachingLabel(scene, 13.1, 6, "Do not sit on it"),
    teachingLabel(scene, 23, 5.7, "Look · Stop · Ask a grown-up"),
  ];

  const ambience = previous.audioAssets.find(a => a.name === "Subtle workshop activity");
  const steps = previous.audioAssets.find(a => a.name === "Little footsteps");
  const success = previous.audioAssets.find(a => a.name === "Friendly success cue");
  if (!ambience || !steps || !success)
    throw new Error("Previously approved workshop sound effects are missing.");

  const project: Project = {
    ...previous,
    title: SCOUT_WOBBLY_CHAIR_TITLE,
    plannedMinutes: 2,
    templateId: "little-fixers-scout-wobbly-chair-story",
    lesson: "If furniture seems unstable, don't use it. Stop and ask a trusted adult.",
    idea: "A real animated workshop guide demonstrates how to notice a problem and make a safe choice without touching unsafe furniture.",
    scenes: [...previous.scenes, scene],
  };
  const clips = [
    { ...newAudioClip(project, ambience, "effects", 2), duration: 30, loop: true, volume: 0.13 },
    { ...newAudioClip(project, steps, "effects", 2, 0.8), duration: 5.8, loop: true, volume: 0.25 },
    { ...newAudioClip(project, success, "effects", 2, 24.5), volume: 0.35 },
  ];
  return validateProject({ ...project, audioClips: [...previous.audioClips, ...clips] });
}
