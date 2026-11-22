import type { WorkshopJointRotationRates } from "./workshop-joint-rotation-rate";

export interface WorkshopRotationRateChange {
  /** 0-based index of the shared real Stage frame between two intervals. */
  sharedFrameIndex: number;
  /** 0-based end index of the later interval, for adjacent-frame review. */
  afterFrameIndex: number;
  seconds: number;
  rateBefore: number;
  rateAfter: number;
  rateDelta: number;
  /** Difference of two interval midpoints, not an assumed 24-fps duration. */
  midpointSpacingSeconds: number;
  degreesPerSecondSquared: number;
}

export interface WorkshopRotationChangeReview {
  partId: string;
  label: string;
  totalChanges: number;
  largest: WorkshopRotationRateChange[];
}

/**
 * Finds the biggest finite differences between neighboring *signed local*
 * joint angular rates. Inputs originate from actual Stage-sampled angles and
 * timestamps. Sorting is descriptive, not a judgement of animation quality:
 * a strong change may be intentional. No project/keyframe mutation.
 */
export function workshopLargestRotationRateChanges(
  rates: WorkshopJointRotationRates | undefined,
  maxResults = 5,
): WorkshopRotationChangeReview | undefined {
  if (!rates || rates.intervals.length < 2 || rates.intervals.length > 720 ||
    !Number.isInteger(maxResults) || maxResults < 1 || maxResults > 10) {
    return undefined;
  }

  const changes: WorkshopRotationRateChange[] = [];
  for (let index = 1; index < rates.intervals.length; index++) {
    const before = rates.intervals[index - 1];
    const after = rates.intervals[index];
    // These must be consecutive, genuine samples from the same Stage curve.
    if (before.afterIndex !== index || after.afterIndex !== index + 1 ||
      !Number.isFinite(before.beforeSeconds) ||
      !Number.isFinite(before.afterSeconds) ||
      !Number.isFinite(after.beforeSeconds) ||
      !Number.isFinite(after.afterSeconds) ||
      !Number.isFinite(before.degreesPerSecond) ||
      !Number.isFinite(after.degreesPerSecond) ||
      before.afterSeconds <= before.beforeSeconds ||
      after.afterSeconds <= after.beforeSeconds ||
      Math.abs(before.afterSeconds - after.beforeSeconds) > 0.000001) {
      return undefined;
    }
    const beforeMidpoint = (before.beforeSeconds + before.afterSeconds) / 2;
    const afterMidpoint = (after.beforeSeconds + after.afterSeconds) / 2;
    const spacing = afterMidpoint - beforeMidpoint;
    const rateDelta = after.degreesPerSecond - before.degreesPerSecond;
    const acceleration = rateDelta / spacing;
    if (!Number.isFinite(spacing) || spacing <= 0 ||
      !Number.isFinite(acceleration)) return undefined;

    changes.push({
      sharedFrameIndex: before.afterIndex,
      afterFrameIndex: after.afterIndex,
      seconds: before.afterSeconds,
      rateBefore: before.degreesPerSecond,
      rateAfter: after.degreesPerSecond,
      rateDelta,
      midpointSpacingSeconds: spacing,
      degreesPerSecondSquared: acceleration,
    });
  }
  const largest = [...changes]
    .sort((left, right) => Math.abs(right.degreesPerSecondSquared) -
      Math.abs(left.degreesPerSecondSquared) ||
      left.sharedFrameIndex - right.sharedFrameIndex)
    .slice(0, maxResults);
  return {
    partId: rates.partId,
    label: rates.label,
    totalChanges: changes.length,
    largest,
  };
}
