import type { Project, Scene } from "./model";
import type { WorkshopMotionStep } from "./workshop-motion-steps";
import { resolvedCharacter } from "./library";
import { neutralJoint } from "./puppet-model";
import { sceneFramesAt, sceneStart } from "./timeline";
import { workshopAdjacentFramePair } from "./workshop-adjacent-frame-compare";
import { workshopMotionInspectionFrame } from "./workshop-motion-frame-stepper";

export interface WorkshopJointCurvePoint {
  index: number;
  seconds: number;
  angle: number;
  savedKeyframe: boolean;
}

export interface WorkshopJointMotionCurve {
  partId: string;
  label: string;
  points: WorkshopJointCurvePoint[];
  minAngle: number;
  maxAngle: number;
}

/**
 * Read-only sequence of the selected rig joint's actual Stage-sampled LOCAL
 * rotation during one validated recorded Workshop motion step, on the same
 * 24-fps inspection grid as frame-by-frame comparison.
 *
 * This is NOT a world-space path, physical motion-quality score, fabricated
 * keyframe or export setting. It never changes saved project data.
 */
export function workshopJointMotionCurve(
  project: Project,
  scene: Scene,
  actorId: string,
  step: WorkshopMotionStep | undefined,
  partId: string,
): WorkshopJointMotionCurve | undefined {
  // Same strict original-review-step validation as adjacent comparison;
  // an interior authored key cannot be substituted as a step endpoint.
  const firstPair = workshopAdjacentFramePair(scene, actorId, step, 0);
  if (!firstPair) return undefined;
  const actor = scene.elements.find(element => element.id === actorId);
  const rig = actor ? resolvedCharacter(project, actor)?.puppet : undefined;
  const part = rig?.parts.find(item => item.id === partId);
  if (!actor || !part || !step) return undefined;

  const last = firstPair.after.lastIndex;
  // Only sample bounded Workshop motions, not a long full episode.
  if (last < 1 || last > 720) return undefined;
  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  const globalStart = sceneIndex >= 0 && scene.elements.some(item => item.voiceMouth?.length)
    ? sceneStart(project, sceneIndex) : 0;

  const points: WorkshopJointCurvePoint[] = [];
  for (let index = 0; index <= last; index++) {
    const sample = workshopMotionInspectionFrame(scene, actorId, step, index);
    if (!sample) return undefined;
    const joints = sceneFramesAt(project, scene, sample.seconds, globalStart)
      .get(actorId)?.joints;
    if (!joints) return undefined;
    const angle = (joints[part.id] ?? neutralJoint).angle;
    if (!Number.isFinite(angle)) return undefined;
    points.push({
      index,
      seconds: sample.seconds,
      angle,
      savedKeyframe: sample.savedKeyframe,
    });
  }
  if (points.length < 2) return undefined;
  const title = part.role.replace(/([a-z])([A-Z])/g, "$1 $2");
  return {
    partId,
    label: title.charAt(0).toUpperCase() + title.slice(1),
    points,
    minAngle: Math.min(...points.map(point => point.angle)),
    maxAngle: Math.max(...points.map(point => point.angle)),
  };
}
