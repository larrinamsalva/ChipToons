import type { Scene } from "./model";
import type { PuppetRig } from "./puppet-model";
import { workshopJointDifferences } from "./workshop-joint-differences";
import { workshopSeatingReviewMoments } from "./workshop-seating-review";
import type { WorkshopReviewMoment } from "./workshop-seating-review";

/** A recorded transition between adjacent, actually saved review moments. */
export interface WorkshopMotionStep {
  id: string;
  from: WorkshopReviewMoment;
  to: WorkshopReviewMoment;
  changedJoints: number;
  /** Absolute local rig rotation in degrees, not a collision severity rating. */
  largestRotation: number;
  largestRotationRole?: string;
}

/**
 * Read-only transition cards for the original sit/wave/rise/stand action.
 * Every endpoint must be an already saved checkpoint from #160.
 * Measurement uses the same exact joint snapshots as #162/#163;
 * never generates intermediate animation or changes the playback clock.
 */
export function workshopMotionSteps(
  scene: Scene,
  actorId: string,
  rig?: PuppetRig,
): WorkshopMotionStep[] {
  if (!rig?.parts.length) return [];
  const moments = workshopSeatingReviewMoments(scene, actorId);
  return moments.slice(1).map((to, index) => {
    const from = moments[index];
    const differences = workshopJointDifferences(
      scene, actorId, rig, from.seconds, to.seconds,
    );
    const biggest = differences.reduce<typeof differences[number] | undefined>(
      (best, item) => Math.abs(item.angleDelta) > Math.abs(best?.angleDelta ?? 0)
        ? item : best,
      undefined,
    );
    return {
      id: `${from.id}-to-${to.id}`,
      from,
      to,
      changedJoints: differences.length,
      largestRotation: Math.abs(biggest?.angleDelta ?? 0),
      largestRotationRole: biggest && Math.abs(biggest.angleDelta) > .1
        ? biggest.label : undefined,
    };
  });
}
