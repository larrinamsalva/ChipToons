import type { Scene, SceneElement } from "./model";
import { neutralJoint } from "./puppet-model";
import type { JointSnapshot, PuppetRig } from "./puppet-model";
import type { ElementFrame } from "./timeline";
import type { CinematicTurnAnticipation } from "./cinematic-turn-anticipation";

/** Non-destructive upper-arm follow-through at a real AUTHOR-authored
 * change of walking direction. Turn timing and direction are computed by
 * the existing deterministic turnaround sampler.
 *
 * Never move an arm reserved for a recorded gesture, a prop handoff, an
 * artist-authored arm pose, or imported/painted artwork. Emotional acting
 * takes priority where both layers could address the same joint.
 */
export function cinematicTurnFreeArmsAt(
  scene: Pick<Scene, "interactions"> | undefined,
  element: SceneElement,
  rig: PuppetRig,
  frame: ElementFrame,
  turn: Pick<CinematicTurnAnticipation, "headTilt">,
): JointSnapshot | undefined {
  if (!scene || element.assetId || frame.gesture !== "none" ||
      !Number.isFinite(turn.headTilt) || Math.abs(turn.headTilt) < 0.05 ||
      scene.interactions?.some(action =>
        action.actorId === element.id || action.transfer?.actorId === element.id))
    return;

  let joints: JointSnapshot | undefined;
  for (const side of ["left", "right"] as const) {
    const arm = rig.parts.find(part => part.role === `${side}Arm`);
    if (!arm || arm.assetId ||
        rig.parts.some(part => part.assetId && part.parentId === arm.id))
      continue;

    const current = frame.joints?.[arm.id] ?? neutralJoint;
    const performed = element.animation?.keyframes.some(key => {
      const pose = key.joints?.[arm.id];
      return pose && (Math.abs(pose.angle) > 1.5 ||
        Math.abs(pose.x) > 1.5 || Math.abs(pose.y) > 1.5);
    });
    if (performed || Math.abs(current.angle) > 1.5 ||
        Math.abs(current.x) > 1.5 || Math.abs(current.y) > 1.5)
      continue;

    // Opposing upper-arm motion makes the real turnaround read less
    // wooden, but remains smaller than authored gestures and handoffs.
    const signed = turn.headTilt * (side === "left" ? 1 : -1) * 1.85;
    const amount = Math.max(-2.5, Math.min(2.5, signed));
    if (Math.abs(amount) < 0.05) continue;
    joints ??= {};
    joints[arm.id] = { ...current, angle: current.angle + amount };
  }
  return joints;
}
