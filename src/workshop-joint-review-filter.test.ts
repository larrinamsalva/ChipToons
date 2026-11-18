import { describe, expect, it } from "vitest";
import type { WorkshopJointDifference } from "./workshop-joint-differences";
import { workshopJointReview } from "./workshop-joint-review-filter";

function joint(role: string, angleDelta: number, xDelta = 0): WorkshopJointDifference {
  return {
    partId: role, label: role, role,
    beforeAngle: 0, afterAngle: angleDelta, angleDelta, xDelta, yDelta: 0,
  };
}

const changes = [
  joint("torso", -3),
  joint("head", 4),
  joint("leftArm", 15),
  joint("rightArm", -115),
  joint("leftForearm", 24),
  joint("rightHand", 0, 9),
  joint("leftLeg", 17),
  joint("rightShin", -36),
  joint("leftFoot", 12),
];

describe("PR #163 read-only body group and largest rotation review", () => {
  it("keeps exact original rig ordering by default and does not edit inputs", () => {
    const snapshot = JSON.stringify(changes);
    const all = workshopJointReview(changes);
    expect(all.rows.map(item => item.role)).toEqual(changes.map(item => item.role));
    expect(all.total).toBe(9);
    expect(all.largestRotationPartId).toBe("rightArm");
    expect(JSON.stringify(changes)).toBe(snapshot);
    expect(all.rows).not.toBe(changes);
  });

  it("classifies arms, elbows, hands; legs, shins, feet; and remaining body parts", () => {
    expect(workshopJointReview(changes, "arms").rows.map(row => row.role))
      .toEqual(["leftArm", "rightArm", "leftForearm", "rightHand"]);
    expect(workshopJointReview(changes, "legs").rows.map(row => row.role))
      .toEqual(["leftLeg", "rightShin", "leftFoot"]);
    expect(workshopJointReview(changes, "body").rows.map(row => row.role))
      .toEqual(["torso", "head"]);
    expect(workshopJointReview(changes, "legs").total).toBe(9);
    expect(workshopJointReview(changes, "legs").largestRotationPartId).toBe("rightShin");
    expect(workshopJointReview(changes, "body").largestRotationPartId).toBe("head");
  });

  it("sorts by absolute local rotation only, keeping stable rig order for equal values", () => {
    const source = [joint("leftArm", 20), joint("rightArm", -20), joint("leftHand", 3), joint("rightHand", 0, 15)];
    const snapshot = JSON.stringify(source);
    const ranking = workshopJointReview(source, "arms", "rotation");
    expect(ranking.rows.map(row => row.role))
      .toEqual(["leftArm", "rightArm", "leftHand", "rightHand"]);
    expect(ranking.largestRotationPartId).toBe("leftArm");
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(workshopJointReview(changes, "arms", "rotation").rows[0].role).toBe("rightArm");
    expect(workshopJointReview(changes, "all", "rotation").rows[0].role).toBe("rightArm");
  });

  it("does not mislabel a pixel-only offset as a large rotational change", () => {
    const offsets = [joint("rightHand", 0, 50), joint("leftArm", 0, 2)];
    expect(workshopJointReview(offsets).largestRotationPartId).toBeUndefined();
    expect(workshopJointReview(offsets, "arms", "rotation").rows.map(row => row.role))
      .toEqual(["rightHand", "leftArm"]);
  });

  it("returns safe empty lists and no highlight for filters without changes", () => {
    expect(workshopJointReview(changes, "legs", "rig").rows).toHaveLength(3);
    const armsOnly = [joint("rightArm", -88)];
    expect(workshopJointReview(armsOnly, "legs")).toEqual({
      rows: [], total: 1, largestRotationPartId: undefined,
    });
    expect(workshopJointReview([])).toEqual({
      rows: [], total: 0, largestRotationPartId: undefined,
    });
  });
});
