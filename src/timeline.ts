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
  if (right) {
    const p = easeAt(
      (time - left.time) / (right.time - left.time),
      right.easing,
    );
    for (const field of numeric) {
      (values as Record<keyof T, unknown>)[field] =
        Number(left[field]) + (Number(right[field]) - Number(left[field])) * p;
    }
  }
  return { values, anchor: left.time };
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
  const { values, anchor } = animation?.keyframes.length
    ? sample(base, animation.keyframes, t, [
        "x",
        "y",
        "scale",
        "rotation",
        "opacity",
        "heartStrength",
        "openness",
      ])
    : {
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
export type ElementFrame = ReturnType<typeof elementAt>;
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
export function cameraAt(scene: Scene, seconds: number, calm = false) {
  const t = clamp(seconds, 0, scene.duration);
  const values = cameraValuesAt(scene, t);
  const target = scene.elements.find(
    (e) => e.id === scene.cameraAnimation?.followId,
  );
  if (target) {
    const frame = elementAt(target, t, scene.duration, calm);
    values.x += frame.x - 400;
    values.y += frame.y - 120 - 225;
  }
  return values;
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
  e.x = clamp(e.x + offset, 0, 800);
  if (e.animation)
    e.animation.keyframes = e.animation.keyframes.map((k) => ({
      ...k,
      id: uid(),
      x: clamp(k.x + offset, -800, 1600),
    }));
  return e;
}
export function duplicateAnimatedScene(scene: Scene): Scene {
  const copy = clone(scene);
  copy.id = uid();
  const ids = new Map<string, string>();
  copy.elements = scene.elements.map((e) => {
    const c = duplicateElement(e);
    ids.set(e.id, c.id);
    return c;
  });
  if (copy.cameraAnimation) {
    copy.cameraAnimation.keyframes.forEach((k) => {
      k.id = uid();
    });
    if (copy.cameraAnimation.followId)
      copy.cameraAnimation.followId = ids.get(copy.cameraAnimation.followId);
  }
  copy.backgroundAnimation?.keyframes.forEach((k) => {
    k.id = uid();
  });
  return copy;
}
export function cleanSceneReferences(scene: Scene): Scene {
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
