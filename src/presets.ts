import { neutralJoint } from "./puppet-model";
import type { JointSnapshot, PuppetRig } from "./puppet-model";
import type { SceneElement } from "./model";
import { uid } from "./model";
import type {
  ElementAnimation,
  ElementKeyframe,
  ElementValues,
} from "./animation-model";
import { clamp, elementBase, roundTime } from "./timeline";

export const ACTIONS = [
  ["walk", "Walk across the stage"],
  ["walk-in-place", "Walk in place"],
  ["celebrate", "Celebrate"],
  ["enter-left", "Enter from left"],
  ["enter-right", "Enter from right"],
  ["jump", "Jump"],
  ["bounce", "Bounce"],
  ["wave", "Wave"],
  ["spin", "Spin"],
  ["grow", "Grow"],
  ["shrink", "Shrink"],
  ["fade-in", "Fade in"],
  ["fade-out", "Fade out"],
  ["nod", "Nod"],
  ["shake", "Shake head"],
  ["float", "Float"],
  ["dance", "Gentle dance"],
  ["point", "Point at something"],
  ["sit", "Sit down"],
  ["stand", "Stand up"],
  ["door", "Open a door"],
] as const;
export type Action = (typeof ACTIONS)[number][0];
const ACTING_ACTIONS: Action[] = [
  "wave",
  "nod",
  "shake",
  "point",
  "sit",
  "stand",
];
export function actionsFor(shape: boolean, door = false) {
  return ACTIONS.filter(([id]) =>
    id === "door" ? door : !["walk-in-place", "celebrate"].includes(id) && (shape || !ACTING_ACTIONS.includes(id)),
  );
}
export function actionsForPuppet(rig: PuppetRig) {
  const has = (roles: RegExp) => rig.parts.some(part => roles.test(part.role));
  return ACTIONS.filter(([action]) => {
    if (["wave", "point"].includes(action)) return has(/^(left|right)Arm$/);
    if (["nod", "shake"].includes(action)) return has(/^head$/);
    if (["walk-in-place", "sit", "stand"].includes(action)) return has(/Leg|lowerBody/);
    return ["walk", "jump", "bounce", "float", "dance", "celebrate", "fade-in", "fade-out"].includes(action);
  });
}

function puppetAction(rig: PuppetRig, action: Action, phase: number): JointSnapshot {
  const joints: JointSnapshot = {};
  const arm = rig.parts.find(p => p.role === "rightArm") ?? rig.parts.find(p => p.role === "leftArm");
  const wave = Math.sin(phase * Math.PI * 6);
  const walk = Math.sin(phase * Math.PI * 4);
  const envelope = Math.sin(phase * Math.PI);
  for (const part of rig.parts) {
    let angle = 0;
    const side = part.role.startsWith("left") ? -1 : 1;
    if ((action === "walk" || action === "walk-in-place") && /Arm|Leg|lowerBody/.test(part.role))
      angle = walk * side * (/Arm/.test(part.role) ? 16 : -27);
    if (action === "wave" && part.id === arm?.id) angle = -side * (115 + wave * 16) * Math.min(1, envelope * 3);
    if (action === "point" && part.id === arm?.id) angle = -side * 75 * Math.min(1, envelope * 3);
    if (part.role === "head" && (action === "nod" || action === "shake")) angle = wave * (action === "nod" ? 8 : 14);
    if (/Leg|lowerBody/.test(part.role) && (action === "sit" || action === "stand"))
      angle = side * 55 * (action === "sit" ? phase : 1 - phase);
    if (/Arm/.test(part.role) && action === "celebrate") angle = -side * 110 * envelope;
    if (/Arm|Leg/.test(part.role) && action === "dance") angle = walk * side * 25;
    if (angle) joints[part.id] = { ...neutralJoint, angle };
  }
  return joints;
}

export function presetAnimation(
  element: SceneElement,
  sceneDuration: number,
  action: Action,
  start = 0,
  length = 3,
  rig?: PuppetRig,
): ElementAnimation {
  const base = elementBase(element);
  const from = clamp(start, 0, sceneDuration - 0.1),
    span = clamp(length, 0.1, sceneDuration - from);
  const keys = new Map<number, ElementKeyframe>();
  function at(
    fraction: number,
    patch: Partial<ElementValues> = {},
    easing: ElementKeyframe["easing"] = "ease-in-out",
  ) {
    const time = roundTime(from + span * fraction);
    const value = { ...base, ...patch };
    keys.set(time, {
      ...value,
      x: clamp(value.x, -800, 1600),
      y: clamp(value.y, -450, 900),
      scale: clamp(value.scale, 0.05, 4),
      rotation: clamp(value.rotation, -1440, 1440),
      id: uid(),
      time,
      easing,
    });
  }
  keys.set(0, { ...base, id: uid(), time: 0, easing: "linear" });
  at(0);
  at(1);
  switch (action) {
    case "walk":
      for (let i = 0; i <= 12; i++)
        at(
          i / 12,
          {
            x: base.x + (((base.x < 400 ? 720 : 80) - base.x) * i) / 12,
            y: base.y - (i % 2 ? 5 : 0),
            pose: "walking",
            gesture: i === 12 ? "none" : "walk",
          },
          "linear",
        );
      break;
    case "enter-left":
    case "enter-right":
      at(0, { x: action === "enter-left" ? -140 : 940 });
      at(1);
      break;
    case "celebrate":
    case "jump":
      at(0.5, { y: base.y - (action === "celebrate" || rig ? 32 : 80) }, "ease-out");
      at(1, {}, "ease-in");
      break;
    case "bounce":
      for (let i = 0; i <= 8; i++)
        at(
          i / 8,
          { y: base.y - (i % 2 ? 42 : 0) },
          i % 2 ? "ease-out" : "bounce",
        );
      break;
    case "wave":
      at(0, { pose: "waving", gesture: "wave", mouth: "smile" });
      at(1, { pose: "standing", gesture: "none", mouth: "smile" });
      break;
    case "spin":
      at(1, { rotation: base.rotation + 360 }, "linear");
      break;
    case "grow":
      at(0, { scale: Math.max(0.05, base.scale * 0.3) });
      at(1);
      break;
    case "shrink":
      at(1, { scale: Math.max(0.05, base.scale * 0.3) });
      break;
    case "fade-in":
      at(0, { opacity: 0 });
      at(1);
      break;
    case "fade-out":
      at(1, { opacity: 0 });
      break;
    case "nod":
    case "shake":
      at(0, { gesture: action });
      at(1);
      break;
    case "float":
      for (let i = 0; i <= 8; i++)
        at(i / 8, { y: base.y + Math.sin((i * Math.PI) / 2) * 15 });
      break;
    case "dance":
      for (let i = 0; i <= 8; i++)
        at(i / 8, {
          rotation: base.rotation + (i % 2 ? (i % 4 === 1 ? -8 : 8) : 0),
          y: base.y - (i % 2 ? 8 : 0),
          emotion: "excited",
        });
      break;
    case "point":
      at(0, { pose: "pointing" });
      at(1, { pose: "pointing" });
      break;
    case "sit":
      at(1, { pose: "sitting", y: base.y + 20 });
      break;
    case "stand":
      at(0, { pose: "sitting", y: base.y + 20 });
      at(1, { pose: "standing" });
      break;
    case "door":
      at(0, { openness: 0 });
      at(1, { openness: 1 });
      break;
  }
  if (from > 0) {
    const first = keys.get(roundTime(from))!;
    const hold = {
      ...base,
      x: first.x,
      y: first.y,
      scale: first.scale,
      rotation: first.rotation,
      opacity: first.opacity,
    };
    keys.set(0, { ...hold, id: uid(), time: 0, easing: "linear" });
  }
  if (rig && ["wave", "nod", "shake", "point", "walk-in-place", "sit", "stand"].includes(action))
    for (let i = 0; i <= 12; i++) at(i / 12);
  const keyframes = [...keys.values()].sort((a, b) => a.time - b.time);
  return {
    keyframes: rig ? keyframes.map(key => ({
      ...key,
      ...(key.time >= roundTime(from) ? {
        joints: puppetAction(rig, action, clamp((key.time - from) / span, 0, 1)),
        ...(action === "celebrate" ? { emotion: "excited" as const, heart: "together" as const } : {}),
      } : {}),
    })) : keyframes,
    blink: true,
    idle: "none",
  };
}
