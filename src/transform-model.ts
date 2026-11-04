import { numberIn, record, validCrop } from "./art-model";
import type { Crop, PropName } from "./art-model";
import { interactionEvents } from "./interaction-model";
import type { Interaction } from "./interaction-model";
import type { Scene, SceneElement } from "./model";

export const EXAMPLE_NAMES = {
  wagon: "Helping Hands and the Wobbly Wagon",
  tidy: "Clean Up Together",
  seed: "Watch a Seed Grow",
  bridge: "Finish a Paper Bridge",
} as const;
export type TransformExample = keyof typeof EXAMPLE_NAMES;

export const MAX_OBJECT_STATES = 4;
export const MAX_CHANGES_PER_OBJECT = 16;
export const MAX_LEARNING_STEPS = 7;
export const TRANSITIONS = { cut: "Instant change", fade: "Short fade", reveal: "Reveal from left" } as const;
export const PROP_APPEARANCES = {
  "toy-wagon": [["loose-wheel", "Loose wheel"], ["fixed-wheel", "Wheel attached"]],
  table: [["messy", "Messy tabletop"], ["clean", "Clean tabletop"]],
  shelf: [["messy", "Untidy shelf"], ["organized", "Organized shelf"]],
  "flower-pot": [["seed", "Seed planted"], ["sprout", "Little sprout"], ["grown", "Flower grown"]],
  "paper-bridge": [["unfinished", "Unfinished bridge"], ["assembled", "Bridge assembled"]],
} as const;
export type PropAppearance = (typeof PROP_APPEARANCES)[keyof typeof PROP_APPEARANCES][number][0];

export type StateArt = { kind: "original" } | { kind: "prop"; appearance: PropAppearance } | { kind: "image"; assetId: string; crop?: Crop };
export type ObjectState = { id: string; name: string; art: StateArt };
export type ActionCue = { interactionId: string; moment: string };
export type ObjectChange = {
  id: string; to: string; at: number; transition: keyof typeof TRANSITIONS;
  length: number; sparkle?: boolean; cue?: ActionCue;
};
export type ObjectTrack = { objectId: string; initial: string; states: ObjectState[]; changes: ObjectChange[] };
export type LearningStep = {
  id: string; text: string; at: number; lineId?: string;
  cue?: { kind: "change"; changeId: string } | ({ kind: "action" } & ActionCue);
};

export const STARTER_STEPS = [
  "Notice the problem", "Look carefully", "Ask for help when needed", "Choose a safe action",
  "Try the solution", "Check the result", "Celebrate learning",
];
export const transformable = (item: SceneElement) => !item.characterId && !item.backdrop &&
  (item.kind === "prop" || item.kind === "art");
export const appearancesFor = (prop?: PropName): readonly (readonly [PropAppearance, string])[] =>
  prop && Object.hasOwn(PROP_APPEARANCES, prop) ? PROP_APPEARANCES[prop as keyof typeof PROP_APPEARANCES] : [];
export const validAppearance = (prop: PropName | undefined, value: unknown): value is PropAppearance =>
  appearancesFor(prop).some(([appearance]) => appearance === value);
const id = (value: unknown): value is string => typeof value === "string" && !!value && value.length <= 100;
const keys = (value: object, fields: readonly string[]) => Object.keys(value).every(key => fields.includes(key));
const label = (value: unknown, limit: number) => typeof value === "string" && !!value.trim() && value.length <= limit;

export function actionTime(actions: Interaction[] | undefined, cue: ActionCue, objectId?: string) {
  const action = actions?.find(item => item.id === cue.interactionId && (!objectId || item.objectId === objectId));
  return action && interactionEvents(action).find(event => event.name === cue.moment)?.time;
}
export function changeTime(scene: Pick<Scene, "interactions">, track: ObjectTrack, change: ObjectChange) {
  return (change.cue && actionTime(scene.interactions, change.cue, track.objectId)) ?? change.at;
}
export function stepTime(scene: Scene, step: LearningStep) {
  const cue = step.cue;
  if (cue?.kind === "action") return actionTime(scene.interactions, cue) ?? step.at;
  if (cue?.kind === "change") {
    for (const track of scene.objectTracks ?? []) {
      const change = track.changes.find(item => item.id === cue.changeId);
      if (change) return changeTime(scene, track, change);
    }
  }
  return step.at;
}
const validCue = (value: unknown): value is ActionCue =>
  record(value) && id(value.interactionId) && typeof value.moment === "string" && value.moment.length <= 12;

export function transformIssue(value: unknown, scene: Pick<Scene, "duration" | "elements" | "interactions">,
  assets: Set<string>, unique: (id: string) => void = () => {}) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 20) return "Choose up to 20 scene objects for visual changes.";
  const objects = new Set<string>();
  for (const track of value) {
    if (!record(track) || !keys(track, ["objectId", "initial", "states", "changes"]) ||
        !id(track.objectId) || objects.has(track.objectId) || !id(track.initial) ||
        !Array.isArray(track.states) || track.states.length < 1 || track.states.length > MAX_OBJECT_STATES ||
        !Array.isArray(track.changes) || track.changes.length > MAX_CHANGES_PER_OBJECT)
      return "Use up to four named appearances and sixteen changes per object.";
    const object = scene.elements.find(item => item.id === track.objectId && transformable(item));
    if (!object) return "Choose an available scene object.";
    objects.add(track.objectId);
    const ids = new Set<string>();
    for (const state of track.states) {
      if (!record(state) || !keys(state, ["id", "name", "art"]) || !id(state.id) || ids.has(state.id) ||
          !label(state.name, 60) || !record(state.art)) return "Give each appearance a name and a unique identity.";
      const art = state.art;
      if (!(art.kind === "original" && keys(art, ["kind"])) &&
          !(art.kind === "prop" && keys(art, ["kind", "appearance"]) && validAppearance(object.prop, art.appearance)) &&
          !(art.kind === "image" && keys(art, ["kind", "assetId", "crop"]) && id(art.assetId) && assets.has(art.assetId) &&
            (art.crop === undefined || validCrop(art.crop))))
        return "Choose available artwork for each appearance.";
      ids.add(state.id);
      unique(state.id);
    }
    if (!ids.has(track.initial)) return "Choose a starting appearance.";
    const events: { at: number; end: number }[] = [];
    const changes = new Set<string>();
    for (const change of track.changes) {
      if (!record(change) || !keys(change, ["id", "to", "at", "transition", "length", "sparkle", "cue"]) ||
          !id(change.id) || changes.has(change.id) || !id(change.to) || !ids.has(change.to) ||
          !numberIn(change.at, 0, scene.duration) || typeof change.transition !== "string" ||
          !Object.hasOwn(TRANSITIONS, change.transition) || !numberIn(change.length, 0, 1.5) ||
          (change.transition === "cut" ? change.length !== 0 : change.length <= 0) ||
          (change.sparkle !== undefined && typeof change.sparkle !== "boolean"))
        return "Check the appearance, time, and length of each change.";
      const cue = change.cue;
      if (cue !== undefined && (!validCue(cue) || !keys(cue, ["interactionId", "moment"])))
        return "Choose an available interaction moment.";
      const at = cue ? actionTime(scene.interactions, cue, track.objectId) : change.at;
      if (at === undefined) return "Choose an available interaction moment for this object.";
      if (at + change.length > scene.duration + 1e-8) return "This change extends beyond the scene. Move it earlier or shorten it.";
      events.push({ at, end: at + change.length });
      changes.add(change.id);
      unique(change.id);
    }
    events.sort((a, b) => a.at - b.at);
    if (events.some((event, i) => i > 0 && (event.at - events[i - 1].at < 1e-8 || event.at < events[i - 1].end - 1e-8)))
      return "Two changes overlap. Move one to a different time or shorten it.";
  }
}

export function learningIssue(value: unknown, scene: Scene, unique: (id: string) => void = () => {}) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > MAX_LEARNING_STEPS) return "Use up to seven learning steps in one scene.";
  const lineIds = new Set(Array.isArray(scene.script?.lines) ?
    scene.script.lines.flatMap(line => record(line) && id(line.id) ? [line.id] : []) : []);
  const changeIds = new Set(scene.objectTracks?.flatMap(track => track.changes.map(change => change.id)));
  const ids = new Set<string>();
  for (const step of value) {
    if (!record(step) || !keys(step, ["id", "text", "at", "lineId", "cue"]) ||
        !id(step.id) || ids.has(step.id) || !label(step.text, 250) || !numberIn(step.at, 0, scene.duration) ||
        (step.lineId !== undefined && (!id(step.lineId) || !lineIds.has(step.lineId))))
      return "Give each step a description, a time within the scene, and an available script line if linked.";
    const cue = step.cue;
    if (cue !== undefined && (!record(cue) ||
        !(cue.kind === "change" && keys(cue, ["kind", "changeId"]) && id(cue.changeId) && changeIds.has(cue.changeId)) &&
        !(cue.kind === "action" && keys(cue, ["kind", "interactionId", "moment"]) && validCue(cue) &&
          actionTime(scene.interactions, cue) !== undefined)))
      return "Choose an available change or interaction moment for the step.";
    ids.add(step.id);
    unique(step.id);
  }
}
