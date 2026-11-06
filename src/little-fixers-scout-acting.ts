import { newFocusGraphic } from "./focus-studio";
import { littleFixersScoutVoiced } from "./little-fixers-scout-voiced";
import { makeScene, uid, validateProject } from "./model";
import type { Emotion, Project, Scene, SceneElement } from "./model";
import { newAudioClip } from "./production";
import { neutralJoint } from "./puppet-model";
import { blankLine, withScript } from "./script";
import { builtInSound } from "./sounds";
import { elementBase } from "./timeline";

export const SCOUT_ACTING_TITLE =
  "Little Fixers Club — Scout Plans a Fix (60-second acting cartoon; second scene voice pending)";

function backgroundCopy(element: SceneElement): SceneElement {
  // New scene, new ID; never reuse a voice-mouth track or motion from the
  // previously approved, speaking 34-second opening.
  const result = { ...element, id: uid(), animation: undefined };
  delete result.voiceMouth;
  return result;
}

function label(scene: Scene, time: number, length: number, text: string) {
  return { ...newFocusGraphic(scene, time), kind: "label" as const,
    text, length, target: { kind: "screen" as const, x: 578, y: 85 } };
}

/**
 * One actual minute of vector-cartoon acting, retaining the approved 34s
 * vocal performance and adding a unique 26s object-interaction scene.
 * The second scene has intentionally UNRECORDED dialogue, not synthetic voices.
 */
export async function littleFixersScoutActing(): Promise<Project> {
  const previous = await littleFixersScoutVoiced();
  const first = previous.scenes[0];
  const oldHost = first.elements.find(item => !!item.characterId);
  const oldChecklist = first.elements.find(item => item.prop === "book");
  if (!oldHost || !oldChecklist) throw new Error("Original Scout and picture checklist are missing.");

  const cast = backgroundCopy(oldHost);
  cast.x = 332;
  cast.y = 381;
  cast.scale = 1.28;
  cast.motion = "still";
  cast.emotion = "happy";

  // Designed beats: 0–4 walk; 4–6 notice; 6–12 lift/show; 12–16
  // set down; 17–24 pause, think, point and celebrate.
  const beats: readonly (readonly [number, number, number, number, number, number, Emotion])[] = [
    [0, 332, 0, 0, 6, 1, "happy"],
    [1.2, 349, 16, -16, -12, -1, "happy"],
    [2.4, 371, -18, 18, 17, 4, "happy"],
    [3.6, 389, 16, -16, -13, 7, "happy"],
    [4.6, 404, 0, 0, 10, 12, "surprised"],
    [5.8, 405, 0, 0, 28, 13, "happy"],
    [8, 406, 0, 0, 43, -8, "happy"],
    [10.5, 407, 0, 0, 52, -12, "excited"],
    [12.5, 406, 0, 0, 28, -5, "calm"],
    [15.6, 405, 0, 0, 8, 8, "happy"],
    [17.8, 405, 0, 0, 0, 13, "worried"],
    [20, 405, 0, 0, 34, -5, "happy"],
    [22.5, 405, 0, 0, 53, -10, "excited"],
    [25.8, 405, 0, 0, 3, 1, "happy"],
  ];
  cast.animation = {
    idle: "breathe", blink: true,
    keyframes: beats.map(([time, x, leftLeg, rightLeg, rightArm, head, emotion]) => ({
      ...elementBase(cast), id: uid(), time, x, emotion,
      easing: "ease-in-out" as const,
      joints: {
        head: { ...neutralJoint, angle: head },
        leftLeg: { ...neutralJoint, angle: leftLeg },
        rightLeg: { ...neutralJoint, angle: rightLeg },
        leftArm: { ...neutralJoint, angle: -rightArm * 0.22 },
        rightArm: { ...neutralJoint, angle: rightArm },
      },
    })),
  };

  const checklist: SceneElement = {
    ...backgroundCopy(oldChecklist),
    name: "Picture repair checklist",
    x: 466, y: 357, scale: 0.52, rotation: 0,
    // A story object must NOT be scenery. The interaction compositor moves
    // it to Scout's actual puppet-hand anchor after the pickup.
    sceneryDepth: undefined,
  };

  const decor = first.elements.filter(item =>
    !item.characterId && item.prop !== "book").map(backgroundCopy);
  const behind = decor.filter(item => item.sceneryDepth === "behind");
  const front = decor.filter(item => item.sceneryDepth !== "behind");
  const scene = withScript({
    ...makeScene([], 1), duration: 26,
    title: "Scout plans before fixing — natural body acting and a real checklist pickup",
    action: "Scout walks to the workbench, notices a checklist, picks it up with the right puppet hand, shows it, places it on the table, pauses to think and points out that a grown-up handles dangerous tools.",
    chapter: "exploration", transition: "cut", background: "classroom",
    gentleDepth: true,
    backgroundAnimation: { enabled: true, style: "parallax", keyframes: [] },
    elements: [...behind, cast, checklist, ...front],
    interactions: [
      {
        id: uid(), kind: "put",
        actorId: cast.id, objectId: checklist.id,
        start: 4.2, attach: 6, finish: 16.2,
        grip: { hand: "right", x: 13, y: 5 },
        release: { time: 15.5, position: { x: 532, y: 317 } },
      },
      {
        id: uid(), kind: "point",
        actorId: cast.id, objectId: checklist.id,
        start: 19, attach: 19.1, finish: 24,
        grip: { hand: "right", x: 0, y: 0 },
      },
    ],
    cameraShots: [
      {
        id: uid(), style: "medium", start: 3.7, end: 10.8, move: 1.4,
        frame: { x: 440, y: 295, zoom: 1.43 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "See Scout's reaching arm and the checklist attach to the puppet hand.",
      },
      {
        id: uid(), style: "close", start: 11, end: 17.3, move: 1.5,
        frame: { x: 504, y: 298, zoom: 1.62 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Watch the checklist become stationary after Scout carefully places it down.",
      },
      {
        id: uid(), style: "medium", start: 18.8, end: 25.9, move: 1.2,
        frame: { x: 414, y: 292, zoom: 1.33 }, targets: [], follow: false,
        offset: { x: 0, y: 0 }, placement: "center",
        note: "Return to Scout's thoughtful expression and safe-choice point.",
      },
    ],
  }, {
    acting: "Use expressive silence and pauses while Scout acts. This second scene's words have not been recorded.",
    emotion: "Curious, thoughtful, reassuring",
    lines: [
      "First we make a picture plan. I can lift our checklist and show what we noticed.",
      "Now I'll set it down. A grown-up can check the wobbly chair safely. Look, stop, and ask!",
    ].map(text => ({ ...blankLine("dialogue", text), speakerId: cast.characterId })),
  });
  scene.focusGraphics = [
    label(scene, 1.2, 3.7, "Find our plan"),
    label(scene, 8, 6, "Hold up the checklist"),
    label(scene, 16.7, 4.2, "Pause and think"),
    label(scene, 22, 3.6, "Ask a grown-up"),
  ];

  // Reuse the original room tone and success effect. Add only two new
  // original audio effects, nowhere near the media asset limit.
  const room = previous.audioAssets.find(asset => asset.name === "Subtle workshop activity");
  const success = previous.audioAssets.find(asset => asset.name === "Friendly success cue");
  if (!room || !success) throw new Error("Scout's original workshop effects are missing.");
  const paper = builtInSound("paper");
  const place = builtInSound("place");
  const project: Project = {
    ...previous, title: SCOUT_ACTING_TITLE, plannedMinutes: 1,
    idea: "An original full-body cartoon guide safely demonstrates making a checklist before a repair.",
    lesson: "A plan helps us pause, notice a problem, and ask a trusted adult for help.",
    scenes: [...previous.scenes, scene],
    audioAssets: [...previous.audioAssets, paper, place],
  };
  const clips = [
    { ...newAudioClip(project, room, "effects", 1), duration: 26, volume: 0.15, loop: true },
    { ...newAudioClip(project, paper, "effects", 1, 6), volume: 0.48 },
    { ...newAudioClip(project, place, "effects", 1, 15.5), volume: 0.47 },
    { ...newAudioClip(project, success, "effects", 1, 23), volume: 0.38 },
  ];
  return validateProject({ ...project, audioClips: [...previous.audioClips, ...clips] });
}
