import type { SceneElement, Project } from "./model";
import type { Grip } from "./interaction-model";
import type { PuppetRig } from "./puppet-model";
import type { InteractionFrame } from "./interaction-motion";

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * A render-only palm curl / subtle wrist turn tied to the same eased action
 * strength that controls hand pickup and transfer. It never creates joints
 * for legacy one-piece puppets or changes a saved animator keyframe.
 *
 * An authored hand pose, a painted palm, incomplete parent chain, Classic
 * project or calm edit preview always wins over this cinematic helper.
 */
export function cinematicGripAt(
  project: Pick<Project, "visualStyle">,
  rig: PuppetRig | undefined,
  actor: SceneElement,
  frame: InteractionFrame,
  grip: Grip,
  strength: number,
  calm: boolean,
): InteractionFrame {
  if (project.visualStyle !== "storybook-cinematic" || calm ||
      !rig || actor.assetId || !Number.isFinite(strength) ||
      (grip.hand !== "left" && grip.hand !== "right") || strength <= 0) return frame;
  const side = grip.hand;
  const arm = rig.parts.find(part => part.role === `${side}Arm`);
  const forearm = rig.parts.find(part => part.role === `${side}Forearm` && part.parentId === arm?.id);
  const hand = rig.parts.find(part => part.role === `${side}Hand` && part.parentId === forearm?.id);
  if (!arm || !forearm || !hand || hand.assetId || forearm.assetId ||
      frame.joints?.[hand.id]) return frame;

  const curl = clamp(strength);
  // A small wrist correction makes the palm turn as the fingers close.
  // handAt reads this same joint, keeping the held prop anchored precisely.
  const turn = (side === "left" ? -1 : 1) * 9 * curl;
  return {
    ...frame,
    joints: { ...frame.joints, [hand.id]: { x: 0, y: 0, angle: turn } },
    gripCurl: { ...frame.gripCurl, [side]: curl },
  };
}
