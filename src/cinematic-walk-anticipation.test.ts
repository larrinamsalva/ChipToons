import { describe, expect, it } from "vitest";
import { cinematicWalkAnticipationAt } from "./cinematic-walk-anticipation";

const stepsRight = (time: number) => ({
  x: 170 + 60 * Math.max(0, Math.min(2, time - 1)), y: 365,
});
const stepsLeft = (time: number) => ({
  x: 350 - 60 * Math.max(0, Math.min(2, time - 1)), y: 365,
});

describe("PR #133 character walking anticipation", () => {
  it("prepares a subtle opposite lean before the creator's actual walking start", () => {
    const before = cinematicWalkAnticipationAt(.85, 5, stepsRight);
    expect(before.torsoTilt).toBeLessThan(-.3);
    expect(before.torsoTilt).toBeGreaterThanOrEqual(-1);
    expect(before.headTilt).toBeCloseTo(-before.torsoTilt * 1.45, 8);
    expect(cinematicWalkAnticipationAt(.85, 5, stepsRight)).toEqual(before);
    expect(cinematicWalkAnticipationAt(.58, 5, stepsRight))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
    expect(cinematicWalkAnticipationAt(1.15, 5, stepsRight))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
  });

  it("mirrors left and right starts but never moves an idle or vertical-only actor", () => {
    const right = cinematicWalkAnticipationAt(.85, 5, stepsRight);
    const left = cinematicWalkAnticipationAt(.85, 5, stepsLeft);
    expect(left.torsoTilt).toBeCloseTo(-right.torsoTilt, 8);
    expect(left.headTilt).toBeCloseTo(-right.headTilt, 8);
    expect(cinematicWalkAnticipationAt(.85, 5, () => ({ x: 200, y: 365 })))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
    expect(cinematicWalkAnticipationAt(.85, 5, t => ({
      x: 200, y: 365 + 60 * Math.max(0, t - 1),
    }))).toEqual({ torsoTilt: 0, headTilt: 0 });
  });

  it("does not invent a step in constant-speed motion or outside scene limits", () => {
    expect(cinematicWalkAnticipationAt(.85, 5, t => ({ x: 170 + 60 * t, y: 365 })))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
    for (const time of [-1, 0, .2, 4.8, 5, Number.NaN]) {
      expect(cinematicWalkAnticipationAt(time, 5, stepsRight))
        .toEqual({ torsoTilt: 0, headTilt: 0 });
    }
  });
});
