import { describe, expect, it } from "vitest";
import { cinematicReachJoint } from "./cinematic-reach";
import { handAt, stagePoint } from "./interaction-motion";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementAt, elementBase, sceneFramesAt } from "./timeline";
import { validateProject } from "./model";
import type { Interaction } from "./interaction-model";

function fixture() {
  const project = littleFixersFullBodyPilot();
  const scene = project.scenes[0];
  const actor = scene.elements.find(element => !!element.characterId)!;
  const book = scene.elements.find(element => element.prop === "book")!;
  actor.x = 330;
  actor.animation = undefined; // A free right arm; keyframed arms always win.
  book.sceneryDepth = undefined;
  book.x = 465;
  book.y = 367;
  const action: Interaction = {
    id: "reach-example", kind: "pickup", actorId: actor.id, objectId: book.id,
    start: 1, attach: 2.5, finish: 6,
    grip: { hand: "right", x: 0, y: 0 },
  };
  scene.interactions = [action];
  return { project, scene, actor, book, action };
}

describe("Cinematic interaction reaching", () => {
  it("targets the saved story object only in Cinematic mode and keeps held props on the real hand", () => {
    const { project, scene, actor, book, action } = fixture();
    expect(validateProject(project)).toBeTruthy();
    const classic = sceneFramesAt(project, scene, 2).get(actor.id)!;
    const classicArm = classic.joints?.rightArm?.angle;
    expect(classicArm).toBeDefined();
    project.visualStyle = "storybook-cinematic";
    const snapshot = JSON.stringify(project);
    const reach = sceneFramesAt(project, scene, 2).get(actor.id)!;
    expect(reach.joints?.rightArm?.angle).not.toBeCloseTo(classicArm!, 3);
    expect(reach.x).toBe(classic.x);
    expect(reach).toEqual(sceneFramesAt(project, scene, 2).get(actor.id));
    const heldFrames = sceneFramesAt(project, scene, 3.5);
    const held = heldFrames.get(book.id)!;
    expect(held.heldBy).toBe(actor.id);
    const grip = handAt(project.characters[0], actor, heldFrames.get(actor.id)!, action.grip);
    expect(held.x).toBeCloseTo(grip.x, 8);
    expect(held.y).toBeCloseTo(grip.y, 8);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("preserves calm authoring and an explicitly authored shoulder key", () => {
    const { project, scene, actor } = fixture();
    const classic = sceneFramesAt(project, scene, 2).get(actor.id)!;
    project.visualStyle = "storybook-cinematic";
    const calm = sceneFramesAt(project, scene, 2, 0, true).get(actor.id)!;
    expect(calm.joints?.rightArm).toEqual(classic.joints?.rightArm);
    const key = { ...elementBase(actor), id: "authored-shoulder", time: 0,
      easing: "linear" as const,
      joints: { rightArm: { x: 0, y: 0, angle: 44 } } };
    actor.animation = { blink: false, idle: "none", keyframes: [key] };
    const authored = sceneFramesAt(project, scene, 2).get(actor.id)!;
    expect(authored.joints?.rightArm).toEqual(key.joints.rightArm);
    expect(sceneFramesAt(project, scene, 2, 0, true).get(actor.id)?.joints?.rightArm)
      .toEqual(key.joints.rightArm);
  });

  it("uses stage rotation and flips correctly, with bounded corrections and safe fallbacks", () => {
    const { project, scene, actor } = fixture();
    const rig = project.characters[0].puppet!;
    const upper = rig.parts.find(part => part.role === "rightArm")!;
    const frame = elementAt(actor, 0, scene.duration, true);
    const aim = { x: 94, y: -38 };
    const joint = cinematicReachJoint(rig, actor, frame, upper,
      stagePoint(actor, frame, aim), 1)!;
    expect(joint).toBeDefined();
    expect(Math.abs(joint.angle)).toBeGreaterThan(0.1);
    expect(Math.abs(joint.angle)).toBeLessThanOrEqual(62);
    expect(cinematicReachJoint(rig, actor, frame, upper,
      stagePoint(actor, frame, aim), 0)?.angle).toBe(0);
    const rotated = { ...actor, rotation: 42, flip: true, flipY: true };
    const flipped = elementAt(rotated, 0, scene.duration, true);
    const mirror = cinematicReachJoint(rig, rotated, flipped, upper,
      stagePoint(rotated, flipped, aim), 1)!;
    expect(mirror.angle).toBeCloseTo(joint.angle, 8);
    expect(cinematicReachJoint(rig, actor, frame, upper,
      stagePoint(actor, frame, { x: 450, y: 20 }), 1)).toBeUndefined();
    expect(cinematicReachJoint(rig, actor, frame, { ...upper, assetId: "painted" },
      stagePoint(actor, frame, aim), 1)).toBeUndefined();
    expect(cinematicReachJoint(rig, actor, { ...frame, scale: 0 }, upper,
      stagePoint(actor, frame, aim), 1)).toBeUndefined();
  });
});
