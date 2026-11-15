import { describe, expect, it } from "vitest";
import { cinematicStopSettleAt } from "./cinematic-stop-settle";

const walkingRight = (time: number) => ({
  x: 170 + 60 * Math.min(3, Math.max(0, time)), y: 365,
});
const walkingLeft = (time: number) => ({
  x: 350 - 60 * Math.min(3, Math.max(0, time)), y: 365,
});

describe("PR #132 subtle character stop follow-through", () => {
  it("adds a brief restrained counter-lean only when an authored walk ends", () => {
    expect(cinematicStopSettleAt(1.5, 5, walkingRight))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
    const ending = cinematicStopSettleAt(3.2, 5, walkingRight);
    expect(ending.torsoTilt).toBeGreaterThan(.5);
    expect(ending.torsoTilt).toBeLessThanOrEqual(1.1);
    expect(ending.headTilt).toBeCloseTo(-ending.torsoTilt * 1.5, 8);
    expect(cinematicStopSettleAt(3.2, 5, walkingRight)).toEqual(ending);
    expect(cinematicStopSettleAt(4.2, 5, walkingRight))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
  });

  it("mirrors opposite walking direction and never changes a static actor", () => {
    const right = cinematicStopSettleAt(3.2, 5, walkingRight);
    const left = cinematicStopSettleAt(3.2, 5, walkingLeft);
    expect(left.torsoTilt).toBeCloseTo(-right.torsoTilt, 8);
    expect(left.headTilt).toBeCloseTo(-right.headTilt, 8);
    expect(cinematicStopSettleAt(3.2, 5, () => ({ x: 220, y: 365 })))
      .toEqual({ torsoTilt: 0, headTilt: 0 });
  });

  it("avoids fake stop reactions outside the scene or at time boundaries", () => {
    for (const time of [-1, 0, 0.2, 5, Number.NaN]) {
      expect(cinematicStopSettleAt(time, 5, walkingRight))
        .toEqual({ torsoTilt: 0, headTilt: 0 });
    }
  });
});
