import type { Project, Scene } from "./model";
import { sceneStart, sceneFramesAt } from "./timeline";
import { resolvedCharacter } from "./library";
import { neutralJoint } from "./puppet-model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
import type { WorkshopJointDifference } from "./workshop-joint-differences";
import { workshopAdjacentFramePair } from "./workshop-adjacent-frame-compare";

export interface WorkshopAdjacentJointReview {
  beforeSeconds: number;
  afterSeconds: number;
  changes: WorkshopJointDifference[];
  /** Biggest local joint rotation in degrees. Not a movement quality score. */
  largestRotationPartId?: string;
}

/**
 * Measure actual Stage-rendered puppet joint samples at adjacent
 * 24-fps inspection frames. Reads real timeline output, not just
 * stored keyframe snapshots, and never edits the source animation.
 * Rotation/offset values are local; world contact and collisions
 * cannot be inferred from these values.
 */
export function workshopAdjacentJointReview(
  project: Project,
  scene: Scene,
  actorId: string,
  step: WorkshopMotionStep | undefined,
  selectedIndex: number,
): WorkshopAdjacentJointReview | undefined {
  const pair = workshopAdjacentFramePair(scene, actorId, step, selectedIndex);
  if (!pair) return undefined;
  const actor = scene.elements.find(item => item.id === actorId);
  const rig = actor ? resolvedCharacter(project, actor)?.puppet : undefined;
  if (!actor || !rig?.parts.length) return undefined;
  // Match Stage.tsx: voice time is global only for scenes with voice mouths.
  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  const globalStart = sceneIndex >= 0 && scene.elements.some(item => item.voiceMouth?.length)
    ? sceneStart(project, sceneIndex) : 0;
  const before = sceneFramesAt(project, scene, pair.before.seconds, globalStart)
    .get(actorId)?.joints;
  const after = sceneFramesAt(project, scene, pair.after.seconds, globalStart)
    .get(actorId)?.joints;
  if (!before || !after) return undefined;

  const changes: WorkshopJointDifference[] = [];
  for (const part of rig.parts) {
    const from = before[part.id] ?? neutralJoint;
    const to = after[part.id] ?? neutralJoint;
    if (![from.angle, from.x, from.y, to.angle, to.x, to.y]
      .every(Number.isFinite)) continue;
    const angleDelta = to.angle - from.angle;
    const xDelta = to.x - from.x;
    const yDelta = to.y - from.y;
    // A single 24-fps step is much smaller than a saved-pose transition.
    // Show genuine changes at a finer threshold without inventing motion.
    if (Math.max(Math.abs(angleDelta), Math.abs(xDelta), Math.abs(yDelta)) <= 0.01)
      continue;
    const title = part.role.replace(/([a-z])([A-Z])/g, "$1 $2");
    changes.push({
      partId: part.id,
      label: title.charAt(0).toUpperCase() + title.slice(1),
      role: part.role,
      beforeAngle: from.angle,
      afterAngle: to.angle,
      angleDelta,
      xDelta,
      yDelta,
    });
  }
  changes.sort((a, b) =>
    Math.abs(b.angleDelta) - Math.abs(a.angleDelta));
  const largest = changes.find(change => Math.abs(change.angleDelta) > 0.01);
  return {
    beforeSeconds: pair.before.seconds,
    afterSeconds: pair.after.seconds,
    changes,
    largestRotationPartId: largest?.partId,
  };
}
