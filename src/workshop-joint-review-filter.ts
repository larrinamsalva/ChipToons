import type { WorkshopJointDifference } from "./workshop-joint-differences";

/** Local, read-only grouping for the fifteen original workshop rig parts. */
export type WorkshopJointGroup = "all" | "arms" | "legs" | "body";
export type WorkshopJointOrder = "rig" | "rotation";

export interface WorkshopJointReview {
  rows: WorkshopJointDifference[];
  /** The largest nontrivial absolute rotation among visible joints, not contact quality. */
  largestRotationPartId?: string;
  total: number;
}

/** Filter and optionally rank the already-measured differences, without edits. */
export function workshopJointReview(
  differences: readonly WorkshopJointDifference[],
  group: WorkshopJointGroup = "all",
  order: WorkshopJointOrder = "rig",
): WorkshopJointReview {
  const inGroup = (role: string) => {
    const arms = /^(left|right)(Arm|Forearm|Hand)$/.test(role);
    const legs = /^(left|right)(Leg|Shin|Foot)$/.test(role);
    if (group === "arms") return arms;
    if (group === "legs") return legs;
    if (group === "body") return !arms && !legs;
    return true;
  };
  const rows = differences.filter(item => inGroup(item.role));
  if (order === "rotation")
    rows.sort((a, b) => Math.abs(b.angleDelta) - Math.abs(a.angleDelta));
  const strongest = rows.reduce<WorkshopJointDifference | undefined>(
    (chosen, item) =>
      Math.abs(item.angleDelta) > Math.abs(chosen?.angleDelta ?? 0)
        ? item : chosen,
    undefined,
  );
  return {
    rows,
    largestRotationPartId: strongest && Math.abs(strongest.angleDelta) > 0.1
      ? strongest.partId : undefined,
    total: differences.length,
  };
}
