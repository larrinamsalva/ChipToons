import type { Caption } from "./media-model";
import type { ElementKeyframe } from "./animation-model";
import { createAssistantDraft } from "./assistant";
import { freshCharacter, placeLibraryItem, starterLibrary } from "./library";
import { makeScene, uid, validateProject } from "./model";
import type { Project, Scene, SceneElement } from "./model";
import { newAudioClip } from "./production";
import { sunnyRig } from "./puppet-model";
import { blankLine, withScript } from "./script";
import { episodeBrief } from "./series";
import { kindHeartsCrew } from "./series-starter";
import { builtInSound } from "./sounds";
import { duplicateAnimatedScene, keyAt } from "./timeline";
import { newObjectTrack } from "./transform-studio";
import { EXAMPLE_NAMES } from "./transform-model";
import type { ObjectChange, PropAppearance, TransformExample } from "./transform-model";
import { starterLocations } from "./world-starters";

export const WAGON_LINES = [
  ["notice", 0, 0.35, "The little wagon wobbles.", "narration"],
  ["shine", 0, 2.4, "What is making it wobble?", "Shine"],
  ["help", 0, 4.7, "The wheel is loose. Let us ask a grown-up.", "Helping Hands"],
  ["adult", 0, 7.8, "Hold it steady. I will press the wheel into place.", "Grown-up helper Jo"],
  ["roll", 1, 0.3, "Let us see if it rolls.", "Shine"],
  ["lesson", 1, 3.05, "Check what went wrong. Ask for help, then test your solution.", "narration"],
] as const;

function base(example: TransformExample, location: string) {
  const { plan, artwork } = kindHeartsCrew();
  const cast = ["Helping Hands", "Shine"].map(name => {
    const index = plan.cast.findIndex(member => member.name === name);
    return { name, library: artwork[index], seriesCastId: plan.cast[index].id };
  });
  const { project } = createAssistantDraft({ ...episodeBrief(plan.episodes[9], 1), title: EXAMPLE_NAMES[example] }, cast);
  return placeLibraryItem({ ...project, scenes: [project.scenes[0]] }, 0,
    starterLocations().find(item => item.id === `starter-location-${location}`)!);
}

function animate(object: SceneElement, duration: number, keys: [number, Partial<ElementKeyframe>][]): SceneElement {
  return { ...object, motion: "still", animation: { blink: true, idle: "none", keyframes: keys.map(([time, values]) =>
    ({ ...keyAt(object, time, duration), ...values })) } };
}

function changeProp(object: SceneElement, appearance: PropAppearance, time: number, transition: ObjectChange["transition"] = "cut") {
  const track = newObjectTrack(object);
  const to = track.states.find(state => state.art.kind === "prop" && state.art.appearance === appearance)!;
  track.changes = [{ id: uid(), to: to.id, at: time, transition, length: transition === "cut" ? 0 : 0.55, sparkle: true }];
  return track;
}

function wagonExample() {
  const p = base("wagon", "workshop");
  const existing = p.scenes[0];
  const duration = 14;
  const hero = existing.elements.find(item => item.characterId === p.characters[0].id)!;
  const shine = existing.elements.find(item => item.characterId === p.characters[1].id)!;
  const wagon = existing.elements.find(item => item.prop === "toy-wagon")!;
  const adult = { ...freshCharacter("Grown-up helper Jo"), puppet: sunnyRig(), shirt: "#66538f", skin: "#be8c71", hair: "#48394a", accessory: "cap" as const };
  p.characters.push(adult);
  const helper = animate({ ...hero, x: 331, y: 365, scale: 1.02 }, duration, [
    [0, { x: 284 }], [2.3, { x: 332 }], [4.2, { x: 331, emotion: "worried" }],
    [7.5, { emotion: "calm" }], [11.7, { emotion: "happy", mouth: "smile" }],
  ]);
  const friend = animate({ ...shine, x: 225, y: 357, scale: 0.86 }, duration, [
    [0, { emotion: "calm" }], [2.4, { emotion: "worried", mouth: "talking" }], [4.5, { mouth: "closed" }],
    [11.7, { emotion: "happy", mouth: "smile" }],
  ]);
  const grownUp = animate({ ...makeScene([adult]).elements[0], x: 505, y: 365, scale: 1.29, flip: true }, duration, [
    [0, { x: 576, opacity: 0 }], [5.2, { x: 560, opacity: 0 }], [7.5, { x: 505, opacity: 1, emotion: "calm" }],
    [8.3, { mouth: "talking" }], [9.15, { mouth: "talking", joints: { rightArm: { x: 0, y: 0, angle: -52 } } }],
    [9.55, { mouth: "smile", joints: { rightArm: { x: 0, y: 0, angle: -52 } } }], [11.8, { emotion: "happy", mouth: "smile" }],
  ]);
  const movingWagon = animate({ ...wagon, sceneryDepth: undefined, x: 261, y: 393, scale: 0.89 }, duration, [
    [0, { x: 261 }], [0.8, { x: 288, y: 388, rotation: 10 }], [1.6, { x: 314, y: 395, rotation: -12 }],
    [2.45, { x: 335, rotation: 0 }], [3.4, { x: 335 }],
  ]);
  const track = changeProp(movingWagon, "fixed-wheel", 9.25);
  const inspect = { id: uid(), kind: "point" as const, actorId: friend.id, objectId: movingWagon.id, start: 1.8,
    attach: 1.8, finish: 3.35, grip: { hand: "right" as const, x: 0, y: 0 } };
  const pickup = { id: uid(), kind: "put" as const, actorId: helper.id, objectId: movingWagon.id, start: 3.55,
    attach: 4.65, finish: 12.1, grip: { hand: "right" as const, x: 0, y: 20 },
    release: { time: 11.72, position: { x: 417, y: 399 } } };
  const repair = withScript({
    ...existing, duration, title: "A wheel needs help", transition: "cut",
    action: "Shine and Helping Hands look at the loose wheel. Their trusted adult presses it into place while Helping Hands holds the wagon steady.",
    elements: [...existing.elements.map(item => item === hero ? helper : item === shine ? friend : item === wagon ? movingWagon : item), grownUp],
    interactions: [inspect, pickup], objectTracks: [track],
    cameraAnimation: { keyframes: [
      { id: uid(), time: 0, x: 400, y: 225, zoom: 1, easing: "linear" },
      { id: uid(), time: 6.25, x: 407, y: 235, zoom: 1.12, easing: "ease-in-out" },
    ] },
  }, { acting: "Keep hands visible and let the grown-up do the adjustment.", emotion: "Curious, then relieved.", lines: [] });
  const copy = duplicateAnimatedScene(repair);
  const testLength = 10;
  const test = {
    ...copy, duration: testLength, title: "Give it a gentle test", transition: "cut" as const,
    action: "The fixed wagon rolls, and Shine’s heart glows.",
    question: "Who could you ask for help with a broken toy?",
    objectTracks: undefined, interactions: undefined,
    cameraAnimation: { keyframes: [
      { id: uid(), time: 0, x: 407, y: 235, zoom: 1.12, easing: "linear" as const },
      { id: uid(), time: 4.4, x: 441, y: 238, zoom: 1.07, easing: "ease-in-out" as const },
    ] },
    elements: copy.elements.map(item => item.prop === "toy-wagon"
      ? animate({ ...item, x: 417, y: 399, propAppearance: "fixed-wheel" }, testLength, [
        [0, { x: 417 }], [0.9, { x: 417 }], [2.7, { x: 576, y: 399, easing: "linear" }], [4.2, { x: 682, y: 399 }],
      ]) : item.characterId === friend.characterId
        ? animate({ ...item, x: 225, emotion: "happy" }, testLength, [
          [0, { mouth: "smile" }], [0.3, { mouth: "talking" }], [1.8, { mouth: "smile" }],
          [2.65, { mouth: "smile", heart: "helping", heartStrength: 0.92 }],
        ]) : { ...item, animation: undefined, ...(item.characterId === grownUp.characterId ? { x: 505, emotion: "happy" as const } : {}) }),
  };
  const scenes = [repair, test].map((scene, i) => withScript(scene, {
    acting: scene.action, emotion: i ? "Proud and grateful" : "Curious and careful",
    lines: WAGON_LINES.filter(([, sceneIndex]) => i === sceneIndex).map(([, , , text, speaker]) =>
      speaker === "narration" ? blankLine("narration", text) : {
        ...blankLine("dialogue", text), speakerId: p.characters.find(character => character.name === speaker)?.id,
      }),
  }));
  const firstLines = scenes[0].script!.lines;
  const secondLines = scenes[1].script!.lines;
  scenes[0].learningSteps = [
    { id: uid(), text: "Notice the wobble.", at: 0.6, lineId: firstLines[0].id },
    { id: uid(), text: "Look closely at the loose wheel.", at: 2.1, lineId: firstLines[1].id,
      cue: { kind: "action", interactionId: inspect.id, moment: "Start" } },
    { id: uid(), text: "Ask a trusted adult for help.", at: 4.7, lineId: firstLines[2].id },
    { id: uid(), text: "Hold the wagon steady while Jo helps.", at: 9.25, lineId: firstLines[3].id,
      cue: { kind: "change", changeId: track.changes[0].id } },
  ];
  scenes[1].learningSteps = [
    { id: uid(), text: "Try rolling the wagon gently.", at: 1.8, lineId: secondLines[0].id },
    { id: uid(), text: "Check the result and thank your helper.", at: 3.05, lineId: secondLines[1].id },
  ];
  const spokenLengths = [1.73, 1.95, 2.85, 3.54, 1.91, 3.96];
  const captions: Caption[] = WAGON_LINES.map(([, i, start, text], index) => ({ id: uid(), sceneId: scenes[i].id, start,
    end: Math.min(scenes[i].duration, start + spokenLengths[index]), text }));
  captions.push({ id: uid(), sceneId: scenes[1].id, start: 7.16, end: testLength, text: test.question });
  const pWithScenes = { ...p, scenes, captions, lesson: "Look closely, ask for help, and gently test what changed." };
  const effects = [builtInSound("notice"), builtInSound("reassure"), builtInSound("melody")];
  return validateProject({ ...pWithScenes, audioAssets: effects, audioClips: [
    { ...newAudioClip(pWithScenes, effects[0], "effects", 0, 9.25), volume: 0.18 },
    { ...newAudioClip(pWithScenes, effects[1], "effects", 1, 2.64), volume: 0.22 },
    { ...newAudioClip(pWithScenes, effects[2], "music", 0), duration: duration + testLength, volume: 0.13, loop: true },
  ] });
}

function smallExample(example: Exclude<TransformExample, "wagon">) {
  let p = base(example, example === "seed" ? "garden" : "classroom");
  if (example === "bridge") {
    p = placeLibraryItem(p, 0, starterLibrary().find(item => item.prop === "paper-bridge")!);
    p = placeLibraryItem(p, 0, starterLibrary().find(item => item.prop === "toy")!);
  }
  const scene = p.scenes[0];
  const duration = 10;
  const prop = example === "seed" ? "flower-pot" : example === "tidy" ? "table" : "paper-bridge";
  const object = scene.elements.find(item => item.prop === prop)!;
  const final = example === "seed" ? "sprout" : example === "tidy" ? "clean" : "assembled";
  const track = changeProp(object, final, example === "seed" ? 3.25 : 4.05, example === "seed" ? "reveal" : "fade");
  if (example === "seed") track.changes.push({ id: uid(),
    to: track.states.find(state => state.art.kind === "prop" && state.art.appearance === "grown")!.id,
    at: 6.7, transition: "fade", length: 0.62 });
  const words = example === "seed" ? ["Plant a seed and give it time.", "Several days later: a little sprout.", "Weeks later: the plant has grown."]
    : example === "tidy" ? ["Let's pick up the loose papers together.", "A clear table gives everyone room to work."]
      : ["Fold and place the paper deck.", "Try the bridge with a lightweight toy."];
  const at = example === "seed" ? [0.25, 3.25, 6.7] : [0.25, 4.6];
  const character = scene.elements.find(item => !!item.characterId)!;
  const target: SceneElement = { ...object, x: 450, y: 375, scale: example === "seed" ? 1.23 : 1.15 };
  const helper = animate({ ...character, x: 260, y: 370 }, duration, [[0, {}], [2.25, { x: 344,
    joints: { rightArm: { x: 0, y: 0, angle: -60 } } }], [4.65, { x: 344, emotion: "happy", heart: "helping" }],
    [6.5, { x: 300 }]]);
  const revised: Scene = {
    ...scene, duration, transition: "cut", title: EXAMPLE_NAMES[example], action: words.join(" "), narration: words.join(" "),
    dialogue: "", question: example === "seed" ? "What can we do while we wait for a seed to grow?" : "What did the helpers try?",
    elements: scene.elements.map(item => item === object ? target : item === character ? helper : item.prop === "toy" && example === "bridge"
      ? animate({ ...item, x: 363, y: 317, scale: 0.34 }, duration, [
        [0, { x: 363 }], [5.1, { x: 363 }], [7.7, { x: 551, easing: "linear" }],
      ]) : item.characterId ? { ...item, x: 648 } : item),
    objectTracks: [track],
    learningSteps: [{ id: uid(), text: words[1], at: at[1], cue: { kind: "change", changeId: track.changes[0].id } }],
  };
  return validateProject({ ...p, scenes: [revised], captions: words.map((text, i) => ({
    id: uid(), sceneId: revised.id, text, start: at[i], end: Math.min(duration, at[i] + 2.95),
  })) });
}

export function transformExample(example: TransformExample): Project {
  return example === "wagon" ? wagonExample() : smallExample(example);
}
