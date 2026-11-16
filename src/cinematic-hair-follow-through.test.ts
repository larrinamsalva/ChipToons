import { describe, expect, it } from "vitest";
import { cinematicHairFollowThroughAt } from "./cinematic-hair-follow-through";

function path(t: number) {
  return { x: 200 + 60 * t, joints: { head: { angle: 8 * t, x: 0, y: 0 } } };
}
describe("PR #145 gentle inertial follow-through for existing hair artwork", () => {
  it("moves hair against authored travel and head rotation, never the face frame", () => {
    const sample = (t: number) => path(t);
    const before = JSON.stringify(sample(1));
    const result = cinematicHairFollowThroughAt(1, 4, sample);
    expect(result.angle).toBeLessThan(-.5);
    expect(Math.abs(result.angle)).toBeLessThanOrEqual(3.25);
    expect(result.lift).toBeGreaterThan(0);
    expect(result.lift).toBeLessThanOrEqual(1);
    expect(cinematicHairFollowThroughAt(1, 4, sample)).toEqual(result);
    expect(JSON.stringify(sample(1))).toBe(before);
    const reverse = cinematicHairFollowThroughAt(1, 4, t => ({
      ...path(t), x: 500 - 60 * t, joints: { head: { x: 0, y: 0, angle: -8 * t } },
    }));
    expect(reverse.angle).toBeGreaterThan(.5);
  });
  it("stays quiet on still shots, calm authoring and invalid samples", () => {
    const staticSample = () => ({ x: 170, joints: { head: { angle: 0, x: 0, y: 0 } } });
    expect(cinematicHairFollowThroughAt(2, 4, staticSample)).toEqual({ angle: 0, lift: 0 });
    expect(cinematicHairFollowThroughAt(2, 4, path, true)).toEqual({ angle: 0, lift: 0 });
    for (const t of [-1, 5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(cinematicHairFollowThroughAt(t, 4, path)).toEqual({ angle: 0, lift: 0 });
    expect(cinematicHairFollowThroughAt(1, 0, path)).toEqual({ angle: 0, lift: 0 });
    expect(cinematicHairFollowThroughAt(1, 4, () => ({ x: Number.NaN, joints: {} })))
      .toEqual({ angle: 0, lift: 0 });
  });
  it("responds to a real authored head turn even while the body is stopped", () => {
    const t = 2;
    const turn = cinematicHairFollowThroughAt(t, 4, at => ({
      x: 210, joints: { head: { angle: at * 15, x: 0, y: 0 } },
    }));
    expect(turn.angle).toBeLessThan(-.1);
    expect(turn.lift).toBeGreaterThan(0);
  });
});
