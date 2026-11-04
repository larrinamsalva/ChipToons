import { numberIn, record } from "./art-model";
import type { PropName } from "./art-model";
import type { SceneElement } from "./model";

export const INTERACTION_LIMIT = 24;
export const HANDS = ["left", "right", "default"] as const;
export type Hand = (typeof HANDS)[number];
export const HAND_LABELS: Record<Hand, string> = {
  left: "Left hand", right: "Right hand", default: "Simple hold point",
};
export const INTERACTION_LABELS = {
  pickup: "Pick It Up", hold: "Hold It", carry: "Carry It", put: "Put It Down",
  give: "Give to Friend", receive: "Receive from Friend", point: "Point to It",
  show: "Show It", table: "Place It on a Table", move: "Move It to Another Spot",
  water: "Water a Plant",
} as const;
export type InteractionKind = keyof typeof INTERACTION_LABELS;
export type Point = { x: number; y: number };
export type Grip = Point & { hand: Hand };
export type Interaction = {
  id: string;
  kind: InteractionKind;
  actorId: string;
  objectId: string;
  start: number;
  attach: number;
  finish: number;
  grip: Grip;
  transfer?: { time: number; actorId: string; grip: Grip };
  release?: { time: number; position: Point };
};

export const LEARNING_ACTIONS = [
  ["Water a Plant", "water", "watering-can", "Carry a small can, water a seedling, then put the can down."],
  ["Put Away a Toy", "put", "toy", "Choose a release spot on a shelf."],
  ["Share a Book", "give", "book", "Pass a book to a friend and set it down together."],
  ["Help Clean a Room", "move", "picnic-basket", "Carry a small basket to the place it belongs."],
  ["Fix a Toy Together", "show", "toy", "Show a toy to a friend and ask a trusted adult for help."],
] as const satisfies readonly (readonly [string, InteractionKind, PropName, string])[];

const fixedProps = new Set<PropName>([
  "tree", "door", "chair", "table", "slide", "swing-set", "bench", "garden-bed", "shelf", "traffic-sign", "recycling-bin",
]);
export const interactionCharacter = (item: SceneElement) =>
  !!item.characterId && (item.kind === undefined || item.kind === "character");
export const canBecomeStoryObject = (item: Pick<SceneElement, "characterId" | "kind" | "prop" | "backdrop">) =>
  !item.characterId && !item.backdrop && (item.kind === "art" ||
    (item.kind === "prop" && !!item.prop && !fixedProps.has(item.prop)));
export const storyObject = (item: SceneElement) => canBecomeStoryObject(item) && !item.sceneryDepth;
export const passesObject = (kind: InteractionKind) => kind === "give" || kind === "receive";
export const needsRelease = (kind: InteractionKind) => ["put", "table", "move", "water"].includes(kind);
const own = (value: object, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100;
const point = (value: unknown): value is Point => record(value) && own(value, ["x", "y"]) &&
  numberIn(value.x, 0, 800) && numberIn(value.y, 0, 450);
const grip = (value: unknown): value is Grip => record(value) && own(value, ["hand", "x", "y"]) &&
  HANDS.some(hand => hand === value.hand) && numberIn(value.x, -120, 120) && numberIn(value.y, -120, 120);

// The audio cue and visible stream share the same normalized carry phase.
export const WATER_TILT = { lean: 0.45, upright: 0.59, return: 0.72, rest: 0.87, threshold: 0.75 };
export function wateringWindow(action: Interaction) {
  const end = action.release?.time ?? action.finish;
  const span = Math.max(0.01, end - action.attach);
  const eased = 0.5 - Math.sin(Math.asin(1 - 2 * WATER_TILT.threshold) / 3);
  return {
    start: action.attach + span * (WATER_TILT.lean + (WATER_TILT.upright - WATER_TILT.lean) * eased),
    end: action.attach + span * (WATER_TILT.return + (WATER_TILT.rest - WATER_TILT.return) * (1 - eased)),
  };
}

export function interactionEvents(action: Interaction): { name: string; time: number }[] {
  return [
    { name: "Start", time: action.start },
    ...(action.kind === "point" ? [] : [{ name: "Attach", time: action.attach }]),
    ...(action.transfer ? [{ name: "Transfer", time: action.transfer.time }] : []),
    ...(action.release ? [{ name: "Release", time: action.release.time }] : []),
    { name: "Finish", time: action.finish },
  ];
}

export function interactionReferencesExist(action: Interaction, elements: SceneElement[]) {
  return elements.some(item => item.id === action.actorId && interactionCharacter(item)) &&
    elements.some(item => item.id === action.objectId && storyObject(item) &&
      (action.kind !== "water" || item.prop === "watering-can")) &&
    (!action.transfer || elements.some(item => item.id === action.transfer?.actorId && interactionCharacter(item)));
}

function validInteraction(value: unknown, duration: number): value is Interaction {
  if (!record(value) || !own(value, ["id", "kind", "actorId", "objectId", "start", "attach", "finish", "grip", "transfer", "release"]) ||
    !id(value.id) || !id(value.actorId) || !id(value.objectId) ||
    typeof value.kind !== "string" || !Object.hasOwn(INTERACTION_LABELS, value.kind) ||
    !numberIn(value.start, 0, duration) || !numberIn(value.finish, 0, duration) ||
    value.finish <= value.start || !numberIn(value.attach, value.start, value.finish) || !grip(value.grip)) return false;
  const kind = value.kind as InteractionKind;
  if (kind !== "point" && value.attach >= value.finish) return false;
  const transfer = value.transfer;
  if (passesObject(kind) !== (transfer !== undefined)) return false;
  if (transfer !== undefined && (!record(transfer) || !own(transfer, ["time", "actorId", "grip"]) ||
    !id(transfer.actorId) || transfer.actorId === value.actorId || !grip(transfer.grip) ||
    !numberIn(transfer.time, value.attach, value.finish) || transfer.time <= value.attach || transfer.time >= value.finish)) return false;
  const release = value.release;
  if (release === undefined) return !needsRelease(kind);
  const heldFrom = transfer ? transfer.time as number : value.attach;
  return kind !== "point" && record(release) && own(release, ["time", "position"]) &&
    numberIn(release.time, heldFrom, value.finish) && release.time > heldFrom && point(release.position);
}

export function interactionIssue(value: unknown, duration: number, elements: SceneElement[]): string | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > INTERACTION_LIMIT)
    return "Use up to 24 interactions in a scene.";
  const earlier: Interaction[] = [];
  for (const action of value) {
    if (!validInteraction(action, duration))
      return "Check the action times and positions. Attach, transfer and release must happen in order within the scene.";
    if (!interactionReferencesExist(action, elements))
      return "Choose a character and an available story object. Convert eligible scenery to a story prop first.";
    if (earlier.some(other => other.id === action.id))
      return "Each interaction needs its own identity.";
    const grips = (item: Interaction) => [
      { actorId: item.actorId, hand: item.grip.hand },
      ...(item.transfer ? [{ actorId: item.transfer.actorId, hand: item.transfer.grip.hand }] : []),
    ];
    if (earlier.some(other => action.start < other.finish && other.start < action.finish &&
      (action.objectId === other.objectId || grips(action).some(a => grips(other).some(b =>
        a.actorId === b.actorId && (a.hand === b.hand || a.hand === "default" || b.hand === "default"))))))
      return "An object or hand is already busy at that time. Move one action to a different time or choose another hand.";
    earlier.push(action);
  }
}
