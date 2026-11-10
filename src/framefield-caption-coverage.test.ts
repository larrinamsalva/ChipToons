import { describe, expect, it } from "vitest";
import { framefieldCueTimingCoverage as coverage } from "./framefield-caption-coverage";

describe("Non-destructive voice interval coverage of caption cue times", () => {
  it("reports zero coverage with the full cue uncovered", () => {
    expect(coverage(10, 12, [])).toEqual({
      coveredSeconds: 0,
      coverageFraction: 0,
      gaps: [{ start: 10, end: 12 }],
    });
  });
  it("reports partial interval coverage, including the uncovered tail", () => {
    expect(coverage(0, 2, [{start: 0, end: 0.3}])).toEqual({
      coveredSeconds: 0.3,
      coverageFraction: 0.15,
      gaps: [{ start: 0.3, end: 2 }],
    });
  });
  it("merges overlaps and clips beyond cue boundaries without double counting", () => {
    expect(coverage(5, 10, [
      { start: 4, end: 6 }, { start: 5.5, end: 8 },
      { start: 8, end: 11 }, { start: 3, end: 4.5 },
    ])).toEqual({
      coveredSeconds: 5, coverageFraction: 1, gaps: [],
    });
  });
  it("returns accurate separate internal gaps across multiple clips", () => {
    expect(coverage(0, 5, [
      {start: 1, end: 2}, {start: 3, end: 4},
    ])).toEqual({
      coveredSeconds: 2, coverageFraction: 0.4,
      gaps: [
        {start: 0, end: 1},
        {start: 2, end: 3},
        {start: 4, end: 5},
      ],
    });
  });
  it("rejects invalid caption time windows", () => {
    expect(() => coverage(4, 4, [])).toThrow(/positive duration/);
    expect(() => coverage(4, 3, [])).toThrow(/positive duration/);
    expect(() => coverage(NaN, 5, [])).toThrow(/positive duration/);
  });
});
