import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { starterProject } from "./demo-starter";
import { makeScene } from "./model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { standAfterSeatedGreeting } from "./workshop-sit-wave-stand";
import { workshopMotionSteps } from "./workshop-motion-steps";
import { workshopMotionScrubSample } from "./workshop-motion-scrub";
import { workshopMotionLoopFrame } from "./workshop-motion-loop";
import { Stage } from "./components/Stage";

function fixture() {
  const hero = newWorkshopPuppetStarter();
  const project = starterProject();
  project.characters = [...project.characters, hero];
  const scene = makeScene([hero]);
  scene.duration = 10;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const { scene: furnished, seatId } = addWorkshopSeat(scene, scene.elements[0], "bench");
  const seated = seatWorkshopAtFurniture(furnished, actorId, seatId, hero.puppet!);
  const waving = waveWorkshopWhileSeated(seated, actorId, seatId, hero.puppet!);
  const complete = standAfterSeatedGreeting(waving, actorId, seatId, hero.puppet!);
  project.scenes = [complete];
  return {
    project, scene: complete, actorId,
    steps: workshopMotionSteps(complete, actorId, hero.puppet!),
  };
}

describe("PR #166 read-only true Stage motion scrubber", () => {
  it("samples exact endpoints and several actual in-between times for each saved step", () => {
    const { project, scene, actorId, steps } = fixture();
    const original = JSON.stringify(project);
    expect(steps.map(item => item.id)).toEqual([
      "seated-to-wave", "wave-to-rise", "rise-to-standing",
    ]);
    expect([0, 25, 50, 75, 100].map(percent =>
      workshopMotionScrubSample(scene, actorId, steps[0], percent)?.seconds))
      .toEqual([3, 3.375, 3.75, 4.125, 4.5]);
    expect([0, 25, 50, 75, 100].map(percent =>
      workshopMotionScrubSample(scene, actorId, steps[1], percent)?.seconds))
      .toEqual([4.5, 5.5, 6.5, 7.5, 8.5]);
    expect([0, 25, 50, 75, 100].map(percent =>
      workshopMotionScrubSample(scene, actorId, steps[2], percent)?.seconds))
      .toEqual([8.5, 8.875, 9.25, 9.625, 10]);
    const before = workshopMotionScrubSample(scene, actorId, steps[0], 0)!;
    const sampled = workshopMotionScrubSample(scene, actorId, steps[0], 25)!;
    const after = workshopMotionScrubSample(scene, actorId, steps[0], 100)!;
    expect(before.savedKeyframe).toBe(true);
    expect(after.savedKeyframe).toBe(true);
    expect(sampled.savedKeyframe).toBe(false);
    const startSvg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: before.seconds, labelled: false,
    }));
    const scrubbedSvg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: sampled.seconds, labelled: false,
    }));
    const endSvg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: after.seconds, labelled: false,
    }));
    expect(scrubbedSvg).toContain('viewBox="0 0 800 450"');
    expect(scrubbedSvg).toContain('data-puppet-part="rightArm"');
    expect(scrubbedSvg).toContain('data-puppet-part="leftShin"');
    expect(scrubbedSvg).not.toBe(startSvg);
    expect(scrubbedSvg).not.toBe(endSvg);
    expect(JSON.stringify(project)).toBe(original);
  });

  it("clamps scrub percentages and rejects invalid values and fabricated step endpoints", () => {
    const { scene, actorId, steps } = fixture();
    const step = steps[0];
    expect(workshopMotionScrubSample(scene, actorId, step, -900))
      .toMatchObject({ percent: 0, seconds: 3, savedKeyframe: true });
    expect(workshopMotionScrubSample(scene, actorId, step, 900))
      .toMatchObject({ percent: 100, seconds: 4.5, savedKeyframe: true });
    expect(workshopMotionScrubSample(scene, actorId, step, 24.8))
      .toMatchObject({ percent: 25, seconds: 3.375 });
    expect(workshopMotionScrubSample(scene, actorId, step, Number.NaN))
      .toBeUndefined();
    expect(workshopMotionScrubSample(scene, actorId, step, Infinity))
      .toBeUndefined();
    expect(workshopMotionScrubSample(scene, actorId, undefined, 50))
      .toBeUndefined();
    expect(workshopMotionScrubSample(scene, "missing", step, 50))
      .toBeUndefined();
    expect(workshopMotionScrubSample(scene, actorId, {
      ...step, from: { ...step.from, seconds: 3.125 },
    }, 50)).toBeUndefined();
    expect(workshopMotionScrubSample(scene, actorId, {
      ...step, to: { ...step.to, seconds: 0 },
    }, 50)).toBeUndefined();
  });

  it("marks a genuine saved interior key distinctly from an interpolated frame", () => {
    const { scene, actorId, steps } = fixture();
    const step = steps[0];
    const actor = scene.elements.find(element => element.id === actorId)!;
    const frame = actor.animation!.keyframes.find(key => Math.abs(key.time - 3.75) < .001)!;
    const withInterior = {
      ...scene,
      elements: scene.elements.map(element => element.id === actorId
        ? { ...element, animation: { ...element.animation!,
          keyframes: [...element.animation!.keyframes,
            { ...frame, id: "authored-sample-key", time: 3.375 }] } }
        : element),
    };
    expect(workshopMotionScrubSample(withInterior, actorId, step, 25))
      .toMatchObject({ seconds: 3.375, savedKeyframe: true });
    expect(workshopMotionScrubSample(scene, actorId, step, 25)?.savedKeyframe)
      .toBe(false);
  });
});


describe("PR #167 true read-only Stage motion loop", () => {
  it("uses original saved endpoints and samples real time at half normal and double speed", () => {
    const { project, scene, actorId, steps } = fixture();
    const original = JSON.stringify(project);
    const step = steps[0]; // 3.00s to 4.50s = 1500ms
    const sample = (start: number, elapsed: number, speed: 0.5 | 1 | 2) =>
      workshopMotionLoopFrame(scene, actorId, step, start, elapsed, speed);
    expect(sample(0, 0, 1)).toMatchObject({
      percent: 0, seconds: 3, savedKeyframe: true,
    });
    expect(sample(0, 375, 1)).toMatchObject({
      percent: 25, seconds: 3.375, savedKeyframe: false,
    });
    expect(sample(0, 375, 2)).toMatchObject({
      percent: 50, seconds: 3.75,
    });
    expect(sample(0, 750, 0.5)).toMatchObject({
      percent: 25, seconds: 3.375,
    });
    expect(sample(25, 375, 1)).toMatchObject({
      percent: 50, seconds: 3.75,
    });
    expect(sample(0, 1500, 1)).toMatchObject({
      percent: 0, seconds: 3, savedKeyframe: true,
    });
    expect(sample(0, 3000, 0.5)).toMatchObject({
      percent: 0, seconds: 3, savedKeyframe: true,
    });
    const at25 = sample(0, 375, 1)!;
    const svg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: at25.seconds, labelled: false,
    }));
    const initial = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 3, labelled: false,
    }));
    expect(svg).toContain('data-puppet-part="rightArm"');
    expect(svg).toContain('data-puppet-part="leftShin"');
    expect(svg).not.toBe(initial);
    expect(JSON.stringify(project)).toBe(original);
  });

  it("supports the real longer waving-to-rising step and rejects invalid data", () => {
    const { scene, actorId, steps } = fixture();
    expect(workshopMotionLoopFrame(scene, actorId, steps[1], 0, 1000, 1))
      .toMatchObject({ percent: 25, seconds: 5.5 });
    expect(workshopMotionLoopFrame(scene, actorId, steps[1], 0, 1000, 2))
      .toMatchObject({ percent: 50, seconds: 6.5 });
    expect(workshopMotionLoopFrame(scene, actorId, steps[2], 0, 375, 1))
      .toMatchObject({ percent: 25, seconds: 8.875 });
    expect(workshopMotionLoopFrame(scene, actorId, steps[0], 0, -1, 1))
      .toBeUndefined();
    expect(workshopMotionLoopFrame(scene, actorId, steps[0], 0, Infinity, 1))
      .toBeUndefined();
    expect(workshopMotionLoopFrame(scene, actorId, steps[0], NaN, 0, 1))
      .toBeUndefined();
    expect(workshopMotionLoopFrame(scene, "not-an-actor", steps[0], 0, 0, 1))
      .toBeUndefined();
    expect(workshopMotionLoopFrame(scene, actorId, undefined, 0, 0, 1))
      .toBeUndefined();
    expect(workshopMotionLoopFrame(scene, actorId, {
      ...steps[0], to: { ...steps[0].to, seconds: 4.333 },
    }, 0, 0, 1)).toBeUndefined();
  });
});
