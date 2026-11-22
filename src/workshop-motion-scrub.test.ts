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
import { workshopJointMotionCurve } from "./workshop-joint-motion-curve";
import { workshopJointRotationRates } from "./workshop-joint-rotation-rate";
import { workshopLargestRotationRateChanges } from "./workshop-rate-change-finder";
import { workshopMotionTransitionTriplet } from "./workshop-motion-transition-triplet";
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


describe("PR #171 real Stage-sampled local joint rotation curve", () => {
  it("samples the original joint at every authentic 24-fps Stage instant", () => {
    const { project, scene, actorId, steps } = fixture();
    const snapshot = JSON.stringify(project);
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const part = rig?.parts.find(item => item.role === "rightArm");
    expect(part).toBeDefined();
    const curve = workshopJointMotionCurve(project, scene, actorId, steps[0], part!.id);
    expect(curve).toBeDefined();
    expect(curve!.partId).toBe(part!.id);
    expect(curve!.points).toHaveLength(37);
    expect(curve!.points[0]).toMatchObject({
      index: 0, seconds: 3, savedKeyframe: true,
    });
    expect(curve!.points[1]).toMatchObject({
      index: 1, seconds: 3.041667, savedKeyframe: false,
    });
    expect(curve!.points[36]).toMatchObject({
      index: 36, seconds: 4.5, savedKeyframe: true,
    });
    for (const index of [0, 1, 2, 12, 18, 35, 36]) {
      const point = curve!.points[index];
      expect(point.angle).toBeCloseTo(
        sceneFramesAt(project, scene, point.seconds).get(actorId)?.joints?.[part!.id]?.angle ?? 0,
        6,
      );
    }
    expect(curve!.minAngle).toBe(Math.min(...curve!.points.map(point => point.angle)));
    expect(curve!.maxAngle).toBe(Math.max(...curve!.points.map(point => point.angle)));
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("works across recorded movements and safely rejects invalid inputs", () => {
    const { project, scene, actorId, steps } = fixture();
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const part = rig!.parts.find(item => item.role === "rightArm")!;
    expect(workshopJointMotionCurve(project, scene, actorId, steps[1], part.id)?.points)
      .toHaveLength(97);
    expect(workshopJointMotionCurve(project, scene, actorId, steps[2], part.id)?.points)
      .toHaveLength(37);
    expect(workshopJointMotionCurve(project, scene, actorId, steps[0], "not-a-joint"))
      .toBeUndefined();
    expect(workshopJointMotionCurve(project, scene, "unknown", steps[0], part.id))
      .toBeUndefined();
    expect(workshopJointMotionCurve(project, scene, actorId, undefined, part.id))
      .toBeUndefined();
    // A real 4.25s interior key must not become a fake 4.50s endpoint.
    expect(workshopJointMotionCurve(project, scene, actorId, {
      ...steps[0], to: { ...steps[0].to, seconds: 4.25 },
    }, part.id)).toBeUndefined();
  });
});

describe("PR #172 signed local rotation speed between authentic Stage samples", () => {
  it("calculates the real degrees/second for each original neighboring interval", () => {
    const { project, scene, actorId, steps } = fixture();
    const snapshot = JSON.stringify(project);
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const arm = rig!.parts.find(part => part.role === "rightArm")!;
    const curve = workshopJointMotionCurve(project, scene, actorId, steps[0], arm.id)!;
    const result = workshopJointRotationRates(curve)!;
    expect(result).toBeDefined();
    expect(result.partId).toBe(arm.id);
    expect(result.intervals).toHaveLength(36);
    for (const index of [1, 2, 18, 35, 36]) {
      const interval = result.intervals[index - 1];
      const before = curve.points[index - 1];
      const after = curve.points[index];
      expect(interval.afterIndex).toBe(index);
      expect(interval.beforeSeconds).toBe(before.seconds);
      expect(interval.afterSeconds).toBe(after.seconds);
      expect(interval.angleDelta).toBeCloseTo(after.angle - before.angle, 8);
      expect(interval.degreesPerSecond)
        .toBeCloseTo((after.angle - before.angle) / (after.seconds - before.seconds), 8);
      // The exact inspected frame pair must select this same interval.
      const pair = workshopAdjacentFramePair(scene, actorId, steps[0], index)!;
      expect(interval.afterSeconds).toBe(pair.after.seconds);
      expect(interval.beforeSeconds).toBe(pair.before.seconds);
    }
    expect(result.minRate).toBe(Math.min(...result.intervals.map(item => item.degreesPerSecond)));
    expect(result.maxRate).toBe(Math.max(...result.intervals.map(item => item.degreesPerSecond)));
    expect(result.maxAbsoluteRate)
      .toBe(Math.max(Math.abs(result.minRate), Math.abs(result.maxRate)));
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("handles all three real saved steps and rejects malformed frame spacing", () => {
    const { project, scene, actorId, steps } = fixture();
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const arm = rig!.parts.find(part => part.role === "rightArm")!;
    const curve = workshopJointMotionCurve(project, scene, actorId, steps[1], arm.id)!;
    expect(workshopJointRotationRates(curve)?.intervals).toHaveLength(96);
    expect(workshopJointRotationRates(
      workshopJointMotionCurve(project, scene, actorId, steps[2], arm.id),
    )?.intervals).toHaveLength(36);
    expect(workshopJointRotationRates(undefined)).toBeUndefined();
    expect(workshopJointRotationRates({ ...curve, points: [curve.points[0]] }))
      .toBeUndefined();
    const duplicate = { ...curve, points: curve.points.map(point => ({ ...point })) };
    duplicate.points[1].seconds = duplicate.points[0].seconds;
    expect(workshopJointRotationRates(duplicate)).toBeUndefined();
    duplicate.points[1].seconds = curve.points[1].seconds;
    duplicate.points[1].angle = Infinity;
    expect(workshopJointRotationRates(duplicate)).toBeUndefined();
  });
});

describe("PR #173 find authentic Stage joint rotation-rate transitions", () => {
  it("ranks signed angular acceleration from true adjacent 24-fps Stage intervals", () => {
    const { project, scene, actorId, steps } = fixture();
    const beforeProject = JSON.stringify(project);
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const arm = rig!.parts.find(part => part.role === "rightArm")!;
    const curve = workshopJointMotionCurve(project, scene, actorId, steps[0], arm.id)!;
    const rates = workshopJointRotationRates(curve)!;
    const results = workshopLargestRotationRateChanges(rates)!;
    expect(results.label).toBe(rates.label);
    expect(results.totalChanges).toBe(35);
    expect(results.largest).toHaveLength(5);
    for (const item of results.largest) {
      const before = rates.intervals[item.sharedFrameIndex - 1];
      const after = rates.intervals[item.sharedFrameIndex];
      expect(after).toBeDefined();
      expect(item.afterFrameIndex).toBe(item.sharedFrameIndex + 1);
      expect(item.seconds).toBe(curve.points[item.sharedFrameIndex].seconds);
      expect(item.rateBefore).toBe(before.degreesPerSecond);
      expect(item.rateAfter).toBe(after.degreesPerSecond);
      expect(item.rateDelta).toBeCloseTo(after.degreesPerSecond - before.degreesPerSecond, 8);
      const midpointSpacing = ((after.beforeSeconds + after.afterSeconds) -
        (before.beforeSeconds + before.afterSeconds)) / 2;
      expect(item.midpointSpacingSeconds).toBeCloseTo(midpointSpacing, 8);
      expect(item.degreesPerSecondSquared).toBeCloseTo(
        item.rateDelta / midpointSpacing, 8);
      const pair = workshopAdjacentFramePair(scene, actorId, steps[0], item.afterFrameIndex)!;
      expect(pair.before.index).toBe(item.sharedFrameIndex);
      expect(pair.after.index).toBe(item.afterFrameIndex);
    }
    for (let i = 1; i < results.largest.length; i++) {
      expect(Math.abs(results.largest[i - 1].degreesPerSecondSquared))
        .toBeGreaterThanOrEqual(Math.abs(results.largest[i].degreesPerSecondSquared));
    }
    expect(JSON.stringify(project)).toBe(beforeProject);
  });

  it("handles other original steps and supports a smaller results limit", () => {
    const { project, scene, actorId, steps } = fixture();
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const arm = rig!.parts.find(part => part.role === "rightArm")!;
    const wavedRates = workshopJointRotationRates(
      workshopJointMotionCurve(project, scene, actorId, steps[1], arm.id),
    )!;
    expect(workshopLargestRotationRateChanges(wavedRates)?.totalChanges).toBe(95);
    expect(workshopLargestRotationRateChanges(wavedRates, 3)?.largest).toHaveLength(3);
    expect(workshopLargestRotationRateChanges(undefined)).toBeUndefined();
    expect(workshopLargestRotationRateChanges(wavedRates, 0)).toBeUndefined();
    expect(workshopLargestRotationRateChanges(wavedRates, 11)).toBeUndefined();
  });

  it("uses exact unequal interval midpoints and rejects discontinuities", () => {
    const rates = {
      partId: "arm", label: "Arm", minRate: 0, maxRate: 10, maxAbsoluteRate: 10,
      intervals: [
        { afterIndex: 1, beforeSeconds: 0, afterSeconds: 0.1,
          angleDelta: 0.2, degreesPerSecond: 2 },
        { afterIndex: 2, beforeSeconds: 0.1, afterSeconds: 0.15,
          angleDelta: 0.5, degreesPerSecond: 10 },
        { afterIndex: 3, beforeSeconds: 0.15, afterSeconds: 0.3,
          angleDelta: 0.3, degreesPerSecond: 2 },
      ],
    };
    const result = workshopLargestRotationRateChanges(rates)!;
    expect(result.totalChanges).toBe(2);
    expect(result.largest[0].sharedFrameIndex).toBe(1);
    expect(result.largest[0].midpointSpacingSeconds).toBeCloseTo(0.075, 8);
    expect(result.largest[0].degreesPerSecondSquared).toBeCloseTo(8 / 0.075, 8);
    expect(result.largest[1].midpointSpacingSeconds).toBeCloseTo(0.1, 8);
    expect(result.largest[1].degreesPerSecondSquared).toBeCloseTo(-8 / 0.1, 8);
    const gap = { ...rates, intervals: rates.intervals.map(item => ({ ...item })) };
    gap.intervals[1].beforeSeconds = 0.2;
    expect(workshopLargestRotationRateChanges(gap)).toBeUndefined();
    const malformed = { ...rates, intervals: rates.intervals.map(item => ({ ...item })) };
    malformed.intervals[1].afterIndex = 9;
    expect(workshopLargestRotationRateChanges(malformed)).toBeUndefined();
    malformed.intervals[1].afterIndex = 2;
    malformed.intervals[1].degreesPerSecond = Infinity;
    expect(workshopLargestRotationRateChanges(malformed)).toBeUndefined();
  });
});

describe("PR #174 authentic three-frame Stage transition previews", () => {
  it("renders the exact original neighboring timestamps around measured rate changes", () => {
    const { project, scene, actorId, steps } = fixture();
    const immutableSnapshot = JSON.stringify(project);
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const arm = rig!.parts.find(part => part.role === "rightArm")!;
    const curve = workshopJointMotionCurve(project, scene, actorId, steps[0], arm.id)!;
    const rates = workshopJointRotationRates(curve)!;
    const changes = workshopLargestRotationRateChanges(rates)!.largest;
    for (const change of changes) {
      const frames = workshopMotionTransitionTriplet(scene, actorId, steps[0], change)!;
      expect(frames).toBeDefined();
      expect(frames.before.index).toBe(change.sharedFrameIndex - 1);
      expect(frames.middle.index).toBe(change.sharedFrameIndex);
      expect(frames.after.index).toBe(change.afterFrameIndex);
      expect(frames.middle.seconds).toBe(change.seconds);
      for (const frame of [frames.before, frames.middle, frames.after]) {
        expect(frame).toEqual(
          workshopMotionInspectionFrame(scene, actorId, steps[0], frame.index),
        );
        const svg = renderToStaticMarkup(createElement(Stage, {
          project, scene, time: frame.seconds, labelled: false,
        }));
        expect(svg).toContain('viewBox="0 0 800 450"');
        expect(svg).toContain('data-puppet-part="rightArm"');
      }
      expect(frames.before.seconds).toBeLessThan(frames.middle.seconds);
      expect(frames.middle.seconds).toBeLessThan(frames.after.seconds);
    }
    expect(JSON.stringify(project)).toBe(immutableSnapshot);
  });

  it("keeps exact real motion endpoints, including unequal last-frame spacing", () => {
    const { project, scene, actorId, steps } = fixture();
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const arm = rig!.parts.find(part => part.role === "rightArm")!;
    const curve = workshopJointMotionCurve(project, scene, actorId, steps[1], arm.id)!;
    const lastRate = workshopJointRotationRates(curve)!.intervals.at(-1)!;
    const change = {
      ...workshopLargestRotationRateChanges(workshopJointRotationRates(curve))!.largest[0],
      sharedFrameIndex: 95,
      afterFrameIndex: 96,
      seconds: curve.points[95].seconds,
    };
    const actual = workshopMotionTransitionTriplet(scene, actorId, steps[1], change)!;
    expect(actual.before.index).toBe(94);
    expect(actual.middle.index).toBe(95);
    expect(actual.after.index).toBe(96);
    expect(actual.after.savedKeyframe).toBe(true);
    expect(actual.after.seconds).toBe(8.5);
    expect(lastRate.afterSeconds).toBe(actual.after.seconds);
  });

  it("rejects invalid transition frames, fake times and fabricated saved endpoints", () => {
    const { project, scene, actorId, steps } = fixture();
    const rig = project.characters.find(character =>
      character.id === scene.elements.find(element => element.id === actorId)?.characterId)?.puppet;
    const arm = rig!.parts.find(part => part.role === "rightArm")!;
    const change = workshopLargestRotationRateChanges(workshopJointRotationRates(
      workshopJointMotionCurve(project, scene, actorId, steps[0], arm.id)))!.largest[0];
    expect(workshopMotionTransitionTriplet(scene, actorId, steps[0], undefined))
      .toBeUndefined();
    expect(workshopMotionTransitionTriplet(scene, actorId, steps[0], {
      ...change, sharedFrameIndex: -1, afterFrameIndex: 0,
    })).toBeUndefined();
    expect(workshopMotionTransitionTriplet(scene, actorId, steps[0], {
      ...change, afterFrameIndex: change.sharedFrameIndex + 2,
    })).toBeUndefined();
    expect(workshopMotionTransitionTriplet(scene, actorId, steps[0], {
      ...change, seconds: change.seconds + 0.025,
    })).toBeUndefined();
    expect(workshopMotionTransitionTriplet(scene, actorId, steps[0], {
      ...change, sharedFrameIndex: 36, afterFrameIndex: 37, seconds: 4.5,
    })).toBeUndefined();
    // 4.25 seconds genuinely exists inside the saved wave animation,
    // but is NOT the selected recorded movement's original endpoint.
    const keys = scene.elements.find(element => element.id === actorId)!
      .animation!.keyframes;
    expect(keys.some(key => Math.abs(key.time - 4.25) < .001)).toBe(true);
    expect(workshopMotionTransitionTriplet(scene, actorId, {
      ...steps[0], to: { ...steps[0].to, seconds: 4.25 },
    }, change)).toBeUndefined();
    // Also reject an entirely unsaved substituted endpoint.
    expect(workshopMotionTransitionTriplet(scene, actorId, {
      ...steps[0], to: { ...steps[0].to, seconds: 4.333 },
    }, change)).toBeUndefined();
  });
});
