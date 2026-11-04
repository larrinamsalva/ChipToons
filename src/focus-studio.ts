import { elementName } from "./library";
import { uid } from "./model";
import type { Project, Scene } from "./model";
import { INTERACTION_LABELS, interactionEvents } from "./interaction-model";
import { changeTime, stepTime } from "./transform-model";
import { FOCUS_STYLES, focusCueTime } from "./focus-model";
import type { FocusCue, FocusGraphic, FocusTarget } from "./focus-model";
import { clampFocus, focusAnchor, projectFocusPoint } from "./focus-motion";
import { stageCameraAt, sceneFramesAt } from "./timeline";

export type FocusSeed = { stepId?: string; changeId?: string; objectId?: string };
export const cueKey = (cue: FocusCue) => cue.kind === "action" ?
  JSON.stringify([cue.kind, cue.interactionId, cue.moment]) : JSON.stringify([cue.kind, cue.id]);

export function focusCueChoices(project: Project, scene: Scene) {
  return [
    ...(scene.learningSteps ?? []).map((step, index) => ({
      cue: { kind: "step" as const, id: step.id }, at: stepTime(scene, step),
      name: `Step ${index + 1} · ${step.text}`,
    })),
    ...(scene.objectTracks ?? []).flatMap(track => {
      const object = scene.elements.find(item => item.id === track.objectId);
      return track.changes.map(change => ({
        cue: { kind: "change" as const, id: change.id }, at: changeTime(scene, track, change),
        name: `${object ? elementName(project, object) : "Object"} → ${track.states.find(state => state.id === change.to)?.name ?? "Appearance"}`,
      }));
    }),
    ...(scene.interactions ?? []).flatMap(action => {
      const object = scene.elements.find(item => item.id === action.objectId);
      return interactionEvents(action).map(event => ({
        cue: { kind: "action" as const, interactionId: action.id, moment: event.name }, at: event.time,
        name: `${object ? elementName(project, object) : "Object"} · ${INTERACTION_LABELS[action.kind]} · ${event.name}`,
      }));
    }),
  ];
}

export function newFocusGraphic(scene: Scene, time: number, seed: FocusSeed = {}): FocusGraphic {
  const object = scene.elements.find(item => item.id === seed.objectId);
  const step = scene.learningSteps?.find(item => item.id === seed.stepId);
  const suggested: FocusCue | undefined = seed.changeId ? { kind: "change", id: seed.changeId } : undefined;
  const cueTime = suggested && focusCueTime(scene, suggested);
  const sourceAt = step && stepTime(scene, step);
  const at = clampFocus(sourceAt ?? cueTime ?? time, 0, Math.max(0, scene.duration - 0.25));
  const target: FocusTarget = object ? { kind: "object", id: object.id, x: object.x, y: object.y,
    dx: 0, dy: object.characterId ? -110 : -30 } : { kind: "screen", x: 400, y: 98 };
  return {
    id: uid(), kind: step ? "number" : "circle", style: "classroom", target, at,
    text: step?.text.slice(0, 60) ?? "", number: step ? (scene.learningSteps?.indexOf(step) ?? 0) + 1 : 1,
    size: step ? 46 : 82, textSize: 22, ink: FOCUS_STYLES.classroom.ink, paper: FOCUS_STYLES.classroom.paper,
    length: Math.min(2.6, scene.duration - at), fadeIn: 0.12, fadeOut: 0.12, reveal: false,
    ...(step ? { stepSource: { id: step.id, text: step.text, at: sourceAt! } } : {}),
    ...(suggested && cueTime !== undefined && cueTime < scene.duration ? { cue: suggested } : {}),
  };
}

export function reviewedFocusPlacement(project: Project, scene: Scene, graphic: FocusGraphic, time: number) {
  const frames = sceneFramesAt(project, scene, time);
  const camera = stageCameraAt(project, scene, time, false, frames);
  const point = focusAnchor(scene, graphic, frames, camera);
  const cast = scene.elements.flatMap(element => {
    const frame = frames.get(element.id);
    if (!element.characterId || !frame || frame.opacity < 0.3) return [];
    const center = projectFocusPoint(scene, element, frame, camera, { x: 0, y: -135 });
    const scale = frame.scale * camera.zoom;
    return [{ x: center.x - 40 * scale, y: center.y - 53 * scale, width: 80 * scale, height: 106 * scale }];
  });
  return { point: { x: clampFocus(point.x, 0, 800), y: clampFocus(point.y, 0, 450) }, cast,
    outside: point.x < 0 || point.x > 800 || point.y < 0 || point.y > 450 };
}
