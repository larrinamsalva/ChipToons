import { describe, expect, it } from "vitest";
import { cinematicTurnEyelineAt } from "./cinematic-turn-eyeline";
import { starterProject } from "./demo-starter";
import { elementBase } from "./timeline";
import { uid } from "./model";

function turningFixture(fromX: number, farX: number, flip = false) {
  const project = starterProject();
  const element = project.scenes[0].elements[0];
  element.x = fromX; element.y = 365; element.flip = flip;
  element.motion = "still";
  element.animation = {
    blink: true, idle: "none",
    keyframes: [
      { ...elementBase(element), id: uid(), time: 0, x: fromX, easing: "linear" },
      { ...elementBase(element), id: uid(), time: 2, x: farX, easing: "linear" },
      { ...elementBase(element), id: uid(), time: 4, x: fromX, easing: "linear" },
    ],
  };
  return element;
}

describe("PR #137 eyes lead a real authored turnaround", () => {
  it("looks into the next direction without lingering during either straight walk", () => {
    const rightToLeft = turningFixture(170, 290);
    const turn = cinematicTurnEyelineAt(rightToLeft, 2, 5)!;
    expect(turn.x).toBe(-1);
    expect(turn.focus).toBeGreaterThan(.5);
    expect(turn.focus).toBeLessThanOrEqual(.7);
    expect(cinematicTurnEyelineAt(rightToLeft, 2, 5)).toEqual(turn);
    expect(cinematicTurnEyelineAt(rightToLeft, 1, 5)).toBeUndefined();
    expect(cinematicTurnEyelineAt(rightToLeft, 3, 5)).toBeUndefined();
  });
  it("follows left-to-right turns and respects flipped puppets", () => {
    expect(cinematicTurnEyelineAt(turningFixture(350, 230), 2, 5)?.x).toBe(1);
    expect(cinematicTurnEyelineAt(turningFixture(170, 290, true), 2, 5)?.x).toBe(1);
  });
  it("does not invent gaze for straight paths, stops, empty keys or invalid times", () => {
    const straight = turningFixture(170, 290);
    straight.animation!.keyframes[2].x = 410;
    expect(cinematicTurnEyelineAt(straight, 2, 5)).toBeUndefined();
    const stop = turningFixture(170, 290);
    stop.animation!.keyframes[2].x = 290;
    expect(cinematicTurnEyelineAt(stop, 2, 5)).toBeUndefined();
    const missing = turningFixture(170, 290);
    missing.animation = undefined;
    expect(cinematicTurnEyelineAt(missing, 2, 5)).toBeUndefined();
    for (const time of [-1, 0, 5, Number.NaN])
      expect(cinematicTurnEyelineAt(turningFixture(170, 290), time, 5)).toBeUndefined();
  });
});
