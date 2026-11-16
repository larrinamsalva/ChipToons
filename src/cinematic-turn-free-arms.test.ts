import { describe, expect, it } from "vitest";
import { cinematicTurnFreeArmsAt } from "./cinematic-turn-free-arms";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementAt, elementBase } from "./timeline";
import { neutralJoint } from "./puppet-model";

function fixture() {
  const project = littleFixersFullBodyPilot();
  const scene = project.scenes[0];
  scene.interactions = [];
  const actor = scene.elements.find(element => element.characterId)!;
  const rig = project.characters.find(c => c.id === actor.characterId)!.puppet!;
  actor.motion = "still";
  const frame = elementAt(actor, 2, scene.duration, true);
  return { project, scene, actor, rig, frame };
}

describe("PR #138 free-arm turnaround follow-through", () => {
  it("adds a short mirrored upper-arm offset to both free limbs without editing stored data", () => {
    const { project, scene, actor, rig, frame } = fixture();
    const before = JSON.stringify(project);
    const left = cinematicTurnFreeArmsAt(scene, actor, rig, frame, { headTilt: -1.35 })!;
    const right = cinematicTurnFreeArmsAt(scene, actor, rig, frame, { headTilt: 1.35 })!;
    expect(left.leftArm.angle).toBeCloseTo(-2.5);
    expect(left.rightArm.angle).toBeCloseTo(2.5);
    expect(right.leftArm.angle).toBeCloseTo(2.5);
    expect(right.rightArm.angle).toBeCloseTo(-2.5);
    expect(cinematicTurnFreeArmsAt(scene, actor, rig, frame, { headTilt: -1.35 }))
      .toEqual(left);
    expect(JSON.stringify(project)).toBe(before);
  });
  it("never moves arms reserved for artist-authored choreography", () => {
    const { scene, actor, rig, frame } = fixture();
    actor.animation = { blink: true, idle: "none", keyframes: [
      { ...elementBase(actor), id: "start", time: 0, easing: "linear" },
      { ...elementBase(actor), id: "wave", time: 2, easing: "linear",
        joints: { leftArm: { ...neutralJoint, angle: 24 } } },
    ] };
    const arms = cinematicTurnFreeArmsAt(scene, actor, rig, frame, { headTilt: -1.35 })!;
    expect(arms.leftArm).toBeUndefined();
    expect(arms.rightArm.angle).toBeCloseTo(2.5);
    const moving = { ...frame, joints: { rightArm: { ...neutralJoint, angle: 14 } } };
    expect(cinematicTurnFreeArmsAt(scene, actor, rig, moving, { headTilt: -1.35 })?.rightArm)
      .toBeUndefined();
  });
  it("respects props, authored gestures, imported art and incomplete rigs", () => {
    const { scene, actor, rig, frame } = fixture();
    const handled = { ...scene, interactions: [
      { id: "held", kind: "point" as const, actorId: actor.id,
        objectId: "toolbox", start: 1, attach: 1.2, finish: 2.4,
        grip: { hand: "right" as const, x: 0, y: 0 } },
    ] };
    expect(cinematicTurnFreeArmsAt(handled, actor, rig, frame, { headTilt: -1.35 }))
      .toBeUndefined();
    expect(cinematicTurnFreeArmsAt(scene, actor, rig,
      { ...frame, gesture: "wave" }, { headTilt: -1.35 })).toBeUndefined();
    const painted = { ...rig, parts: rig.parts.map(part =>
      part.role === "leftArm" ? { ...part, assetId: "painted-left-arm" } : part) };
    expect(cinematicTurnFreeArmsAt(scene, actor, painted, frame, { headTilt: -1.35 })?.leftArm)
      .toBeUndefined();
    expect(cinematicTurnFreeArmsAt(scene, actor, painted, frame, { headTilt: -1.35 })?.rightArm)
      .toBeDefined();
    const noArms = { ...rig, parts: rig.parts.filter(part =>
      part.role !== "leftArm" && part.role !== "rightArm") };
    expect(cinematicTurnFreeArmsAt(scene, actor, noArms, frame, { headTilt: -1.35 }))
      .toBeUndefined();
    expect(cinematicTurnFreeArmsAt(undefined, actor, rig, frame, { headTilt: -1.35 }))
      .toBeUndefined();
    expect(cinematicTurnFreeArmsAt(scene, actor, rig, frame, { headTilt: 0 }))
      .toBeUndefined();
  });
});
