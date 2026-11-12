import type { Scene, SceneElement } from "./model";
import { cinematicEmotionReactionAt } from "./cinematic-emotion-reaction";
import { neutralJoint } from "./puppet-model";
import type { JointSnapshot, PuppetRig } from "./puppet-model";
import type { ElementFrame } from "./timeline";

/** Read-only free-upper-arm response to an ACTUALLY AUTHORED emotion change.
 * Never move arms that control story props, authored gestures or painted art.
 * Returns a small, temporary joints overlay, not a saved puppet pose.
 */
export function cinematicFreeArmReactionAt(
  scene: Pick<Scene, "interactions"> | undefined,
  element: SceneElement,
  rig: PuppetRig,
  frame: ElementFrame,
  localTime: number,
): JointSnapshot | undefined {
  if (!scene || element.assetId || frame.gesture !== "none" ||
      scene.interactions?.some(action => action.actorId === element.id ||
        action.transfer?.actorId === element.id)) return;
  const reaction = cinematicEmotionReactionAt(element, localTime);
  if (!reaction || Math.abs(reaction.headTilt) < 0.01) return;
  let joints: JointSnapshot | undefined;
  for (const side of ["left", "right"] as const) {
    const arm = rig.parts.find(part => part.role === side + "Arm");
    if (!arm || arm.assetId ||
        rig.parts.some(part => part.assetId && part.parentId === arm.id)) continue;
    const current = frame.joints?.[arm.id] ?? neutralJoint;
    // Even a currently neutral arm is reserved if the creator performs
    // with it anywhere in this scene. Never override authored choreography.
    const performed = element.animation?.keyframes.some(key => {
      const joint = key.joints?.[arm.id];
      return joint && (Math.abs(joint.angle) > 1.5 ||
        Math.abs(joint.x) > 1.5 || Math.abs(joint.y) > 1.5);
    });
    if (performed || Math.abs(current.angle) > 1.5 ||
        Math.abs(current.x) > 1.5 || Math.abs(current.y) > 1.5) continue;
    const amount = Math.max(-2.5, Math.min(2.5,
      reaction.headTilt * 1.5 * (side === "left" ? 1 : -1)));
    if (Math.abs(amount) < 0.01) continue;
    joints ??= { ...frame.joints };
    joints[arm.id] = { ...current, angle: current.angle + amount };
  }
  return joints;
}
