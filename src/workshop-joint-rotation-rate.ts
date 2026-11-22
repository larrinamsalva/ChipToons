import type { WorkshopJointMotionCurve } from "./workshop-joint-motion-curve";

export interface WorkshopJointRotationRateInterval {
  /** The ending original Stage inspection frame (1-based within points). */
  afterIndex: number;
  beforeSeconds: number;
  afterSeconds: number;
  angleDelta: number;
  degreesPerSecond: number;
}

export interface WorkshopJointRotationRates {
  partId: string;
  label: string;
  intervals: WorkshopJointRotationRateInterval[];
  minRate: number;
  maxRate: number;
  maxAbsoluteRate: number;
}

/**
 * A read-only, signed local joint-angle change per second. All source angles
 * are the genuine Stage-resolved values provided by workshopJointMotionCurve.
 * Each interval uses its actual sample duration (including a short final
 * 24-fps interval). This does not measure world-space speed, foot contact,
 * collision, or artistic animation quality.
 */
export function workshopJointRotationRates(
  curve: WorkshopJointMotionCurve | undefined,
): WorkshopJointRotationRates | undefined {
  if (!curve || curve.points.length < 2 || curve.points.length > 721) {
    return undefined;
  }
  const intervals: WorkshopJointRotationRateInterval[] = [];
  for (let index = 1; index < curve.points.length; index++) {
    const before = curve.points[index - 1];
    const after = curve.points[index];
    const duration = after.seconds - before.seconds;
    if (before.index !== index - 1 || after.index !== index ||
      !Number.isFinite(before.seconds) || !Number.isFinite(after.seconds) ||
      !Number.isFinite(before.angle) || !Number.isFinite(after.angle) ||
      !Number.isFinite(duration) || duration <= 0) {
      return undefined;
    }
    const angleDelta = after.angle - before.angle;
    const degreesPerSecond = angleDelta / duration;
    if (!Number.isFinite(degreesPerSecond)) return undefined;
    intervals.push({
      afterIndex: index,
      beforeSeconds: before.seconds,
      afterSeconds: after.seconds,
      angleDelta,
      degreesPerSecond,
    });
  }
  const speeds = intervals.map(item => item.degreesPerSecond);
  const minRate = Math.min(...speeds);
  const maxRate = Math.max(...speeds);
  return {
    partId: curve.partId,
    label: curve.label,
    intervals,
    minRate,
    maxRate,
    maxAbsoluteRate: Math.max(Math.abs(minRate), Math.abs(maxRate)),
  };
}
