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
import { workshopMotionLoopFrame, workshopMotionLoopElapsed } from "./workshop-motion-loop";
import { WORKSHOP_INSPECTION_FPS, workshopMotionInspectionFrame } from "./workshop-motion-frame-stepper";
import { workshopAdjacentFramePair } from "./workshop-adjacent-frame-compare";
import { workshopAdjacentJointReview } from "./workshop-adjacent-joint-review";
import { workshopJointReview } from "./workshop-joint-review-filter";
import { sceneFramesAt } from "./timeline";
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
  it("never cancels Play for a real animation-frame timestamp slightly before click time", () => {
    // requestAnimationFrame can supply the beginning of its frame, older
    // than performance.now() sampled by the Play event handler.
    expect(workshopMotionLoopElapsed(1000, 1016)).toBe(0);
    expect(workshopMotionLoopElapsed(1000, 1000)).toBe(0);
    expect(workshopMotionLoopElapsed(1016, 1000)).toBe(16);
    expect(workshopMotionLoopElapsed(1025.5, 1000)).toBe(25.5);
    expect(workshopMotionLoopElapsed(Number.NaN, 1000)).toBeUndefined();
    expect(workshopMotionLoopElapsed(1000, Infinity)).toBeUndefined();
    const { scene, actorId, steps } = fixture();
    const elapsed = workshopMotionLoopElapsed(1000, 1016)!;
    expect(workshopMotionLoopFrame(scene, actorId, steps[0], 0, elapsed, 1))
      .toMatchObject({ percent: 0, seconds: 3, savedKeyframe: true });
  });

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


describe("PR #168 genuine 24-fps read-only frame inspection", () => {
  it("inspects real Stage at every 1/24s step, including both saved endpoints", () => {
    const { project, scene, actorId, steps } = fixture();
    const snapshot = JSON.stringify(project);
    const sample = (index: number) =>
      workshopMotionInspectionFrame(scene, actorId, steps[0], index);
    expect(WORKSHOP_INSPECTION_FPS).toBe(24);
    expect(sample(0)).toMatchObject({
      index: 0, lastIndex: 36, seconds: 3, savedKeyframe: true,
    });
    expect(sample(1)).toMatchObject({
      index: 1, lastIndex: 36, seconds: 3.041667, savedKeyframe: false,
    });
    expect(sample(2)).toMatchObject({
      index: 2, lastIndex: 36, seconds: 3.083333,
    });
    expect(sample(18)).toMatchObject({ seconds: 3.75 });
    expect(sample(36)).toMatchObject({
      index: 36, lastIndex: 36, seconds: 4.5, savedKeyframe: true,
    });
    expect(sample(-10)).toMatchObject({ index: 0, seconds: 3 });
    expect(sample(900)).toMatchObject({ index: 36, seconds: 4.5 });
    const frame0 = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: sample(0)!.seconds, labelled: false,
    }));
    const frame1 = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: sample(1)!.seconds, labelled: false,
    }));
    expect(frame1).toContain('viewBox="0 0 800 450"');
    expect(frame1).toContain('data-puppet-part="rightArm"');
    expect(frame1).not.toBe(frame0);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("handles other real movement lengths, rejects invalid requests and never edits keys", () => {
    const { scene, actorId, steps } = fixture();
    expect(workshopMotionInspectionFrame(scene, actorId, steps[1], 0))
      .toMatchObject({ index: 0, lastIndex: 96, seconds: 4.5 });
    expect(workshopMotionInspectionFrame(scene, actorId, steps[1], 96))
      .toMatchObject({ index: 96, seconds: 8.5, savedKeyframe: true });
    expect(workshopMotionInspectionFrame(scene, actorId, steps[2], 1))
      .toMatchObject({ index: 1, lastIndex: 36, seconds: 8.541667 });
    expect(workshopMotionInspectionFrame(scene, actorId, steps[0], NaN))
      .toBeUndefined();
    expect(workshopMotionInspectionFrame(scene, actorId, steps[0], Infinity))
      .toBeUndefined();
    expect(workshopMotionInspectionFrame(scene, actorId, undefined, 0))
      .toBeUndefined();
    expect(workshopMotionInspectionFrame(scene, "unknown", steps[0], 0))
      .toBeUndefined();
    expect(workshopMotionInspectionFrame(scene, actorId, {
      ...steps[0], from: { ...steps[0].from, seconds: 3.125 },
    }, 0)).toBeUndefined();
  });
});


describe("PR #169 adjacent original Stage-frame comparisons", () => {
  it("compares authentic neighboring samples at the beginning, middle and end", () => {
    const { project, scene, actorId, steps } = fixture();
    const snapshot = JSON.stringify(project);
    const pair = (index: number) =>
      workshopAdjacentFramePair(scene, actorId, steps[0], index);
    expect(pair(0)).toMatchObject({
      before: { index: 0, seconds: 3, savedKeyframe: true },
      after: { index: 1, seconds: 3.041667, savedKeyframe: false },
      spacingSeconds: 0.041667,
    });
    expect(pair(1)).toMatchObject({
      before: { index: 0, seconds: 3 },
      after: { index: 1, seconds: 3.041667 },
    });
    expect(pair(2)).toMatchObject({
      before: { index: 1, seconds: 3.041667 },
      after: { index: 2, seconds: 3.083333 },
      spacingSeconds: 0.041666,
    });
    expect(pair(36)).toMatchObject({
      before: { index: 35, seconds: 4.458333 },
      after: { index: 36, seconds: 4.5, savedKeyframe: true },
      spacingSeconds: 0.041667,
    });
    expect(pair(900)?.after.seconds).toBe(4.5);
    const first = pair(2)!;
    const before = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: first.before.seconds, labelled: false,
    }));
    const after = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: first.after.seconds, labelled: false,
    }));
    expect(before).toContain('viewBox="0 0 800 450"');
    expect(after).toContain('data-puppet-part="rightArm"');
    expect(before).not.toBe(after);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("uses actual saved endpoints across different durations and rejects fabricated keys", () => {
    const { scene, actorId, steps } = fixture();
    expect(workshopAdjacentFramePair(scene, actorId, steps[1], 2)).toMatchObject({
      before: { index: 1, seconds: 4.541667 },
      after: { index: 2, seconds: 4.583333 },
    });
    expect(workshopAdjacentFramePair(scene, actorId, steps[1], 96)?.after)
      .toMatchObject({ index: 96, seconds: 8.5, savedKeyframe: true });
    expect(workshopAdjacentFramePair(scene, actorId, steps[2], 1)?.before)
      .toMatchObject({ index: 0, seconds: 8.5, savedKeyframe: true });
    expect(workshopAdjacentFramePair(scene, actorId, steps[0], NaN))
      .toBeUndefined();
    expect(workshopAdjacentFramePair(scene, actorId, steps[0], Infinity))
      .toBeUndefined();
    expect(workshopAdjacentFramePair(scene, "unknown", steps[0], 1))
      .toBeUndefined();
    expect(workshopAdjacentFramePair(scene, actorId, undefined, 1))
      .toBeUndefined();
    // A real key at 4.25s exists inside the authored sit-to-wave
    // animation. That key is valid source data, but it is NOT the
    // recorded step endpoint at 4.50s and must not replace it.
    const authoredKeys = scene.elements.find(element => element.id === actorId)!
      .animation!.keyframes;
    expect(authoredKeys.some(key => Math.abs(key.time - 4.25) < .001))
      .toBe(true);
    expect(workshopAdjacentFramePair(scene, actorId, {
      ...steps[0], to: { ...steps[0].to, seconds: 4.25 },
    }, 1)).toBeUndefined();
    // An entirely unsaved timestamp must also be rejected.
    expect(workshopAdjacentFramePair(scene, actorId, {
      ...steps[0], to: { ...steps[0].to, seconds: 4.333 },
    }, 1)).toBeUndefined();
  });
});


describe("PR #170 true adjacent Stage-sampled joint movement review", () => {
  it("measures real interpolated local joint differences from the same Stage frames", () => {
    const { project, scene, actorId, steps } = fixture();
    const original = JSON.stringify(project);
    const result = workshopAdjacentJointReview(project, scene, actorId, steps[0], 12);
    expect(result).toBeDefined();
    expect(result?.beforeSeconds).toBe(3.458333);
    expect(result?.afterSeconds).toBe(3.5);
    expect(result?.changes.length).toBeGreaterThan(0);
    const beforeJoints = sceneFramesAt(project, scene, result!.beforeSeconds)
      .get(actorId)?.joints;
    const afterJoints = sceneFramesAt(project, scene, result!.afterSeconds)
      .get(actorId)?.joints;
    expect(beforeJoints).toBeDefined();
    expect(afterJoints).toBeDefined();
    for (const change of result!.changes) {
      expect(change.beforeAngle).toBeCloseTo(beforeJoints?.[change.partId]?.angle ?? 0, 6);
      expect(change.afterAngle).toBeCloseTo(afterJoints?.[change.partId]?.angle ?? 0, 6);
      expect(change.angleDelta).toBeCloseTo(change.afterAngle - change.beforeAngle, 6);
      expect(Number.isFinite(change.xDelta)).toBe(true);
      expect(Number.isFinite(change.yDelta)).toBe(true);
    }
    for (let i = 1; i < result!.changes.length; i++) {
      expect(Math.abs(result!.changes[i - 1].angleDelta))
        .toBeGreaterThanOrEqual(Math.abs(result!.changes[i].angleDelta) - 1e-8);
    }
    const arms = workshopJointReview(result!.changes, "arms", "rotation");
    const legs = workshopJointReview(result!.changes, "legs", "rotation");
    const body = workshopJointReview(result!.changes, "body", "rotation");
    expect(arms.rows.every(item => /^(left|right)(Arm|Forearm|Hand)$/.test(item.role)))
      .toBe(true);
    expect(legs.rows.every(item => /^(left|right)(Leg|Shin|Foot)$/.test(item.role)))
      .toBe(true);
    expect(arms.rows.length + legs.rows.length + body.rows.length)
      .toBe(result!.changes.length);
    expect(JSON.stringify(project)).toBe(original);
  });

  it("uses saved step boundaries and rejects invalid or substituted endpoints", () => {
    const { project, scene, actorId, steps } = fixture();
    const first = workshopAdjacentJointReview(project, scene, actorId, steps[0], 0);
    const last = workshopAdjacentJointReview(project, scene, actorId, steps[0], 36);
    expect(first).toMatchObject({
      beforeSeconds: 3, afterSeconds: 3.041667,
    });
    expect(last).toMatchObject({
      beforeSeconds: 4.458333, afterSeconds: 4.5,
    });
    expect(workshopAdjacentJointReview(project, scene, actorId, steps[1], 96))
      .toMatchObject({ beforeSeconds: 8.458333, afterSeconds: 8.5 });
    expect(workshopAdjacentJointReview(project, scene, actorId, steps[0], NaN))
      .toBeUndefined();
    expect(workshopAdjacentJointReview(project, scene, "non-existent", steps[0], 0))
      .toBeUndefined();
    expect(workshopAdjacentJointReview(project, scene, actorId, undefined, 0))
      .toBeUndefined();
    // 4.25s is a real interior key, but not the selected step's endpoint.
    expect(workshopAdjacentJointReview(project, scene, actorId, {
      ...steps[0], to: { ...steps[0].to, seconds: 4.25 },
    }, 1)).toBeUndefined();
  });
});
