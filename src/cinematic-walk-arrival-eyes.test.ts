import { describe, expect, it } from "vitest";
import { cinematicWalkArrivalEyesAt } from "./cinematic-walk-arrival-eyes";
import { starterProject } from "./demo-starter";
import { elementBase } from "./timeline";
import { uid } from "./model";

function fixture(endX: number, flip = false) {
  const project = starterProject();
  const element = project.scenes[0].elements[0];
  element.motion = "still";
  element.x = 170;
  element.y = 365;
  element.flip = flip;
  element.animation = {
    blink: true, idle: "none",
    keyframes: [
      { ...elementBase(element), id: uid(), time: 0, easing: "linear", x: 170 },
      { ...elementBase(element), id: uid(), time: 1, easing: "linear", x: 170 },
      { ...elementBase(element), id: uid(), time: 3, easing: "linear", x: endX },
      { ...elementBase(element), id: uid(), time: 4, easing: "linear", x: endX },
    ],
  };
  return element;
}

describe("PR #135 natural post-walk pupil arrival", () => {
  it("briefly looks in the completed step direction and settles naturally", () => {
    const right = fixture(290);
    const arrival = cinematicWalkArrivalEyesAt(right, 3.2, 5)!;
    expect(arrival.x).toBe(1);
    expect(arrival.focus).toBeGreaterThan(.25);
    expect(arrival.focus).toBeLessThanOrEqual(.65);
    expect(cinematicWalkArrivalEyesAt(right, 3.2, 5)).toEqual(arrival);
    expect(cinematicWalkArrivalEyesAt(right, 2.0, 5)).toBeUndefined();
    expect(cinematicWalkArrivalEyesAt(right, 4.2, 5)).toBeUndefined();
  });
  it("mirrors a leftward arrival and a deliberately flipped puppet", () => {
    expect(cinematicWalkArrivalEyesAt(fixture(50), 3.2, 5)?.x).toBe(-1);
    expect(cinematicWalkArrivalEyesAt(fixture(290, true), 3.2, 5)?.x).toBe(-1);
  });
  it("does not add pupils to a static or unkeyed actor, or invalid time", () => {
    expect(cinematicWalkArrivalEyesAt(fixture(170), 3.2, 5)).toBeUndefined();
    const noKeys = fixture(290);
    noKeys.animation = undefined;
    expect(cinematicWalkArrivalEyesAt(noKeys, 3.2, 5)).toBeUndefined();
    expect(cinematicWalkArrivalEyesAt(fixture(290), Number.NaN, 5)).toBeUndefined();
    expect(cinematicWalkArrivalEyesAt(fixture(290), 5, 5)).toBeUndefined();
  });
});
