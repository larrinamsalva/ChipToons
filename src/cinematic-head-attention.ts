import type { Project, Scene, SceneElement } from "./model";
import { neutralJoint } from "./puppet-model";
import type { InteractionFrame } from "./interaction-motion";

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * A small head-turn toward the moving prop in an authored interaction.
 * Applied after interaction sampling, so the look direction follows the
 * ACTUAL carried object instead of its old starting position. All adjustments
 * exist only in a rendered frame; no saved joint/keyframe is ever modified.
 *
 * This complements the existing cinematic gaze and authored head motion.
 * No change is made outside an interaction, in Classic mode, or in calm edits.
 */
export function cinematicActionHeadAt(
  project: Pick<Project, "visualStyle" | "characters">,
  scene: Pick<Scene, "interactions">,
  element: SceneElement,
  frame: InteractionFrame,
  frames: ReadonlyMap<string, InteractionFrame>,
  time: number,
  calm: boolean,
): InteractionFrame {
  if (calm || project.visualStyle !== "storybook-cinematic" ||
      !element.characterId || !Number.isFinite(time)) return frame;
  const character = project.characters.find(item => item.id === element.characterId);
  const rig = character?.puppet;
  const head = rig?.parts.find(part => part.role === "head");
  if (!head || head.assetId) return frame;

  const action = scene.interactions?.find(item => {
    const receiving = item.transfer?.actorId === element.id;
    const giving = item.actorId === element.id;
    if (!giving && !receiving) return false;
    const from = receiving ? Math.max(item.attach, item.transfer!.time - 0.55) : item.start;
    const until = receiving
      ? (item.release?.time ?? item.finish)
      : (item.transfer?.time ?? item.release?.time ?? item.finish);
    return time >= from && time <= until;
  });
  if (!action) return frame;

  const receiver = action.transfer?.actorId === element.id;
  const from = receiver
    ? Math.max(action.attach, action.transfer!.time - 0.55) : action.start;
  const until = receiver
    ? (action.release?.time ?? action.finish)
    : (action.transfer?.time ?? action.release?.time ?? action.finish);
  const prop = frames.get(action.objectId);
  if (!prop || prop.opacity < 0.1) return frame;
  const dx = prop.x - frame.x, dy = prop.y - frame.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 10 || distance > 370) return frame;

  // A readable but restrained look, blending into the author's existing
  // head pose. At the exact start and finish of a gesture the offset is zero.
  const weight = smooth((time - from) / 0.36) *
    smooth((until - time) / 0.34);
  const delta = clamp(dx / 35, -5.5, 5.5) *
    (element.flip ? -1 : 1) * weight;
  if (Math.abs(delta) < 0.00001) return frame;

  const authored = frame.joints?.[head.id] ?? neutralJoint;
  return {
    ...frame,
    joints: {
      ...frame.joints,
      [head.id]: { ...authored, angle: authored.angle + delta },
    },
  };
}
