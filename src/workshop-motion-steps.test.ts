import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { standAfterSeatedGreeting } from "./workshop-sit-wave-stand";
import { workshopMotionSteps } from "./workshop-motion-steps";
import { workshopJointDifferences } from "./workshop-joint-differences";

function fixture(kind: "chair" | "bench" = "chair", duration = 10) {
  const hero = newWorkshopPuppetStarter();
  const scene = makeScene([hero]);
  scene.duration = duration;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const { scene: furnished, seatId } = addWorkshopSeat(scene, scene.elements[0], kind);
  const seated = seatWorkshopAtFurniture(furnished, actorId, seatId, hero.puppet!);
  return { hero, actorId, seatId, seated };
}

describe("PR #164 read-only consecutive real Workshop motion steps", () => {
  it("reports all three genuine sit-to-wave-to-rise-to-stand transitions", () => {
    const { hero, actorId, seatId, seated } = fixture();
    const wave = waveWorkshopWhileSeated(seated, actorId, seatId, hero.puppet!);
    const finished = standAfterSeatedGreeting(wave, actorId, seatId, hero.puppet!);
    const backup = JSON.stringify(finished);
    const steps = workshopMotionSteps(finished, actorId, hero.puppet);
    expect(steps.map(step => [step.id, step.from.seconds, step.to.seconds])).toEqual([
      ["seated-to-wave", 3, 4.5],
      ["wave-to-rise", 4.5, 8.5],
      ["rise-to-standing", 8.5, 10],
    ]);
    for (const step of steps) {
      expect(step.from.seconds).toBeLessThan(step.to.seconds);
      const measured = workshopJointDifferences(
        finished, actorId, hero.puppet, step.from.seconds, step.to.seconds,
      );
      expect(step.changedJoints).toBe(measured.length);
      expect(step.largestRotation).toBeCloseTo(
        Math.max(0, ...measured.map(diff => Math.abs(diff.angleDelta))), 7,
      );
      expect(finished.elements[0].animation!.keyframes.some(frame =>
        Math.abs(frame.time - step.from.seconds) < .001)).toBe(true);
      expect(finished.elements[0].animation!.keyframes.some(frame =>
        Math.abs(frame.time - step.to.seconds) < .001)).toBe(true);
    }
    expect(steps[0].largestRotationRole).toBe("Right Arm");
    expect(steps[0].largestRotation).toBeGreaterThan(50);
    expect(steps[2].changedJoints).toBeGreaterThan(0);
    expect(JSON.stringify(finished)).toBe(backup);
  });

  it("handles a seated greeting with a settled pose but no stand action", () => {
    const { hero, actorId, seatId, seated } = fixture("bench", 8);
    const wave = waveWorkshopWhileSeated(seated, actorId, seatId, hero.puppet!);
    expect(workshopMotionSteps(wave, actorId, hero.puppet).map(s => s.id))
      .toEqual(["seated-to-wave", "wave-to-settled"]);
    expect(workshopMotionSteps(seated, actorId, hero.puppet)).toEqual([]);
  });

  it("does not infer transitions without a rig, actor or real keyframes", () => {
    const { hero, actorId, seatId, seated } = fixture();
    const wave = waveWorkshopWhileSeated(seated, actorId, seatId, hero.puppet!);
    const final = standAfterSeatedGreeting(wave, actorId, seatId, hero.puppet!);
    expect(workshopMotionSteps(final, actorId)).toEqual([]);
    expect(workshopMotionSteps(final, "not-an-actor", hero.puppet)).toEqual([]);
    const absent = { ...final, elements: final.elements.map(element => element.id === actorId
      ? { ...element, animation: undefined } : element) };
    expect(workshopMotionSteps(absent, actorId, hero.puppet)).toEqual([]);
  });
});
