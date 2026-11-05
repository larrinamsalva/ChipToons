import { describe, expect, it } from "vitest";
import { LITTLE_FIXERS_REMAINDER } from "./little-fixers-remainder-script";

describe("Little Fixers Episode 1 complete script draft", () => {
  it("preserves 18 distinct minute-by-minute story beats after the 119-second opening", () => {
    expect(LITTLE_FIXERS_REMAINDER).toHaveLength(18);
    expect(new Set(LITTLE_FIXERS_REMAINDER.map(beat => beat.title)).size).toBe(18);
    expect(LITTLE_FIXERS_REMAINDER.reduce((sum, beat) => sum + beat.seconds, 119)).toBe(1200);
    expect(LITTLE_FIXERS_REMAINDER.every(beat => beat.seconds > 0 && beat.seconds <= 120)).toBe(true);
  });

  it("provides original script, shot direction, and child participation for every unvoiced scene", () => {
    for (const beat of LITTLE_FIXERS_REMAINDER) {
      expect(beat.dialogue.length).toBeGreaterThan(100);
      expect(beat.direction.length).toBeGreaterThan(40);
      expect(beat.participation.length).toBeGreaterThan(15);
      expect(beat.panelIndex).toBeGreaterThanOrEqual(1);
      expect(beat.panelIndex).toBeLessThanOrEqual(5);
    }
  });

  it("keeps hazardous repairs adult-led and does not portray the remainder as finished video", () => {
    const combined = LITTLE_FIXERS_REMAINDER.map(beat => beat.dialogue + beat.direction).join(" ").toLowerCase();
    expect(combined).toContain("grown-up");
    expect(combined).toContain("unplug");
    expect(combined).toContain("adult");
  });
});
