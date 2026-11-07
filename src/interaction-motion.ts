import { WATER_TILT } from "./interaction-model";
import { cinematicReachJoint } from "./cinematic-reach";
import { cinematicArmIK } from "./cinematic-arm-ik";
import type { Character, Project, Scene, SceneElement } from "./model";
import { neutralJoint, puppetTransforms } from "./puppet-model";
import type { PuppetRig } from "./puppet-model";
import type { Grip, Hand, Interaction, Point } from "./interaction-model";
import type { ElementFrame } from "./timeline";

export type InteractionFrame = ElementFrame & {
  interactionArm?: { left?: number; right?: number };
  heldBy?: string;
  interactionPosition?: boolean;
  watering?: Point;
  pointing?: number;
};
type Sample = (element: SceneElement, time: number) => ElementFrame;
const blend = (a: number, b: number, p: number) => a + (b - a) * p;
const smooth = (a: number, b: number, t: number) => {
  const p = a === b ? Number(t >= b) : Math.min(1, Math.max(0, (t - a) / (b - a)));
  return p * p * (3 - 2 * p);
};
const mix = (a: Point, b: Point, p: number) => ({ x: blend(a.x, b.x, p), y: blend(a.y, b.y, p) });

function rotate(point: Point, angle: number): Point {
  const r = angle * Math.PI / 180;
  return { x: point.x * Math.cos(r) - point.y * Math.sin(r), y: point.x * Math.sin(r) + point.y * Math.cos(r) };
}
export function stagePoint(element: SceneElement, frame: Pick<ElementFrame, "x" | "y" | "rotation" | "scale">, local: Point) {
  const p = rotate({
    x: local.x * frame.scale * (element.flip ? -1 : 1),
    y: local.y * frame.scale * (element.flipY ? -1 : 1),
  }, frame.rotation);
  return { x: frame.x + p.x, y: frame.y + p.y };
}
function armParts(rig: PuppetRig, hand: Exclude<Hand, "default">) {
  return [`${hand}Hand`, `${hand}Forearm`, `${hand}Arm`].flatMap(role => rig.parts.filter(part => part.role === role));
}

export function anchorDescription(character: Character | undefined, element: SceneElement | undefined, hand: Hand) {
  if (hand === "default") return "A simple hold point moves with the whole character.";
  if (character?.puppet) return armParts(character.puppet, hand).length
    ? "Follows the animated puppet arm or hand." : "This puppet is missing that arm. The simple hold point will be used.";
  return (element?.assetId || character?.assetId)
    ? "This flat image uses an approximate hold point. Its arm cannot move independently."
    : "Follows the cartoon’s approximate hand position.";
}

export function handAt(character: Character | undefined, element: SceneElement, frame: InteractionFrame, grip: Grip): Point {
  const side = grip.hand === "left" ? -1 : 1;
  let hand: Point = { x: 42, y: -105 };
  if (grip.hand !== "default" && character?.puppet) {
    const rig = character.puppet;
    const part = armParts(rig, grip.hand)[0];
    if (part) {
      const joint = puppetTransforms(rig, frame.joints)[rig.parts.indexOf(part)];
      const tip = rotate({
        x: -part.pivotX,
        y: (part.role.endsWith("Hand") ? 0 : part.height / 2) - part.pivotY,
      }, joint.angle);
      hand = { x: joint.x + tip.x, y: joint.y + tip.y };
    }
  } else if (grip.hand !== "default" && (element.assetId || character?.assetId)) {
    hand = { x: side * (element.width ?? 190) * 0.32, y: -(element.height ?? 245) * 0.45 };
  } else if (grip.hand !== "default") {
    const left = grip.hand === "left";
    const shoulder = { x: left ? -28 : 28, y: -124 };
    const tip = left
      ? frame.pose === "waving" ? { x: -60, y: -190 } :
        frame.pose === "walking" ? { x: -76, y: -127 } : { x: -60, y: -82 }
      : frame.pose === "pointing" ? { x: 98, y: -132 } :
        frame.pose === "walking" ? { x: 73, y: -101 } : { x: 60, y: -82 };
    const p = rotate({ x: tip.x - shoulder.x, y: tip.y - shoulder.y },
      (left ? frame.armAngle : 0) + (frame.interactionArm?.[grip.hand] ?? 0));
    hand = { x: shoulder.x + p.x, y: shoulder.y + p.y };
  }
  return stagePoint(element, frame, { x: hand.x + grip.x, y: hand.y + grip.y });
}

function reach(project: Project, character: Character | undefined, actor: SceneElement, frame: InteractionFrame,
  grip: Grip, amount: number, direction: number, target?: Point,
  peakAmount = 33, calm = false): InteractionFrame {
  if (!amount || grip.hand === "default") return frame;
  const hand = grip.hand;
  const angle = -direction * (actor.flip ? -1 : 1) * amount;
  const rig = character?.puppet;
  if (rig) {
    const parts = armParts(rig, hand);
    // Authored joints (including neutral snapshots) take priority over the reach.
    if (parts.some(part => frame.joints?.[part.id])) return frame;
    const upper = parts.at(-1);
    if (!upper) return frame;
    const cinematic = !calm && project.visualStyle === "storybook-cinematic" && target;
    // A parented vector forearm can solve shoulder AND elbow together. Preserve
    // the one-joint cinematic reach for all older or partial puppet rigs.
    const articulated = cinematic
      ? cinematicArmIK(rig, actor, frame, upper, grip, target, amount / peakAmount)
      : undefined;
    if (articulated) return { ...frame, joints: { ...frame.joints, ...articulated } };
    const targeted = cinematic
      ? cinematicReachJoint(rig, actor, frame, upper, target, amount / peakAmount)
      : undefined;
    return { ...frame, joints: { ...frame.joints,
      [upper.id]: targeted ?? { ...neutralJoint, angle } } };
  }
  return actor.assetId || character?.assetId ? frame :
    { ...frame, interactionArm: { ...frame.interactionArm, [hand]: angle } };
}

export function sampleInteractions(project: Project, scene: Scene, time: number, sample: Sample, calm = false) {
  const frames = new Map<string, InteractionFrame>();
  for (const item of scene.elements) frames.set(item.id, sample(item, time));
  if (!scene.interactions?.length) return frames;
  const elements = new Map(scene.elements.map(item => [item.id, item]));
  const actions = [...scene.interactions].sort((a, b) => a.start - b.start);
  const characters = new Map(project.characters.map(item => [item.id, item]));
  const character = (item: SceneElement) => characters.get(item.characterId);

  function armFrame(actor: SceneElement, t: number, base: InteractionFrame): InteractionFrame {
    let frame = base;
    for (const action of actions) {
      if (t < action.start || t > action.finish) continue;
      const prop = elements.get(action.objectId);
      if (!prop) continue;
      const receiver = action.transfer;
      const receiving = receiver?.actorId === actor.id;
      if (!receiving && action.actorId !== actor.id) continue;
      const grip = receiving ? receiver.grip : action.grip;
      const from = receiving ? Math.max(action.attach, receiver.time - 0.55) : action.start;
      const peak = receiving ? receiver.time : action.kind === "point" ?
        Math.min(action.finish, from + 0.35) : action.attach;
      const until = receiving ? action.release?.time ?? action.finish :
        receiver?.time ?? action.release?.time ?? action.finish;
      if (t < from || t > until) continue;
      const down = action.kind === "point" ? 0.24 : 0.18;
      const amount = (action.kind === "point" ? 85 : 33) *
        smooth(from, peak, t) * (1 - smooth(Math.max(peak, until - down), until, t));
      // In Cinematic handoffs, BOTH performers aim at the shared story
      // object. Targeting the other person's torso near transfer would
      // exceed real articulated arm reach and force the elbow to disappear.
      // Classic mode preserves its original receiver-facing gesture.
      const cinematicHandoff = !calm && project.visualStyle === "storybook-cinematic" && receiver;
      const target = cinematicHandoff
        ? prop
        : receiver && !receiving && t >= receiver.time - 0.55
          ? elements.get(receiver.actorId) : prop;
      const aimTime = receiving || target?.id === receiver?.actorId || target?.id === action.actorId
        ? receiver?.time ?? action.start : action.start;
      const aimed = target ? sample(target, aimTime) : undefined;
      const direction = aimed && aimed.x < sample(actor, aimTime).x ? -1 : 1;
      frame = reach(project, character(actor), actor, frame, grip, amount, direction,
        aimed ? { x: aimed.x, y: aimed.y } : undefined, action.kind === "point" ? 85 : 33, calm);
    }
    return frame;
  }
  for (const item of scene.elements) {
    if (item.characterId) frames.set(item.id, armFrame(item, time, frames.get(item.id)!));
  }
  function anchor(actorId: string, grip: Grip, t: number) {
    const actor = elements.get(actorId);
    if (!actor) return;
    const frame = t === time ? frames.get(actor.id)! : armFrame(actor, t, sample(actor, t));
    return handAt(character(actor), actor, frame, grip);
  }
  function carrying(action: Interaction, t: number): Point | undefined {
    const giver = anchor(action.actorId, action.grip, t);
    const transfer = action.transfer;
    if (!giver || !transfer) return giver;
    const receiver = anchor(transfer.actorId, transfer.grip, t);
    if (!receiver) return giver;
    const from = Math.max(action.attach, transfer.time - 0.32);
    return mix(giver, receiver, smooth(from, transfer.time, t));
  }
  const resting = new Map<string, Point>();
  for (const action of actions) {
    if (time < action.start) continue;
    const prop = elements.get(action.objectId);
    if (!prop || !elements.has(action.actorId) || (action.transfer && !elements.has(action.transfer.actorId))) continue;
    const frame = frames.get(prop.id)!;
    if (action.kind === "point") {
      if (time < action.finish) frames.set(prop.id, { ...frame, pointing:
        smooth(action.start, Math.min(action.finish, action.start + 0.28), time) *
        (1 - smooth(Math.max(action.start, action.finish - 0.22), action.finish, time)) });
      continue;
    }
    const end = action.release?.time ?? action.finish;
    const t = Math.min(time, end);
    const from = resting.get(prop.id) ?? sample(prop, action.start);
    const hand = carrying(action, t);
    if (!hand) continue;
    let position = mix(from, hand, smooth(action.start, action.attach, t));
    if (action.release) {
      const lastAttach = action.transfer?.time ?? action.attach;
      position = mix(position, action.release.position, smooth(Math.max(lastAttach, end - 0.45), end, t));
    }
    const heldBy = time >= action.attach && time < end
      ? (action.transfer && time >= action.transfer.time ? action.transfer.actorId : action.actorId) : undefined;
    const progress = (t - action.attach) / Math.max(0.01, end - action.attach);
    const tilt = action.kind === "water"
      ? smooth(WATER_TILT.lean, WATER_TILT.upright, progress) * (1 - smooth(WATER_TILT.return, WATER_TILT.rest, progress)) : 0;
    const rotation = frame.rotation - 53 * tilt * (prop.flip ? -1 : 1);
    const pose = { ...frame, ...position, rotation, heldBy, interactionPosition: true };
    frames.set(prop.id, { ...pose, watering: tilt > WATER_TILT.threshold
      ? stagePoint(prop, pose, { x: -67, y: -55 }) : undefined });
    if (time >= end) resting.set(prop.id, position);
  }
  return frames;
}

// Preserve authored ordering, except that a held prop may rise in front of its owner.
export function interactionPaintOrder(elements: SceneElement[], frames: Map<string, InteractionFrame>) {
  const ordered = [...elements];
  for (const item of elements) {
    const owner = frames.get(item.id)?.heldBy;
    if (!owner) continue;
    const index = ordered.indexOf(item);
    const ownerIndex = ordered.findIndex(element => element.id === owner);
    if (ownerIndex > index) {
      ordered.splice(index, 1);
      ordered.splice(ownerIndex, 0, item);
    }
  }
  return ordered;
}
