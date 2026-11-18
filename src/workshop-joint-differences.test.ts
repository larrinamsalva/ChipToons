import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { standAfterSeatedGreeting } from "./workshop-sit-wave-stand";
import { workshopJointDifferences } from "./workshop-joint-differences";

function fixture() {
  const hero = newWorkshopPuppetStarter();
  const scene = makeScene([hero]);
  scene.duration = 10;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const furniture = addWorkshopSeat(scene, scene.elements[0], "bench");
  const seated = seatWorkshopAtFurniture(furniture.scene, actorId, furniture.seatId, hero.puppet!);
  const waved = waveWorkshopWhileSeated(seated, actorId, furniture.seatId, hero.puppet!);
  return {
    hero,
    actorId,
    scene: standAfterSeatedGreeting(waved, actorId, furniture.seatId, hero.puppet!),
  };
}

describe("PR #162 original Workshop Character joint difference inspector", () => {
  it("shows true puppet part labels and exact arm/forearm angle changes between seated and wave", () => {
    const { hero, actorId, scene } = fixture();
    const before = JSON.stringify(scene);
    const diffs = workshopJointDifferences(scene, actorId, hero.puppet, 3, 4.5);
    const arm = diffs.find(diff => diff.role === "rightArm");
    expect(arm).toBeDefined();
    expect(arm?.label).toBe("Right Arm");
    expect(arm?.angleDelta).toBeCloseTo(arm!.afterAngle - arm!.beforeAngle, 8);
    expect(Math.abs(arm!.angleDelta)).toBeGreaterThan(50);
    expect(diffs.map(diff => diff.partId).length)
      .toBe(new Set(diffs.map(diff => diff.partId)).size);
    expect(diffs.some(diff => diff.role === "rightForearm")).toBe(true);
    expect(JSON.stringify(scene)).toBe(before);
  });

  it("treats omitted final neutral shin joints as 0, rather than inventing missing values", () => {
    const { hero, actorId, scene } = fixture();
    const diffs = workshopJointDifferences(scene, actorId, hero.puppet, 3, 10);
    const shin = diffs.find(diff => diff.role === "leftShin");
    expect(shin?.label).toBe("Left Shin");
    expect(shin?.beforeAngle).toBeGreaterThan(25);
    expect(shin?.afterAngle).toBe(0);
    expect(shin?.angleDelta).toBeCloseTo(-shin!.beforeAngle, 7);
    expect(diffs.some(diff => diff.role === "rightShin")).toBe(true);
  });

  it("reports no changes when comparing a saved pose with itself", () => {
    const { hero, actorId, scene } = fixture();
    expect(workshopJointDifferences(scene, actorId, hero.puppet, 4.5, 4.5))
      .toEqual([]);
  });

  it("rejects absent rigs, non-keyframe times and missing actors safely", () => {
    const { hero, actorId, scene } = fixture();
    expect(workshopJointDifferences(scene, actorId, undefined, 3, 4.5)).toEqual([]);
    expect(workshopJointDifferences(scene, "not-an-actor", hero.puppet, 3, 4.5)).toEqual([]);
    expect(workshopJointDifferences(scene, actorId, hero.puppet, 3.25, 4.5)).toEqual([]);
    expect(workshopJointDifferences(scene, actorId, hero.puppet, Number.NaN, 4.5)).toEqual([]);
    expect(workshopJointDifferences(scene, actorId, hero.puppet, 3, Infinity)).toEqual([]);
  });

  it("detects local joint position offsets and does not display unknown rig part IDs", () => {
    const { hero, actorId, scene } = fixture();
    const actor = scene.elements.find(e => e.id === actorId)!;
    const key = actor.animation!.keyframes.find(frame => frame.time === 3)!;
    const next = actor.animation!.keyframes.find(frame => frame.time === 4.5)!;
    const armId = hero.puppet!.parts.find(part => part.role === "rightArm")!.id;
    const oldJoint = next.joints?.[armId] ?? { angle: 0, x: 0, y: 0 };
    const modified = {
      ...scene,
      elements: scene.elements.map(e => e.id === actorId ? {
        ...e,
        animation: {
          ...e.animation!,
          keyframes: e.animation!.keyframes.map(frame => frame.time === 4.5
            ? { ...frame,
              joints: { ...frame.joints,
                [armId]: { ...oldJoint, x: (key.joints?.[armId]?.x ?? 0) + 2.5 },
                unknownPart: { angle: 95, x: 50, y: 0 },
              },
            }
            : frame),
        },
      } : e),
    };
    const before = JSON.stringify(modified);
    const deltas = workshopJointDifferences(modified, actorId, hero.puppet, 3, 4.5);
    expect(deltas.find(diff => diff.partId === armId)?.xDelta).toBeCloseTo(2.5, 8);
    expect(deltas.some(diff => diff.partId === "unknownPart")).toBe(false);
    expect(JSON.stringify(modified)).toBe(before);
  });
});
