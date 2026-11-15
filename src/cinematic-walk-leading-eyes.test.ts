import { describe, expect, it } from "vitest";
import { cinematicWalkLeadingEyesAt } from "./cinematic-walk-leading-eyes";
import { starterProject } from "./demo-starter";
import { elementBase } from "./timeline";
import { uid } from "./model";

function fixture(endX: number, flip = false) {
  const p = starterProject();
  const e = p.scenes[0].elements[0];
  e.x = 170; e.y = 365; e.flip = flip;
  e.motion = "still";
  e.animation = {
    blink: true, idle: "none",
    keyframes: [
      { ...elementBase(e), id: uid(), time: 0, x: 170, easing: "linear" },
      { ...elementBase(e), id: uid(), time: 1, x: 170, easing: "linear" },
      { ...elementBase(e), id: uid(), time: 3, x: endX, easing: "linear" },
      { ...elementBase(e), id: uid(), time: 4, x: endX, easing: "linear" },
    ],
  };
  return e;
}

describe("PR #134 small pre-step eye lead", () => {
  it("glances in the intended authored direction and disappears during the walk", () => {
    const right = fixture(290);
    const glancing = cinematicWalkLeadingEyesAt(right, .85, 5)!;
    expect(glancing.x).toBe(1);
    expect(glancing.focus).toBeGreaterThan(.5);
    expect(glancing.focus).toBeLessThanOrEqual(1);
    expect(cinematicWalkLeadingEyesAt(right, .85, 5)).toEqual(glancing);
    expect(cinematicWalkLeadingEyesAt(right, 1.5, 5)).toBeUndefined();
    expect(cinematicWalkLeadingEyesAt(right, 4.2, 5)).toBeUndefined();
    expect(cinematicWalkLeadingEyesAt(fixture(50), .85, 5)?.x).toBe(-1);
    expect(cinematicWalkLeadingEyesAt(fixture(290, true), .85, 5)?.x).toBe(-1);
  });

  it("never invents a look for a static, unkeyed or invalid-time character", () => {
    expect(cinematicWalkLeadingEyesAt(fixture(170), .85, 5)).toBeUndefined();
    const noKeys = fixture(290);
    noKeys.animation = undefined;
    expect(cinematicWalkLeadingEyesAt(noKeys, .85, 5)).toBeUndefined();
    expect(cinematicWalkLeadingEyesAt(fixture(290), Number.NaN, 5)).toBeUndefined();
  });
});
