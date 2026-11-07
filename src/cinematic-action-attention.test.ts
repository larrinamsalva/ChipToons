import { describe, expect, it } from "vitest";
import { cinematicFaceAt } from "./cinematic-face";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sceneFramesAt } from "./timeline";

function fixture(time: number) {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const handoff = scene.interactions![0];
  const frames = sceneFramesAt(project, scene, time);
  return { project, scene, handoff, frames };
}

describe("Cinematic Storybook action-aware eye direction", () => {
  it("Scout follows the MOVING checklist during pickup even when Helper Jo is closer than other scenery", () => {
    const { project, scene, handoff, frames } = fixture(7);
    const actor = scene.elements.find(item => item.id === handoff.actorId)!;
    const frame = frames.get(actor.id)!;
    const prop = frames.get(handoff.objectId)!;
    const snapshot = JSON.stringify(project);
    const lookAt = (dx: number) => cinematicFaceAt(project, scene, actor, frame,
      new Map(frames).set(handoff.objectId, {
        ...prop, x: frame.x + dx, y: frame.y - 60,
      }), 7, false)!;
    const left = lookAt(-110), right = lookAt(110);
    expect(left.x).toBeLessThan(-1.4);
    expect(right.x).toBeGreaterThan(1.4);
    expect(left.y).toBeLessThan(-0.1);
    expect(left.x).toBeCloseTo(lookAt(-110).x, 8);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("Helper Jo looks toward the shared checklist as it arrives, then returns attention to Scout", () => {
    const { project, scene, handoff, frames } = fixture(10.3);
    const receiver = scene.elements.find(item => item.id === handoff.transfer!.actorId)!;
    const frame = frames.get(receiver.id)!;
    const prop = frames.get(handoff.objectId)!;
    const sample = (dx: number, time: number) => {
      const current = sceneFramesAt(project, scene, time);
      const actorFrame = current.get(receiver.id)!;
      const objectFrame = current.get(handoff.objectId)!;
      return cinematicFaceAt(project, scene, receiver, actorFrame,
        new Map(current).set(handoff.objectId, {
          ...objectFrame, x: actorFrame.x + dx, y: actorFrame.y - 45,
        }), time, false)!;
    };
    expect(frame).toBeDefined();
    expect(prop.heldBy).toBe(receiver.id);
    expect(sample(-120, 10.3).x).toBeLessThan(-1);
    expect(sample(120, 10.3).x).toBeGreaterThan(1);
    // After release and finish, gaze is no longer driven by the prop.
    expect(sample(-120, 13.5).x).toBeCloseTo(sample(120, 13.5).x, 8);
  });

  it("is disabled in Classic and calm previews, and leaves image-backed eyes and blink preferences untouched", () => {
    const { project, scene, handoff, frames } = fixture(7);
    const actor = scene.elements.find(item => item.id === handoff.actorId)!;
    const frame = frames.get(actor.id)!;
    project.visualStyle = undefined;
    expect(cinematicFaceAt(project, scene, actor, frame, frames, 7, false)).toBeUndefined();
    project.visualStyle = "storybook-cinematic";
    expect(cinematicFaceAt(project, scene, actor, frame, frames, 7, true)).toBeUndefined();
    const noBlink = { ...actor, animation: { ...actor.animation!, blink: false } };
    for (let n = 0; n < 70; n++) {
      const t = 4 + n * 0.08;
      const sampled = sceneFramesAt(project, scene, t);
      expect(cinematicFaceAt(project, scene, noBlink,
        { ...sampled.get(actor.id)!, blink: false }, sampled, t, false)?.blink).toBe(false);
    }
    const original = project.characters[0];
    project.characters[0] = { ...original, puppet: {
      ...original.puppet!, parts: [...original.puppet!.parts, {
        id: "painted-eye-art", role: "eyes", parentId: "head", x: 0, y: 0,
        pivotX: 0, pivotY: 0, width: 35, height: 20, assetId: "painted-eyes",
      }],
    } };
    expect(cinematicFaceAt(project, scene, actor, frame, frames, 7, false)).toBeUndefined();
  });

  it("keeps the existing conversational eye glances when a scene has no interactions", () => {
    const { project, scene, handoff, frames } = fixture(7);
    const actor = scene.elements.find(item => item.id === handoff.actorId)!;
    const frame = frames.get(actor.id)!;
    const freeScene = { ...scene, interactions: undefined };
    const book = frames.get(handoff.objectId)!;
    const left = cinematicFaceAt(project, freeScene, actor, frame,
      new Map(frames).set(handoff.objectId, { ...book, x: frame.x - 140 }), 7, false);
    const right = cinematicFaceAt(project, freeScene, actor, frame,
      new Map(frames).set(handoff.objectId, { ...book, x: frame.x + 140 }), 7, false);
    // The closer character (Jo) is still preferred to arbitrary scenery.
    expect(left).toEqual(right);
  });
});
