import { describe, expect, it } from "vitest";
import { cinematicTurnAnticipationAt } from "./cinematic-turn-anticipation";

const rightThenLeft = (t: number) => ({
  x: t < 2 ? 170 + 60 * t : 290 - 60 * (t - 2), y: 365,
});
const leftThenRight = (t: number) => ({
  x: t < 2 ? 350 - 60 * t : 230 + 60 * (t - 2), y: 365,
});

describe("PR #136 cinematic direction reversal", () => {
  it("makes the head lead a real right-to-left turn with a restrained opposite torso lean", () => {
    const turn = cinematicTurnAnticipationAt(2, 5, rightThenLeft);
    expect(turn.headTilt).toBeLessThan(-1.1);
    expect(turn.torsoTilt).toBeGreaterThan(.7);
    expect(Math.abs(turn.headTilt)).toBeLessThanOrEqual(1.35);
    expect(cinematicTurnAnticipationAt(2, 5, rightThenLeft)).toEqual(turn);
    expect(cinematicTurnAnticipationAt(1, 5, rightThenLeft))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
    expect(cinematicTurnAnticipationAt(3, 5, rightThenLeft))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
  });

  it("mirrors a left-to-right turn without moving actors who only stop", () => {
    const left = cinematicTurnAnticipationAt(2, 5, rightThenLeft);
    const right = cinematicTurnAnticipationAt(2, 5, leftThenRight);
    expect(right.torsoTilt).toBeCloseTo(-left.torsoTilt, 8);
    expect(right.headTilt).toBeCloseTo(-left.headTilt, 8);
    const stops = (t: number) => ({ x: 170 + 60 * Math.min(2, t), y: 365 });
    expect(cinematicTurnAnticipationAt(2, 5, stops))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
    expect(cinematicTurnAnticipationAt(2, 5, t => ({ x: 200, y: 60 * t })))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
  });

  it("ignores constant-speed, still, non-finite and near-boundary samples", () => {
    const still = { torsoTilt: 0, headTilt: 0 };
    expect(cinematicTurnAnticipationAt(2, 5, t => ({ x: 100 + 60 * t, y: 365 })))
      .toEqual(still);
    expect(cinematicTurnAnticipationAt(2, 5, () => ({ x: 100, y: 365 })))
      .toEqual(still);
    for (const time of [-1, 0, .2, 4.8, 5, Number.NaN])
      expect(cinematicTurnAnticipationAt(time, 5, rightThenLeft)).toEqual(still);
  });
});
