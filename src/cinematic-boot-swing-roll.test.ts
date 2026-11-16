import { describe, expect, it } from "vitest";
import { cinematicBootSwingRollAt } from "./cinematic-boot-swing-roll";

describe("PR #139 boot swing rocker", () => {
  it("keeps support feet flat through stance and at both swing boundaries", () => {
    for (const p of [0, .2, .4, .58, 1, 1.5, -1]) {
      expect(cinematicBootSwingRollAt(p, 1)).toBe(0);
    }
  });

  it("adds a bounded reversible toe rise only during actual forward swing", () => {
    const center = .58 + .42 * .5;
    expect(cinematicBootSwingRollAt(center, 10)).toBeCloseTo(5, 8);
    expect(cinematicBootSwingRollAt(center, -10)).toBeCloseTo(-5, 8);
    expect(cinematicBootSwingRollAt(center, 0)).toBe(0);
    expect(cinematicBootSwingRollAt(center, 10)).toBe(cinematicBootSwingRollAt(center, 10));
    for (let i = 0; i <= 100; i++) {
      const angle = cinematicBootSwingRollAt(i / 100, -1);
      expect(Number.isFinite(angle)).toBe(true);
      expect(Math.abs(angle)).toBeLessThanOrEqual(5.0001);
    }
    expect(Math.abs(cinematicBootSwingRollAt(.581, 10))).toBeLessThan(.05);
    expect(Math.abs(cinematicBootSwingRollAt(.999, 10))).toBeLessThan(.05);
  });

  it("does not introduce a rotation for invalid sampling or vertical-only travel", () => {
    for (const p of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(cinematicBootSwingRollAt(p, 1)).toBe(0);
    }
    expect(cinematicBootSwingRollAt(.79, Number.NaN)).toBe(0);
    expect(cinematicBootSwingRollAt(.79, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
