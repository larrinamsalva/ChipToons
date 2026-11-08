import { reconcileShotReferences, shotAt } from "./camera-shots";
import type { CameraShot } from "./camera-shots";
import { reconcileParticipation } from "./participation-model";
import { reconcileFocusReferences } from "./focus-model";
import { reconcileTransformReferences } from "./transform-motion";
import { interactionReferencesExist } from "./interaction-model";
import { sampleInteractions, stagePoint } from "./interaction-motion";
import { supportsVoiceMouth, voiceMouthAt } from "./voice-mouth";
import { interpolateJoints } from "./puppet-model";
import { cinematicMotionAt } from "./cinematic-motion";
import { cinematicGaitAt } from "./cinematic-gait";
import { cinematicActionHeadAt } from "./cinematic-head-attention";
import { cinematicHandoffNodAt } from "./cinematic-handoff-acknowledgement";
import { totalDuration } from "./model";
import type { Project, SceneElement } from "./model";

export function frameAt(project: Project, seconds: number) {
  let start = 0;
  const time = clamp(seconds, 0, totalDuration(project));
  for (let index = 0; index < project.scenes.length; index++) {
    const scene = project.scenes[index];
    if (time < start + scene.duration || index === project.scenes.length - 1) {
      return {
        scene,
        index,
        start,
        localTime: Math.min(time - start, scene.duration),
        progress: Math.min(1, (time - start) / scene.duration),
      };
    }
    start += scene.duration;
  }
  throw new Error("A cartoon needs at least one scene.");
}
export function sceneStart(project: Project, index: number) {
  return project.scenes.slice(0, index).reduce((n, s) => n + s.duration, 0);
}
export function motionAt(element: SceneElement, progress: number) {
  const p = clamp(progress, 0, 1);
  let x = element.x;
  let y = element.y;
  let rotation = element.rotation;
  let scale = element.scale;
  let opacity = 1;
  switch (element.motion) {
    case "enter-left":
      x -= (1 - Math.min(1, p * 3)) * 800;
      break;
    case "enter-right":
      x += (1 - Math.min(1, p * 3)) * 800;
      break;
    case "walk":
      x += Math.sin(p * Math.PI * 2) * 95;
      y -= Math.abs(Math.sin(p * Math.PI * 12)) * 5;
      break;
    case "bounce":
      y -= Math.abs(Math.sin(p * Math.PI * 4)) * 35;
      break;
    case "spin":
      rotation += p * 360;
      break;
    case "grow":
      scale *= 0.65 + Math.min(1, p * 2) * 0.35;
      break;
    case "fade":
      opacity = Math.min(1, p * 3);
      break;
  }
  return { x, y, rotation, scale, opacity };
}

// All time-dependent artwork is sampled here. No wall clock, randomness or DOM
// is involved; previews and a future frame exporter can use the same contract.
import type { Scene } from "./model";
import { uid, clone } from "./model";
import type {
  TimedKey,
  Easing,
  ElementValues,
  ElementKeyframe,
  ElementAnimation,
  CameraValues,
  BackgroundValues,
} from "./animation-model";

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
export const roundTime = (time: number) => Math.round(time * 1000) / 1000;
export function snapTime(time: number, snap: number, duration: number) {
  return roundTime(
    clamp(snap > 0 ? Math.round(time / snap) * snap : time, 0, duration),
  );
}
export function easeAt(value: number, easing: Easing): number {
  const p = clamp(value, 0, 1);
  if (easing === "ease-in") return p * p;
  if (easing === "ease-out") return 1 - (1 - p) ** 2;
  if (easing === "ease-in-out")
    return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  if (easing === "bounce") {
    const n = 7.5625,
      d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p - 1.5 / d) ** 2 + 0.75;
    if (p < 2.5 / d) return n * (p - 2.25 / d) ** 2 + 0.9375;
    return n * (p - 2.625 / d) ** 2 + 0.984375;
  }
  return p;
}
function sample<T extends object>(
  base: T,
  keys: (T & TimedKey)[],
  time: number,
  numeric: (keyof T)[],
) {
  let left: T & { time: number } = { ...base, time: 0 };
  let right: (T & TimedKey) | undefined;
  for (const key of keys) {
    if (key.time <= time) left = key;
    else {
      right = key;
      break;
    }
  }
  const values = { ...base };
  for (const field of Object.keys(base) as (keyof T)[])
    values[field] = left[field];
  const p = right ? easeAt((time - left.time) / (right.time - left.time), right.easing) : 0;
  if (right) {
    for (const field of numeric) {
      (values as Record<keyof T, unknown>)[field] =
        Number(left[field]) + (Number(right[field]) - Number(left[field])) * p;
    }
  }
  return { values, anchor: left.time, left, right, progress: p };
}
export function elementBase(element: SceneElement): ElementValues {
  return {
    x: element.x,
    y: element.y,
    scale: element.scale,
    rotation: element.rotation,
    opacity: element.opacity ?? 1,
    emotion: element.emotion,
    pose: element.pose ?? "standing",
    mouth: "auto",
    heart: "off",
    heartStrength: 0.65,
    gesture: "none",
    openness: 0,
  };
}
export function elementAt(
  element: SceneElement,
  seconds: number,
  duration: number,
  calm = false,
) {
  const t = clamp(seconds, 0, duration),
    base = elementBase(element);
  const animation = element.animation;
  const sampled = animation?.keyframes.length
    ? sample<ElementValues & Pick<ElementKeyframe, "joints">>(base, animation.keyframes, t, [
        "x",
        "y",
        "scale",
        "rotation",
        "opacity",
        "heartStrength",
        "openness",
      ])
    : undefined;
  const { values, anchor } = sampled ?? {
        values: {
          ...base,
          ...motionAt(element, duration ? t / duration : 0),
          opacity:
            motionAt(element, duration ? t / duration : 0).opacity *
            base.opacity,
        },
        anchor: 0,
      };
  const phase = t - anchor;
  // Talking is manually timed and independent of audio. Every cycle is a sample.
  const mouth =
    values.mouth === "talking"
      ? Math.floor(phase * 5) % 3 === 0
        ? "closed"
        : "open"
      : values.mouth;
  const idle = calm ? "none" : (animation?.idle ?? "none");
  const seed =
    ([...element.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 17) / 10;
  return {
    ...values,
    mouth,
    authoredMouth: values.mouth,
    joints: sampled && interpolateJoints(sampled.left.joints, sampled.right?.joints ?? (sampled.right ? undefined : sampled.left.joints), sampled.progress),
    y: values.y + (idle === "float" ? Math.sin(t * 1.8) * 4 : 0),
    scale:
      values.scale * (idle === "breathe" ? 1 + Math.sin(t * 2) * 0.012 : 1),
    blink: !calm && (animation?.blink ?? true) && (t + seed) % 4.3 > 4.15,
    armAngle: values.gesture === "wave" ? Math.sin(phase * 7) * 16 : 0,
    headAngle:
      values.gesture === "nod"
        ? Math.sin(phase * 5) * 7
        : values.gesture === "shake"
          ? Math.sin(phase * 5) * 10
          : 0,
    legAngle: values.gesture === "walk" ? Math.sin(phase * 8) * 10 : 0,
    heartScale:
      values.heart === "off"
        ? 1
        : 1 +
          (!calm && values.heart === "helping"
            ? (1 + Math.sin(t * 2)) * 0.07
            : values.heart === "together"
              ? values.heartStrength * 0.16
              : 0),
    heartOpacity:
      values.heart === "off"
        ? 0
        : values.heartStrength *
          (values.heart === "sad"
            ? 0.3
            : values.heart === "helping"
              ? 0.65 + (calm ? 0 : Math.sin(t * 2) * 0.1)
              : 0.5),
  };
}
export type ElementFrame = ReturnType<typeof elementAt> & { voiceOpening?: number };
export function sceneElementAt(project: Project, scene: Scene, element: SceneElement,
  local: number, start: number, calm = false): ElementFrame {
  const authored = elementAt(element, local, scene.duration, calm);
  // Feed the same deterministic polished frame to the stage, camera and
  // hand interactions. The project option is opt-in and never writes keys.
  const motion = cinematicMotionAt(project, element, authored, local,
    scene.duration, calm, time => elementAt(element, time, scene.duration, true));
  const frame = cinematicGaitAt(project, element, motion, local,
    scene.duration, calm, time => elementAt(element, time, scene.duration, true));
  if (!element.voiceMouth?.length || calm ||
      !supportsVoiceMouth(project.characters.find(character => character.id === element.characterId), element)) return frame;
  const voice = voiceMouthAt(project, scene, element, start + local, frame.authoredMouth !== "auto");
  return voice ? { ...frame, mouth: voice.opening ? "open" : "closed", voiceOpening: voice.opening,
    emotion: voice.expression === "keep" ? frame.emotion : voice.expression } : frame;
}
export function sceneFramesAt(project: Project, scene: Scene, time: number, start = 0, calm = false) {
  const frames = sampleInteractions(project, scene, time,
    (item, t) => sceneElementAt(project, scene, item, t, start, calm), calm);
  // Use already-resolved held-object coordinates for expressive head
  // reactions. The original character and prop timelines stay untouched.
  for (const item of scene.elements) {
    if (!item.characterId) continue;
    const frame = frames.get(item.id);
    if (frame) {
      const reaching = cinematicActionHeadAt(
        project, scene, item, frame, frames, time, calm,
      );
      frames.set(item.id, cinematicHandoffNodAt(
        project, scene, item, reaching, time, calm,
      ));
    }
  }
  return frames;
}
export function keyAt(
  element: SceneElement,
  seconds: number,
  duration: number,
): ElementKeyframe {
  const sampled = elementAt(element, seconds, duration, true);
  // Preserve the authored talking mode rather than one rendered mouth frame.
  const keys = element.animation?.keyframes.filter((k) => k.time <= seconds);
  const authoredMouth = keys?.at(-1)?.mouth ?? "auto";
  const values = elementBase(element);
  for (const field of Object.keys(values) as (keyof ElementValues)[]) {
    (values as unknown as Record<string, unknown>)[field] = sampled[field];
  }
  return {
    ...values,
    mouth: authoredMouth,
    ...(sampled.joints ? { joints: sampled.joints } : {}),
    id: uid(),
    time: roundTime(clamp(seconds, 0, duration)),
    easing: "ease-in-out",
  };
}
export function putElementKey(
  element: SceneElement,
  time: number,
  duration: number,
  patch: Partial<ElementValues> = {},
): ElementAnimation {
  const k = keyAt(element, time, duration);
  const old = element.animation?.keyframes.find(
    (key) => Math.abs(key.time - k.time) < 0.001,
  );
  const keys = [
    ...(element.animation?.keyframes.filter((key) => key.id !== old?.id) ?? []),
    { ...k, ...patch, id: old?.id ?? k.id },
  ].sort((a, b) => a.time - b.time);
  return {
    blink: element.animation?.blink ?? true,
    idle: element.animation?.idle ?? "none",
    keyframes: keys,
  };
}
export function cameraBase(scene: Scene): CameraValues {
  return {
    x: 400,
    y: scene.camera === "close" ? (225 - 340 + 340 * 1.3) / 1.3 : 225,
    zoom: scene.camera === "close" ? 1.3 : 1,
  };
}
export function cameraValuesAt(scene: Scene, seconds: number): CameraValues {
  return sample(
    cameraBase(scene),
    scene.cameraAnimation?.keyframes ?? [],
    clamp(seconds, 0, scene.duration),
    ["x", "y", "zoom"],
  ).values;
}
export function cameraAt(scene: Scene, seconds: number, calm = false, followed?: ElementFrame) {
  const t = clamp(seconds, 0, scene.duration);
  const values = cameraValuesAt(scene, t);
  const target = scene.elements.find(
    (e) => e.id === scene.cameraAnimation?.followId,
  );
  if (target) {
    const frame = followed ?? elementAt(target, t, scene.duration, calm);
    values.x += frame.x - 400;
    values.y += frame.y - 120 - 225;
  }
  return values;
}
export type StageCamera = CameraValues & { shotId?: string };
type StageFrames = ReturnType<typeof sceneFramesAt>;

export function shotFraming(scene: Scene, shot: CameraShot, frames: StageFrames): CameraValues {
  const points = shot.targets.flatMap(id => {
    const element = scene.elements.find(item => item.id === id), frame = frames.get(id);
    return element && frame ? [stagePoint(element, frame, shot.offset)] : [];
  });
  const { frame } = shot;
  const subject = points[0], second = points[1];
  const zoom = second ? Math.min(frame.zoom, 580 / (Math.abs(subject.x - second.x) + 110),
    305 / (Math.abs(subject.y - second.y) + 105)) : frame.zoom;
  const scale = clamp(zoom, 1, 3);
  const placement = !subject ? 0 : shot.placement === "left" ? 120 : shot.placement === "right" ? -120 : 0;
  const x = second ? (subject.x + second.x) / 2 : subject?.x ?? frame.x;
  const y = second ? (subject.y + second.y) / 2 : subject?.y ?? frame.y;
  return { x: clamp(x + placement / scale, 400 / scale, 800 - 400 / scale),
    y: clamp(y, 225 / scale, 450 - 225 / scale), zoom: scale };
}

export function stageCameraAt(project: Project, scene: Scene, time: number, calm = false,
  frames?: StageFrames, voiceStart = 0): StageCamera {
  const shot = shotAt(scene, time);
  if (!shot) return cameraAt(scene, time, calm, frames?.get(scene.cameraAnimation?.followId ?? ""));
  const sampleFrames = (at: number) => at === time && frames ? frames : sceneFramesAt(project, scene, at, voiceStart, calm);
  const frameFor = (item: CameraShot, at: number) => shotFraming(scene, item,
    item.targets.length ? sampleFrames(item.follow ? at : item.start) : new Map());
  const target = frameFor(shot, time);
  if (calm || !shot.move || time >= shot.start + shot.move) return { ...target, shotId: shot.id };
  const previous = scene.cameraShots?.find(item => item.id !== shot.id && Math.abs(item.end - shot.start) < 1e-8);
  const from = previous ? frameFor(previous, shot.start) :
    cameraAt(scene, shot.start, calm, sampleFrames(shot.start).get(scene.cameraAnimation?.followId ?? ""));
  const p = easeAt((time - shot.start) / shot.move, "ease-in-out");
  return { x: from.x + (target.x - from.x) * p, y: from.y + (target.y - from.y) * p,
    zoom: from.zoom + (target.zoom - from.zoom) * p, shotId: shot.id };
}

export const backgroundBase: BackgroundValues = {
  x: 0,
  y: 0,
  scale: 1,
  opacity: 1,
};
export function backgroundAt(scene: Scene, seconds: number, calm = false) {
  const animation = scene.backgroundAnimation;
  const t = clamp(seconds, 0, scene.duration);
  if (!animation?.enabled)
    return { ...backgroundBase, drift: 0, sway: 0, twinkle: 1 };
  const { values } = sample(backgroundBase, animation.keyframes, t, [
    "x",
    "y",
    "scale",
    "opacity",
  ]);
  return {
    ...values,
    drift: !calm && animation.style === "drift" ? Math.sin(t / 12) * 35 : 0,
    sway: !calm && animation.style === "sway" ? Math.sin(t * 1.6) * 6 : 0,
    twinkle:
      !calm && animation.style === "twinkle"
        ? 0.75 + Math.sin(t * 1.4) * 0.2
        : 1,
  };
}
export function sceneAt(scene: Scene, seconds: number, calm = false) {
  return {
    camera: cameraAt(scene, seconds, calm),
    background: backgroundAt(scene, seconds, calm),
    elements: scene.elements.map((e) => ({
      id: e.id,
      ...elementAt(e, seconds, scene.duration, calm),
    })),
  };
}
// IDs belong to the project graph; clones never retain animation-key IDs or dangling follows.
export function duplicateElement(
  element: SceneElement,
  offset = 0,
): SceneElement {
  const e = clone(element);
  e.id = uid();
  delete e.voiceMouth;
  e.x = clamp(e.x + offset, 0, 800);
  if (e.animation)
    e.animation.keyframes = e.animation.keyframes.map((k) => ({
      ...k,
      id: uid(),
      x: clamp(k.x + offset, -800, 1600),
    }));
  return e;
}
export function duplicateAnimatedScene(scene: Scene, cues = new Map<string, string>()): Scene {
  const copy = clone(scene);
  copy.id = uid();
  const ids = new Map<string, string>();
  copy.elements = scene.elements.map((e) => {
    const c = duplicateElement(e);
    ids.set(e.id, c.id);
    e.animation?.keyframes.forEach((key, i) => cues.set(key.id, c.animation!.keyframes[i].id));
    return c;
  });
  function nextCue(id: string) {
    const next = uid();
    cues.set(id, next);
    return next;
  }
  if (copy.interactions) copy.interactions = copy.interactions.map(action => ({
    ...action, id: nextCue(action.id), actorId: ids.get(action.actorId)!, objectId: ids.get(action.objectId)!,
    transfer: action.transfer && { ...action.transfer, actorId: ids.get(action.transfer.actorId)! },
  }));
  if (copy.objectTracks) copy.objectTracks = copy.objectTracks.map(track => {
    const states = new Map(track.states.map(state => [state.id, uid()]));
    return { ...track, objectId: ids.get(track.objectId)!, initial: states.get(track.initial)!,
      states: track.states.map(state => ({ ...state, id: states.get(state.id)! })),
      changes: track.changes.map(change => ({ ...change, id: nextCue(change.id), to: states.get(change.to)!,
        cue: change.cue && { ...change.cue, interactionId: cues.get(change.cue.interactionId)! },
      })),
    };
  });
  if (copy.learningSteps) copy.learningSteps = copy.learningSteps.map(step => ({
    ...step, id: nextCue(step.id), cue: step.cue?.kind === "action"
      ? { ...step.cue, interactionId: cues.get(step.cue.interactionId)! }
      : step.cue ? { ...step.cue, changeId: cues.get(step.cue.changeId)! } : undefined,
  }));
  if (copy.focusGraphics) copy.focusGraphics = copy.focusGraphics.map(graphic => ({
    ...graphic, id: nextCue(graphic.id),
    target: graphic.target.kind === "object" ? { ...graphic.target, id: ids.get(graphic.target.id)! } : graphic.target,
    cue: graphic.cue?.kind === "action" ? { ...graphic.cue, interactionId: cues.get(graphic.cue.interactionId)! } :
      graphic.cue ? { ...graphic.cue, id: cues.get(graphic.cue.id)! } : undefined,
    stepSource: graphic.stepSource?.id ? { ...graphic.stepSource, id: cues.get(graphic.stepSource.id)! } : graphic.stepSource,
  }));
  if (copy.participation) copy.participation = copy.participation.map(moment => ({
    ...moment, id: nextCue(moment.id), stepId: moment.stepId ? cues.get(moment.stepId) : undefined,
    focusId: moment.focusId ? cues.get(moment.focusId) : undefined,
  }));
  if (copy.cameraAnimation) {
    copy.cameraAnimation.keyframes.forEach((k) => {
      k.id = nextCue(k.id);
    });
    if (copy.cameraAnimation.followId)
      copy.cameraAnimation.followId = ids.get(copy.cameraAnimation.followId);
  }
  if (copy.cameraShots) copy.cameraShots = copy.cameraShots.map(shot => ({
    ...shot, id: uid(), targets: shot.targets.map(id => ids.get(id)!),
    cue: shot.cue && { ...shot.cue, anchor: { ...shot.cue.anchor, id: cues.get(shot.cue.anchor.id)! } },
  }));
  copy.backgroundAnimation?.keyframes.forEach((k) => {
    k.id = uid();
  });
  return copy;
}
export function cleanSceneReferences(scene: Scene, previous = scene): Scene {
  if (scene.interactions?.some(action => !interactionReferencesExist(action, scene.elements)))
    scene = { ...scene, interactions: scene.interactions.filter(action => interactionReferencesExist(action, scene.elements)) };
  scene = reconcileShotReferences(reconcileParticipation(reconcileFocusReferences(reconcileTransformReferences(scene, previous), previous)));
  if (
    !scene.cameraAnimation?.followId ||
    scene.elements.some((e) => e.id === scene.cameraAnimation?.followId)
  )
    return scene;
  return {
    ...scene,
    cameraAnimation: { ...scene.cameraAnimation, followId: undefined },
  };
}
export function retimeScene(scene: Scene, duration: number): Scene {
  const copy = clone(scene),
    ratio = duration / scene.duration;
  copy.duration = duration;
  if (copy.interactions) copy.interactions = copy.interactions.map(action => ({
    ...action, start: action.start * ratio, attach: action.attach * ratio, finish: action.finish * ratio,
    transfer: action.transfer && { ...action.transfer, time: action.transfer.time * ratio },
    release: action.release && { ...action.release, time: action.release.time * ratio },
  }));
  if (copy.objectTracks) for (const track of copy.objectTracks) {
    for (const change of track.changes) {
      change.at = Math.min(duration, change.at * ratio);
      change.length = Math.min(1.5, change.length * ratio);
    }
  }
  if (copy.learningSteps) for (const step of copy.learningSteps) step.at = Math.min(duration, step.at * ratio);
  if (copy.focusGraphics) for (const graphic of copy.focusGraphics) {
    graphic.at = Math.min(duration - 0.01, graphic.at * ratio);
    graphic.length = Math.max(0.01, Math.min(duration - graphic.at, graphic.length * ratio));
    graphic.fadeIn = Math.min(1.5, graphic.fadeIn * ratio);
    graphic.fadeOut = Math.min(1.5, graphic.fadeOut * ratio);
    if (graphic.stepSource) graphic.stepSource.at = Math.min(duration, graphic.stepSource.at * ratio);
  }
  if (copy.cameraShots) copy.cameraShots = copy.cameraShots.map(shot => ({
    ...shot, start: Math.min(duration, shot.start * ratio), end: Math.min(duration, shot.end * ratio), move: shot.move * ratio,
    cue: shot.cue && { ...shot.cue, reviewedAt: Math.min(duration, shot.cue.reviewedAt * ratio) },
  }));
  copy.elements.forEach((e) =>
    e.animation?.keyframes.forEach((k) => {
      k.time = Math.min(duration, k.time * ratio);
    }),
  );
  copy.cameraAnimation?.keyframes.forEach((k) => {
    k.time = Math.min(duration, k.time * ratio);
  });
  copy.backgroundAnimation?.keyframes.forEach((k) => {
    k.time = Math.min(duration, k.time * ratio);
  });
  return copy;
}
