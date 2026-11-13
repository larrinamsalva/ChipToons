import type { Project, Scene, SceneElement } from "./model";
import type { ElementFrame } from "./timeline";

const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** A warm last look to the audience only in an explicitly authored FINAL
 * wide camera shot. Pupil/facial accent only: no head/keyframe/camera,
 * sound, lip-sync, script or source media is changed or synthesized. */
export interface FinaleAttention {
  /** Audience gaze stays centered in the generated face coordinates. */
  dx: 0;
  dy: 0;
  focus: number;
}

export function cinematicFinaleAttentionAt(
  project: Project,
  scene: Scene,
  element: SceneElement,
  frames: ReadonlyMap<string, ElementFrame>,
  time: number,
  calm: boolean,
): FinaleAttention | undefined {
  if (calm || project.visualStyle !== "storybook-cinematic" ||
      !Number.isFinite(time) || time < 0 || time >= scene.duration ||
      !element.characterId || !!element.assetId) return;

  const shot = scene.cameraShots?.at(-1);
  if (!shot || shot.style !== "wide" || shot.targets.length !== 0 ||
      shot.end - shot.start < 1.8 ||
      Math.abs(shot.end - scene.duration) > .001 ||
      time < shot.start || time >= shot.end) return;

  const actors = scene.elements.filter(item => !!item.characterId);
  const index = actors.findIndex(item => item.id === element.id);
  if (index < 0 || actors.length < 2) return;
  const frame = frames.get(element.id);
  if (!frame || frame.opacity < .1 || frame.gesture !== "none" ||
      (frame.voiceOpening ?? 0) > .06) return;

  // Only the creator's existing fully visible vector puppet eyes may move.
  const character = project.characters.find(item => item.id === element.characterId);
  const rig = character?.puppet;
  if (!rig?.face || character?.assetId ||
      !rig.parts.some(part => part.role === "head" && !part.assetId) ||
      rig.parts.some(part => part.role === "eyes" && part.assetId)) return;

  if (scene.interactions?.some(action =>
    (action.actorId === element.id ||
      action.transfer?.actorId === element.id) &&
    time >= action.start && time <= action.finish)) return;

  // Let the saved camera finish its actual move before anyone looks out.
  // Scout leads, Jo follows a fraction later, without changing either rig.
  const delay = Math.max(0, shot.move) + .14 + index * .14;
  if (time <= shot.start + delay || shot.end - shot.start - delay < .5)
    return;
  const focus = .94 * ease((time - shot.start - delay) / .55);
  if (focus < .035) return;
  return { dx: 0, dy: 0, focus };
}
