import type { Project, Scene, SceneElement } from "./model";
import { neutralJoint } from "./puppet-model";
import type { InteractionFrame } from "./interaction-motion";

/**
 * A brief, gentle, shared acknowledgment AFTER a finished handoff.
 * It does not add a scene action, revise the recorded story, or shift the
 * saved prop. Both performers have slightly staggered nods and look toward
 * one another while the animation settles back into the authored pose.
 */
export interface HandoffAcknowledgement {
  partnerId: string;
  /** Smooth envelope, used for pupil attention and the small nod. */
  attention: number;
  /** Small additive head angle in degrees. */
  nod: number;
}

export function handoffAcknowledgementAt(
  project: Pick<Project, "visualStyle" | "characters">,
  scene: Pick<Scene, "duration" | "interactions" | "elements">,
  element: SceneElement,
  time: number,
  calm: boolean,
): HandoffAcknowledgement | undefined {
  if (project.visualStyle !== "storybook-cinematic" || calm ||
      !element.characterId || !Number.isFinite(time)) return;
  const character = project.characters.find(item => item.id === element.characterId);
  const head = character?.puppet?.parts.find(part => part.role === "head");
  if (!head || head.assetId || element.assetId || character?.assetId) return;

  const action = scene.interactions?.find(item =>
    (item.kind === "give" || item.kind === "receive") &&
    item.transfer && item.release &&
    (item.actorId === element.id || item.transfer.actorId === element.id) &&
    time >= item.release.time &&
    time < Math.min(scene.duration, item.release.time + 1.4));
  if (!action?.transfer || !action.release) return;

  const isReceiver = action.transfer.actorId === element.id;
  const partnerId = isReceiver ? action.actorId : action.transfer.actorId;
  if (!scene.elements.some(item => item.id === partnerId && !!item.characterId)) return;

  // Respect new, separately authored actions, rather than nodding over an
  // unrelated reach or handoff. Timing is deterministic and nonpersistent.
  if (scene.interactions?.some(other =>
    other.id !== action.id && time >= other.start && time < other.finish &&
    (other.actorId === element.id || other.transfer?.actorId === element.id)))
    return;

  // The receiver responds just after the giver, rather than both performers
  // nodding in mechanical lockstep. Easing is zero at both boundaries.
  const start = action.release.time + (isReceiver ? 0.19 : 0.04);
  const end = Math.min(scene.duration, start + 1.04);
  if (end <= start || time <= start || time >= end) return;
  const progress = (time - start) / (end - start);
  const attention = Math.sin(Math.PI * progress) ** 2;
  return {
    partnerId,
    attention,
    nod: (isReceiver ? -2.2 : -2.8) * attention,
  };
}

/** Add only a temporary nod on the rendered frame; authored keys win. */
export function cinematicHandoffNodAt(
  project: Pick<Project, "visualStyle" | "characters">,
  scene: Pick<Scene, "duration" | "interactions" | "elements">,
  element: SceneElement,
  frame: InteractionFrame,
  time: number,
  calm: boolean,
): InteractionFrame {
  const cue = handoffAcknowledgementAt(project, scene, element, time, calm);
  if (!cue) return frame;
  const character = project.characters.find(item => item.id === element.characterId);
  const head = character?.puppet?.parts.find(part => part.role === "head");
  if (!head) return frame;
  const authored = frame.joints?.[head.id] ?? neutralJoint;
  return {
    ...frame,
    joints: {
      ...frame.joints,
      [head.id]: { ...authored, angle: authored.angle + cue.nod },
    },
  };
}
