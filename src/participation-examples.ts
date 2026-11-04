import { FOCUS_STYLES } from "./focus-model";
import type { FocusGraphic } from "./focus-model";
import { newFocusGraphic } from "./focus-studio";
import { placeLibraryItem, starterLibrary } from "./library";
import { uid, validateProject } from "./model";
import type { Project, Scene, SceneElement } from "./model";
import { PARTICIPATION_EXAMPLES } from "./participation-model";
import type { Participation } from "./participation-model";
import { reconcileProduction } from "./production";
import { blankLine, withScript } from "./script";
import { keyAt, retimeScene } from "./timeline";
import { transformExample, WAGON_LINES } from "./transform-examples";
import type { TransformExample } from "./transform-model";

export const WAGON_ANSWER_DELAY = 3;

function highlight(scene: Scene, object: SceneElement, dx: number, dy: number, at: number, length: number): FocusGraphic {
  const { paper } = FOCUS_STYLES.contrast;
  return { ...newFocusGraphic(scene, at), at, length, kind: "circle", size: 42, reveal: true, text: "",
    style: "contrast", paper, ink: "#0b6e9c", target: { kind: "object", id: object.id, x: object.x, y: object.y, dx, dy } };
}

function wagonParticipation(project: Project): Project {
  const [original, roll] = project.scenes;
  // Only the new example inserts a pause. Original sample projects keep their timing.
  const later = (time: number) => time >= 4.6 ? time + WAGON_ANSWER_DELAY : time;
  const duration = original.duration + WAGON_ANSWER_DELAY;
  const originalCamera = original.cameraAnimation!;
  const holder = original.interactions!.find(action => action.kind === "put")!.actorId;
  const first: Scene = {
    ...original, duration,
    elements: original.elements.map(element => !element.animation ? element : {
      ...element, animation: { ...element.animation, keyframes: element.animation.keyframes.map(key => ({
        ...key, time: later(key.time), x: element.id === holder && key.time === 7.5 ? key.x + 30 : key.x,
      })) },
    }),
    interactions: original.interactions!.map(action => ({
      ...action, start: later(action.start), attach: later(action.attach), finish: later(action.finish),
      release: action.release && { ...action.release, time: later(action.release.time) },
    })),
    objectTracks: original.objectTracks!.map(track => ({
      ...track, changes: track.changes.map(change => ({ ...change, at: later(change.at) })),
    })),
    learningSteps: original.learningSteps!.map(step => ({ ...step, at: later(step.at) })),
    cameraAnimation: { ...originalCamera, keyframes: originalCamera.keyframes.map(key => ({ ...key, time: later(key.time) })) },
  };
  const wagon = first.elements.find(item => item.prop === "toy-wagon")!;
  const [ , question, answer ] = first.script!.lines;
  const circle = highlight(first, wagon, 61, -6, 7.65, 3.55);
  first.focusGraphics = [circle];
  first.participation = [{
    id: uid(), kind: "notice", question: question.text,
    feedback: "The wheel is loose. Let’s ask a grown-up to help us fix it.",
    choices: [{ text: "The wheel", icon: "dot" }, { text: "The handle", icon: "star" }], answer: 0,
    at: WAGON_LINES[1][2], askFor: 2.05, thinkFor: 3.2, revealFor: 3.55,
    speakerId: question.speakerId, questionLineId: question.id, answerLineId: answer.id,
    stepId: first.learningSteps![2].id, focusId: circle.id,
  }];
  return { ...project, scenes: [first, roll],
    captions: project.captions.map(caption => caption.sceneId === first.id && caption.start >= 4.6
      ? { ...caption, start: later(caption.start), end: later(caption.end) } : caption),
    audioClips: project.audioClips.map(clip => clip.sceneId === first.id ? { ...clip, start: later(clip.start) } :
      clip.category === "music" && !clip.sceneId ? { ...clip, duration: clip.duration + WAGON_ANSWER_DELAY } : clip),
  };
}

function smallParticipation(source: Project, example: Exclude<TransformExample, "wagon">): Project {
  const project = example === "seed" ? placeLibraryItem(source, 0, starterLibrary().find(item => item.prop === "watering-can")!) : source;
  let scene = retimeScene(project.scenes[0], 14);
  const cast = scene.elements.filter(item => item.characterId);
  const question = example === "seed" ? "Which idea helps our seed grow?" : example === "bridge"
    ? "Will folded paper hold this light toy better than flat paper?" : "We both want this space. What could we say kindly?";
  const feedback = example === "seed" ? "Give the seed a little water. A sprout takes days to grow." : example === "bridge"
    ? "The fold makes the paper stiffer. Watch the light toy cross." : "We can say, “Let’s make room for both of us.” Then take turns and listen.";
  const at = 0.45, askFor = 1.25, thinkFor = 4, reveal = at + askFor + thinkFor;
  const step = scene.learningSteps![0];
  const questionLine = { ...blankLine("dialogue", question), speakerId: cast[0].characterId };
  const answerLine = { ...blankLine("dialogue", feedback), speakerId: cast.at(-1)?.characterId };
  const moment: Participation = { id: uid(), kind: example === "seed" ? "choose" : example === "bridge" ? "predict" : "feel",
    question, feedback, at, askFor, thinkFor, revealFor: example === "bridge" ? 5.6 : 4, choices: [],
    speakerId: questionLine.speakerId, questionLineId: questionLine.id, answerLineId: answerLine.id, stepId: step.id };
  if (example === "seed") {
    const can = [...scene.elements].reverse().find(item => item.prop === "watering-can")!;
    const watering = { ...can, x: 540, y: 350, scale: 0.78, sceneryDepth: undefined };
    scene = { ...scene, elements: scene.elements.map(item => item.id === can.id ? {
      ...watering, animation: { blink: false, idle: "none", keyframes: [
        keyAt(watering, 0, scene.duration),
        keyAt(watering, reveal, scene.duration),
        { ...keyAt(watering, 6.5, scene.duration), x: 493, y: 316, rotation: -34 },
        keyAt(watering, 7.45, scene.duration),
      ] },
    } : item) };
    const track = scene.objectTracks![0];
    scene.objectTracks = [{ ...track, changes: track.changes.map((change, i) => ({ ...change, at: i ? 11.2 : 7.35 })) }];
    moment.choices = [{ text: "A little water", icon: "dot" }, { text: "Leave it dry", icon: "star" }];
    moment.answer = 0;
  } else if (example === "bridge") {
    const toy = scene.elements.find(item => item.prop === "toy")!;
    const circle = highlight(scene, toy, 0, -44, reveal, moment.revealFor);
    scene.focusGraphics = [circle];
    moment.focusId = circle.id;
    moment.choices = [{ text: "Try folded paper", icon: "star" }, { text: "Keep it flat", icon: "dot" }];
    moment.answer = 0;
  } else {
    scene.action = "Two friends need the same space. They ask kindly, then work together to make room.";
    scene.elements = scene.elements.map(item => item.id === cast.at(-1)?.id ? {
      ...item, animation: { blink: true, idle: "none", keyframes: [
        { ...keyAt(item, 0, scene.duration), emotion: "worried" },
        { ...keyAt(item, reveal, scene.duration), emotion: "calm", mouth: "talking" },
        { ...keyAt(item, reveal + 2.3, scene.duration), emotion: "happy", heart: "calm", heartStrength: 0.65 },
      ] },
    } : item);
  }
  scene = withScript({ ...scene, participation: [moment] }, { acting: scene.action, emotion: "Curious and kind", lines: [questionLine, answerLine] });
  const media = reconcileProduction(project, [scene]);
  if (example === "seed") media.captions = media.captions.map((caption, index) => index === 1
    ? { ...caption, start: 7.35, end: 10.6 } : index === 2 ? { ...caption, start: 11.2, end: 14 } : caption);
  if (example === "tidy") media.captions = [];
  return { ...project, ...media, scenes: [scene] };
}

export function participationExample(example: TransformExample) {
  const base = transformExample(example);
  const project = example === "wagon" ? wagonParticipation(base) : smallParticipation(base, example);
  return validateProject({ ...project, title: PARTICIPATION_EXAMPLES[example] });
}
