import { describe, expect, it } from "vitest";
import { cinematicArmIK } from "./cinematic-arm-ik";
import { handAt, stagePoint } from "./interaction-motion";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { newPart, puppetTransforms } from "./puppet-model";
import { elementAt, sceneFramesAt } from "./timeline";
import type { Grip, Interaction } from "./interaction-model";

function fixture() {
  const project = littleFixersFullBodyPilot();
  const scene = project.scenes[0];
  const actor = scene.elements.find(item => item.characterId)!;
  actor.animation = undefined;
  actor.x = 300;
  actor.y = 350;
  actor.scale = 1;
  const rig = project.characters[0].puppet!;
  const upper = rig.parts.find(p => p.role === "rightArm")!;
  const forearm = { ...newPart("rightForearm", "rightForearm", upper),
    x: 0, y: 34, width: 20, height: 33 };
  const hand = { ...newPart("rightHand", "rightHand", forearm),
    x: 0, y: 27, width: 20, height: 22 };
  rig.parts.push(forearm, hand);
  const frame = elementAt(actor, 1, scene.duration, true);
  const shoulder = puppetTransforms(rig, frame.joints)[rig.parts.indexOf(upper)];
  const local = { x: shoulder.x + 30, y: shoulder.y + 50 };
  const grip: Grip = { hand: "right", x: 0, y: 0 };
  const target = stagePoint(actor, frame, local);
  return { project, scene, actor, rig, upper, forearm, hand, frame, grip, target };
}

describe("Cinematic two-joint arm reaching", () => {
  it("solves a reachable hand target through the existing rendered puppet transform and hand anchor", () => {
    const { project, actor, rig, upper, forearm, frame, grip, target } = fixture();
    const before = JSON.stringify(project);
    const angles = cinematicArmIK(rig, actor, frame, upper, grip, target, 1)!;
    expect(angles).toBeDefined();
    expect(Math.abs(angles[upper.id].angle)).toBeGreaterThan(0.1);
    expect(Math.abs(angles[forearm.id].angle)).toBeGreaterThan(0.1);
    const posed = { ...frame, joints: { ...frame.joints, ...angles } };
    const actual = handAt(project.characters[0], actor, posed, grip);
    expect(actual.x).toBeCloseTo(target.x, 5);
    expect(actual.y).toBeCloseTo(target.y, 5);
    expect(cinematicArmIK(rig, actor, frame, upper, grip, target, 1)).toEqual(angles);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("eases both joints together, keeps mirrors/rotation stable and respects grip offsets", () => {
    const { project, actor, rig, upper, frame, grip, target } = fixture();
    const entire = cinematicArmIK(rig, actor, frame, upper, grip, target, 1)!;
    const half = cinematicArmIK(rig, actor, frame, upper, grip, target, 0.5)!;
    expect(half[upper.id].angle).toBeCloseTo(entire[upper.id].angle / 2, 8);
    expect(half.rightForearm.angle).toBeCloseTo(entire.rightForearm.angle / 2, 8);
    const mirrored = { ...actor, rotation: 27, flip: true, flipY: true, scale: 1.3 };
    const mirroredFrame = elementAt(mirrored, 1, 34, true);
    const shoulder = puppetTransforms(rig, mirroredFrame.joints)[rig.parts.indexOf(upper)];
    const mirroredTarget = stagePoint(mirrored, mirroredFrame,
      { x: shoulder.x + 30, y: shoulder.y + 50 });
    const adjustedGrip: Grip = { ...grip, x: 5, y: -3 };
    const solved = cinematicArmIK(rig, mirrored, mirroredFrame, upper, adjustedGrip,
      stagePoint(mirrored, mirroredFrame, {
        x: shoulder.x + 30 + adjustedGrip.x,
        y: shoulder.y + 50 + adjustedGrip.y,
      }), 1)!;
    expect(solved).toBeDefined();
    const posed = { ...mirroredFrame, joints: { ...mirroredFrame.joints, ...solved } };
    const actual = handAt(project.characters[0], mirrored, posed, adjustedGrip);
    expect(actual.x).toBeCloseTo(stagePoint(mirrored, mirroredFrame,
      { x: shoulder.x + 30 + adjustedGrip.x, y: shoulder.y + 50 + adjustedGrip.y }).x, 5);
    expect(actual.y).toBeCloseTo(stagePoint(mirrored, mirroredFrame,
      { x: shoulder.x + 30 + adjustedGrip.x, y: shoulder.y + 50 + adjustedGrip.y }).y, 5);
    const mirroredAngles = cinematicArmIK(rig, mirrored, mirroredFrame,
      upper, grip, mirroredTarget, 1)!;
    expect(mirroredAngles[upper.id].angle).toBeCloseTo(entire[upper.id].angle, 8);
    expect(mirroredAngles.rightForearm.angle).toBeCloseTo(entire.rightForearm.angle, 8);
  });

  it("leaves authored, painted, incomplete, invalid and unreachable rigs to existing fallbacks", () => {
    const { actor, rig, upper, forearm, hand, frame, grip, target } = fixture();
    expect(cinematicArmIK(rig, actor, frame, upper, grip, target, 1)).toBeDefined();
    expect(cinematicArmIK(rig, actor, frame, upper, grip,
      stagePoint(actor, frame, { x: 800, y: -200 }), 1)).toBeUndefined();
    expect(cinematicArmIK(rig, actor, { ...frame, scale: 0 }, upper, grip, target, 1)).toBeUndefined();
    expect(cinematicArmIK(rig, actor, { ...frame, joints: {
      [forearm.id]: { x: 0, y: 0, angle: 0 },
    } }, upper, grip, target, 1)).toBeUndefined();
    expect(cinematicArmIK(rig, actor, frame, upper, { ...grip, hand: "left" }, target, 1)).toBeUndefined();
    const oldParts = rig.parts;
    rig.parts = rig.parts.filter(p => p.id !== forearm.id && p.id !== hand.id);
    expect(cinematicArmIK(rig, actor, frame, upper, grip, target, 1)).toBeUndefined();
    rig.parts = oldParts;
    forearm.assetId = "painted-piece";
    expect(cinematicArmIK(rig, actor, frame, upper, grip, target, 1)).toBeUndefined();
  });

  it("uses real shoulder and elbow during an opt-in pickup, without changing Classic or calm previews", () => {
    const { project, scene, actor, forearm, rig, frame, target, grip } = fixture();
    const book = scene.elements.find(item => item.prop === "book")!;
    book.sceneryDepth = undefined;
    book.x = target.x;
    book.y = target.y;
    const action: Interaction = { id: "articulated-pickup", kind: "pickup",
      actorId: actor.id, objectId: book.id, start: 1, attach: 2, finish: 6, grip };
    scene.interactions = [action];
    const classic = sceneFramesAt(project, scene, 2.5).get(actor.id)!;
    expect(classic.joints?.[forearm.id]).toBeUndefined();
    project.visualStyle = "storybook-cinematic";
    const before = JSON.stringify(project);
    const cinematic = sceneFramesAt(project, scene, 2.5);
    const posed = cinematic.get(actor.id)!;
    expect(posed.joints?.[forearm.id]).toBeDefined();
    const held = cinematic.get(book.id)!;
    const hand = handAt(project.characters[0], actor, posed, grip);
    expect(held.heldBy).toBe(actor.id);
    expect(held.x).toBeCloseTo(hand.x, 8);
    expect(held.y).toBeCloseTo(hand.y, 8);
    const calm = sceneFramesAt(project, scene, 2.5, 0, true).get(actor.id)!;
    expect(calm.joints?.[forearm.id]).toBeUndefined();
    expect(sceneFramesAt(project, scene, 2.5).get(actor.id)).toEqual(posed);
    expect(JSON.stringify(project)).toBe(before);
    expect(rig.parts.some(p => p.role === "rightForearm")).toBe(true);
    expect(frame.x).toBe(actor.x);
  });
});
