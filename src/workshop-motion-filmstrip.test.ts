import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { starterProject } from "./demo-starter";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { standAfterSeatedGreeting } from "./workshop-sit-wave-stand";
import { workshopMotionSteps } from "./workshop-motion-steps";
import { workshopMotionFilmstrip } from "./workshop-motion-filmstrip";
import { Stage } from "./components/Stage";

function fixture(kind: "chair" | "bench" = "chair", full = true) {
  const hero = newWorkshopPuppetStarter();
  const project = starterProject();
  project.characters = [...project.characters, hero];
  const scene = makeScene([hero]);
  scene.duration = full ? 10 : 8;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const { scene: furnished, seatId } = addWorkshopSeat(scene, scene.elements[0], kind);
  const seated = seatWorkshopAtFurniture(furnished, actorId, seatId, hero.puppet!);
  const waved = waveWorkshopWhileSeated(seated, actorId, seatId, hero.puppet!);
  const result = full
    ? standAfterSeatedGreeting(waved, actorId, seatId, hero.puppet!)
    : waved;
  project.scenes = [result];
  return { project, scene: result, actorId, rig: hero.puppet! };
}

describe("PR #165 genuine sampled middle-frame motion filmstrip", () => {
  it("samples three real Stage times for each exact, originally saved transition", () => {
    const { scene, actorId, rig, project } = fixture();
    const before = JSON.stringify(project);
    const steps = workshopMotionSteps(scene, actorId, rig);
    expect(steps.map(s => s.id)).toEqual([
      "seated-to-wave", "wave-to-rise", "rise-to-standing",
    ]);
    const times = steps.map(step =>
      workshopMotionFilmstrip(scene, actorId, step).map(frame => frame.seconds));
    expect(times).toEqual([[3, 3.75, 4.5], [4.5, 6.5, 8.5], [8.5, 9.25, 10]]);
    for (const [index, step] of steps.entries()) {
      const frames = workshopMotionFilmstrip(scene, actorId, step);
      expect(frames.map(frame => frame.label)).toEqual(["Start", "Middle", "End"]);
      expect(frames[0].savedKeyframe).toBe(true);
      expect(frames[2].savedKeyframe).toBe(true);
      for (const frame of frames) {
        const rendered = renderToStaticMarkup(createElement(Stage, {
          project, scene, time: frame.seconds, labelled: false,
        }));
        expect(rendered).toContain('viewBox="0 0 800 450"');
        expect(rendered).toContain('data-puppet-part="rightArm"');
        expect(rendered).toContain('data-puppet-part="leftShin"');
      }
      if (index === 0) {
        const start = renderToStaticMarkup(createElement(Stage, {
          project, scene, time: frames[0].seconds, labelled: false,
        }));
        const midpoint = renderToStaticMarkup(createElement(Stage, {
          project, scene, time: frames[1].seconds, labelled: false,
        }));
        const end = renderToStaticMarkup(createElement(Stage, {
          project, scene, time: frames[2].seconds, labelled: false,
        }));
        expect(midpoint).not.toBe(start);
        expect(midpoint).not.toBe(end);
      }
    }
    expect(JSON.stringify(project)).toBe(before);
  });

  it("works with real bench greeting and settled pose, without inventing standing", () => {
    const { scene, actorId, rig } = fixture("bench", false);
    const steps = workshopMotionSteps(scene, actorId, rig);
    expect(steps.map(s => s.id)).toEqual(["seated-to-wave", "wave-to-settled"]);
    expect(workshopMotionFilmstrip(scene, actorId, steps[1]).map(frame => frame.seconds))
      .toEqual([4.5, 5.25, 6]);
  });

  it("refuses unselected, missing and fabricated step endpoints", () => {
    const { scene, actorId, rig } = fixture();
    const step = workshopMotionSteps(scene, actorId, rig)[0];
    expect(workshopMotionFilmstrip(scene, actorId, undefined)).toEqual([]);
    expect(workshopMotionFilmstrip(scene, "not-here", step)).toEqual([]);
    expect(workshopMotionFilmstrip(scene, actorId, {
      ...step, from: { ...step.from, seconds: 3.125 },
    })).toEqual([]);
    expect(workshopMotionFilmstrip(scene, actorId, {
      ...step, to: { ...step.to, seconds: Number.NaN },
    })).toEqual([]);
    expect(workshopMotionFilmstrip(scene, actorId, {
      ...step, to: { ...step.to, seconds: 2 },
    })).toEqual([]);
  });
});
