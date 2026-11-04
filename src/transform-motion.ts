import type { Scene } from "./model";
import type { LearningStep, ObjectTrack } from "./transform-model";
import { actionTime, changeTime, stepTime, transformable } from "./transform-model";

export function objectAppearanceAt(scene: Pick<Scene, "interactions">, track: ObjectTrack, time: number, calm = false) {
  let id = track.initial, opacity = 1, reveal = 1, sparkle = 0;
  const changes = track.changes.map(change => ({ change, at: changeTime(scene, track, change) })).sort((a, b) => a.at - b.at);
  for (const { change, at } of changes) {
    if (at > time) break;
    const elapsed = time - at;
    const progress = change.length === 0 ? 1 : Math.min(1, elapsed / change.length);
    // A fade switches at its dimmest point. Only one artwork instance is ever painted.
    if (change.transition !== "fade" || progress >= 0.5) id = change.to;
    opacity = change.transition === "fade" ? 1 - (1 - Math.abs(2 * progress - 1)) * 0.92 : 1;
    reveal = change.transition === "reveal" ? progress : 1;
    const sinceFinish = elapsed - change.length;
    sparkle = change.sparkle && sinceFinish >= 0 && sinceFinish < 0.65
      ? calm ? 0.82 : 1 - sinceFinish / 0.65 : 0;
  }
  return { state: track.states.find(state => state.id === id), opacity, reveal, sparkle };
}

export function reconcileLearningSteps(scene: Scene, previous = scene): LearningStep[] | undefined {
  if (!scene.learningSteps?.length) return scene.learningSteps;
  const changes = new Set(scene.objectTracks?.flatMap(track => track.changes.map(change => change.id)));
  return scene.learningSteps.map(step => {
    const cue = step.cue;
    const missing = cue?.kind === "change" ? !changes.has(cue.changeId) :
      cue?.kind === "action" && actionTime(scene.interactions, cue) === undefined;
    const lineId = scene.script?.lines.some(line => line.id === step.lineId) ? step.lineId : undefined;
    const old = missing ? previous.learningSteps?.find(item => item.id === step.id) : undefined;
    if (!missing && lineId === step.lineId) return step;
    return { ...step, lineId, ...(missing ? { cue: undefined, at: old ? Math.min(scene.duration, stepTime(previous, old)) : step.at } : {}) };
  });
}

export function reconcileTransformReferences(scene: Scene, previous = scene): Scene {
  if (!scene.objectTracks?.length && !scene.learningSteps?.length) return scene;
  const objectTracks = scene.objectTracks?.filter(track => scene.elements.some(item => item.id === track.objectId && transformable(item)))
    .map(track => ({
      ...track,
      changes: track.changes.map(change => {
        if (!change.cue || actionTime(scene.interactions, change.cue, track.objectId) !== undefined) return change;
        const at = actionTime(previous.interactions, change.cue, track.objectId) ?? change.at;
        return { ...change, at: Math.min(scene.duration - change.length, at), cue: undefined };
      }),
    }));
  const next = { ...scene, objectTracks };
  return { ...next, learningSteps: reconcileLearningSteps(next, previous) };
}
