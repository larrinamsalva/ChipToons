import { participationWindow } from "./participation-model";
import { colorValid, numberIn, record, validDisplayText } from "./art-model";
import type { Scene } from "./model";
import { actionTime, changeTime, stepTime } from "./transform-model";
import type { ActionCue } from "./transform-model";

export const FOCUS_TITLE = "Show What We're Learning";
export const MAX_FOCUS_GRAPHICS = 24;
export const MAX_VISIBLE_FOCUS = 3;
export const FOCUS_TYPES = {
  arrow: "Point to Something", circle: "Circle This", spotlight: "Highlight This Object",
  number: "Show a Step Number", label: "Add a Learning Label", card: "Show an Instruction Card",
} as const;
export const FOCUS_STYLES = {
  classroom: { name: "Soft Classroom", ink: "#273558", paper: "#f6e9bd" },
  playful: { name: "Playful Learning", ink: "#5b214e", paper: "#ffe2ee" },
  nature: { name: "Gentle Nature", ink: "#194735", paper: "#e2f2d2" },
  contrast: { name: "Simple High Contrast", ink: "#121925", paper: "#fff5aa" },
} as const;
export type FocusKind = keyof typeof FOCUS_TYPES;
export type FocusStyle = keyof typeof FOCUS_STYLES;
export type FocusCue = { kind: "step"; id: string } | { kind: "change"; id: string } |
  ({ kind: "action" } & ActionCue);
export type FocusTarget =
  | { kind: "screen" | "missing"; x: number; y: number }
  | { kind: "object"; id: string; x: number; y: number; dx: number; dy: number };
export type FocusGraphic = {
  id: string; kind: FocusKind; style: FocusStyle; target: FocusTarget;
  text: string; number: number; size: number; textSize: number;
  ink: string; paper: string;
  at: number; length: number; fadeIn: number; fadeOut: number; reveal: boolean;
  cue?: FocusCue;
  stepSource?: { id?: string; text: string; at: number; review?: boolean };
};

export const canDrawFocus = (kind: FocusKind) => kind === "arrow" || kind === "circle";
const keys = (value: object, fields: readonly string[]) => Object.keys(value).every(key => fields.includes(key));
const id = (value: unknown): value is string => typeof value === "string" && !!value && value.length <= 100;

export function focusCueTime(scene: Scene, cue: FocusCue): number | undefined {
  if (cue.kind === "action") return actionTime(scene.interactions, cue);
  if (cue.kind === "step") {
    const step = scene.learningSteps?.find(item => item.id === cue.id);
    return step ? stepTime(scene, step) : undefined;
  }
  for (const track of scene.objectTracks ?? []) {
    const change = track.changes.find(item => item.id === cue.id);
    if (change) return changeTime(scene, track, change);
  }
}

export function focusWindow(scene: Scene, graphic: FocusGraphic, authored = false) {
  const moment = !authored && scene.participation?.find(item => item.focusId === graphic.id);
  if (moment) {
    const { reveal, end } = participationWindow(moment);
    return { start: reveal, end };
  }
  const start = (graphic.cue && focusCueTime(scene, graphic.cue)) ?? graphic.at;
  return { start, end: Math.min(scene.duration, start + graphic.length) };
}

export function stepNeedsReview(scene: Scene, graphic: FocusGraphic) {
  const source = graphic.stepSource;
  if (!source) return false;
  const step = scene.learningSteps?.find(item => item.id === source.id);
  return !!source.review || !step || source.text !== step.text || Math.abs(source.at - stepTime(scene, step)) > 1e-6;
}

function validCue(value: unknown): value is FocusCue {
  return record(value) && (value.kind === "action"
    ? keys(value, ["kind", "interactionId", "moment"]) && id(value.interactionId) &&
      typeof value.moment === "string" && value.moment.length <= 12
    : (value.kind === "step" || value.kind === "change") && keys(value, ["kind", "id"]) && id(value.id));
}

export function focusIssue(value: unknown, scene: Scene, unique: (id: string) => void = () => {}) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > MAX_FOCUS_GRAPHICS) return "Use up to 24 teaching graphics in one scene.";
  const ids = new Set<string>();
  type Event = { time: number; delta: number; spotlight: boolean };
  const authored: Event[] = [], displayed: Event[] = [];
  function addWindow(events: Event[], { start, end }: { start: number; end: number }, spotlight = false) {
    if (end > start) events.push({ time: start, delta: 1, spotlight }, { time: end, delta: -1, spotlight });
  }
  for (const item of value) {
    if (!record(item) || !keys(item, ["id", "kind", "style", "target", "text", "number", "size", "textSize",
      "ink", "paper", "at", "length", "fadeIn", "fadeOut", "reveal", "cue", "stepSource"]) ||
      !id(item.id) || ids.has(item.id) || typeof item.kind !== "string" || !Object.hasOwn(FOCUS_TYPES, item.kind) ||
      typeof item.style !== "string" || !Object.hasOwn(FOCUS_STYLES, item.style) || !validDisplayText(item.text, 88) || ((item.kind === "label" || item.kind === "card") && !item.text.trim()) ||
      !numberIn(item.number, 1, 99) || !Number.isInteger(item.number) || !numberIn(item.size, 22, 160) ||
      !numberIn(item.textSize, 16, 34) || !colorValid(item.ink) || !colorValid(item.paper) ||
      !numberIn(item.at, 0, scene.duration) || !numberIn(item.length, 0.01, scene.duration) ||
      !numberIn(item.fadeIn, 0, 1.5) || !numberIn(item.fadeOut, 0, 1.5) ||
      item.fadeIn + item.fadeOut > item.length + 1e-7 || typeof item.reveal !== "boolean" ||
      item.reveal && !canDrawFocus(item.kind as FocusKind))
      return "Check each graphic’s style, text, size and timing.";
    const target = item.target;
    if (!record(target) || !numberIn(target.x, 0, 800) || !numberIn(target.y, 0, 450) ||
      !(target.kind === "object" ? keys(target, ["kind", "id", "x", "y", "dx", "dy"]) &&
        id(target.id) && scene.elements.some(object => object.id === target.id) &&
        numberIn(target.dx, -300, 300) && numberIn(target.dy, -300, 300)
        : (target.kind === "screen" || target.kind === "missing") && keys(target, ["kind", "x", "y"])))
      return "Choose an existing object or a position within the stage.";
    if (item.cue !== undefined && (!validCue(item.cue) || focusCueTime(scene, item.cue) === undefined))
      return "Choose an available learning step, action or appearance change.";
    const source = item.stepSource;
    if (source !== undefined && (!record(source) || !keys(source, ["id", "text", "at", "review"]) ||
      !(source.id === undefined ? source.review === true :
        id(source.id) && scene.learningSteps?.some(step => step.id === source.id)) || !validDisplayText(source.text, 250) ||
      !numberIn(source.at, 0, scene.duration) || (source.review !== undefined && typeof source.review !== "boolean")))
      return "Choose an available learning step for this graphic.";
    const graphic = item as unknown as FocusGraphic;
    if (!item.cue && item.at + item.length > scene.duration + 1e-7)
      return "Choose an end time within the scene.";
    const original = focusWindow(scene, graphic, true), spotlight = graphic.kind === "spotlight";
    addWindow(authored, original, spotlight);
    if (scene.participation?.length) {
      const effective = focusWindow(scene, graphic);
      // Keep enough room for the original timing to return when a moment is removed.
      if (original.start <= effective.end && effective.start <= original.end) addWindow(displayed, {
        start: Math.min(original.start, effective.start), end: Math.max(original.end, effective.end),
      }, spotlight);
      else {
        addWindow(displayed, original, spotlight);
        addWindow(displayed, effective, spotlight);
      }
    }
    ids.add(item.id);
    unique(item.id);
  }
  for (const moment of scene.participation ?? []) addWindow(displayed, participationWindow(moment));
  for (const events of [authored, displayed]) {
    let visible = 0, spotlights = 0;
    for (const event of events.sort((a, b) => a.time - b.time || a.delta - b.delta)) {
      visible += event.delta;
      if (event.spotlight) spotlights += event.delta;
      if (visible > MAX_VISIBLE_FOCUS || spotlights > 1)
        return "Show up to three teaching graphics or participation cards at a time and one spotlight. Adjust their timing to make room.";
    }
  }
}

export function reconcileFocusReferences(scene: Scene, previous = scene): Scene {
  if (!scene.focusGraphics?.length) return scene;
  return { ...scene, focusGraphics: scene.focusGraphics.map(graphic => {
    const originalTarget = graphic.target;
    const target = originalTarget.kind === "object" && !scene.elements.some(item => item.id === originalTarget.id)
      ? { kind: "missing" as const, x: originalTarget.x, y: originalTarget.y } : originalTarget;
    const lostCue = graphic.cue && focusCueTime(scene, graphic.cue) === undefined;
    const previousSource = graphic.stepSource;
    const source = previousSource?.id && !scene.learningSteps?.some(step => step.id === previousSource.id)
      ? { ...previousSource, id: undefined, review: true } : previousSource;
    if (!lostCue && target === graphic.target && source === graphic.stepSource) return graphic;
    if (!lostCue) return { ...graphic, target, stepSource: source };
    const old = previous.focusGraphics?.find(item => item.id === graphic.id) ?? graphic;
    const { start } = focusWindow(previous, old, true);
    const at = Math.min(scene.duration - 0.01, start);
    const length = Math.min(graphic.length, scene.duration - at);
    const ratio = Math.min(1, length / (graphic.fadeIn + graphic.fadeOut || 1));
    return { ...graphic, target, stepSource: source, cue: undefined, at, length,
      fadeIn: graphic.fadeIn * ratio, fadeOut: graphic.fadeOut * ratio };
  }) };
}
