import { describe, expect, it } from "vitest";
import { validateProject } from "./model";
import { sceneFramesAt } from "./timeline";
import { puppetFootSoleAt } from "./cinematic-gait";
import { alignPictureFootFrame, holdPictureFootForThreeFrames } from "./scene-foot-fix";
import { sceneFootTravel } from "./scene-foot-travel";
import { paintedFootCartoon } from "../tests/custom-foot-fixture";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=";

describe("one-frame picture-foot alignment", () => {
  it("adds one undoable authored foot key that holds the sampled sole X without moving the other foot", () => {
    const project = paintedFootCartoon(png);
    const scene = project.scenes[0], actor = scene.elements[0];
    const rig = project.characters[0].puppet!;
    const foot = rig.parts.find(part => part.role === "rightFoot")!;
    foot.soleX = 0.75; foot.soleY = 1;
    const review = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    const interval = review.possibleSlides[0];
    const original = JSON.stringify(project);
    const next = alignPictureFootFrame(project, scene, actor.id, 0, "right", interval.afterIndex)!;
    expect(next).toBeDefined();
    expect(JSON.stringify(project)).toBe(original);
    const changed = next.elements[0];
    expect(changed.animation!.keyframes).toHaveLength(actor.animation!.keyframes.length + 1);
    expect(changed.animation!.keyframes[0]).toEqual(actor.animation!.keyframes[0]);
    expect(changed.animation!.keyframes.at(-1)).toEqual(actor.animation!.keyframes.at(-1));
    expect(next.elements.slice(1)).toEqual(scene.elements.slice(1));
    const nextProject = { ...project, scenes: [next] };
    expect(validateProject(nextProject)).toBeTruthy();
    const time = review.points[interval.afterIndex].seconds;
    const before = sceneFramesAt(project, scene, time).get(actor.id)!;
    const after = sceneFramesAt(nextProject, next, time).get(actor.id)!;
    const oldSole = puppetFootSoleAt(rig, actor, before, foot);
    const newSole = puppetFootSoleAt(rig, actor, after, foot);
    expect(Math.abs(oldSole.x - newSole.x)).toBeGreaterThan(1.5);
    expect(newSole.x).toBeCloseTo(review.points[interval.beforeIndex].x, 1);
    expect(newSole.y).toBeCloseTo(oldSole.y, 1);
  });

  it("refuses stale, unsupported, oversized or authored-key edits without mutation", () => {
    const project = paintedFootCartoon(png);
    const scene = project.scenes[0], actor = scene.elements[0];
    const interval = sceneFootTravel(project, scene, actor.id, 0, "right")!.possibleSlides[0];
    expect(alignPictureFootFrame(project, scene, actor.id, 0, "right", 999)).toBeUndefined();
    expect(alignPictureFootFrame(project, scene, actor.id, 0, "left", interval.afterIndex)).toBeUndefined();
    const original = JSON.stringify(project);
    actor.motion = "walk";
    expect(alignPictureFootFrame(project, scene, actor.id, 0, "right", interval.afterIndex)).toBeUndefined();
    actor.motion = "still";
    actor.animation!.keyframes.splice(1, 0, { ...actor.animation!.keyframes[0],
      id: "already-authored", time: 0.042 });
    expect(alignPictureFootFrame(project, scene, actor.id, 0, "right", interval.afterIndex)).toBeUndefined();
    actor.animation!.keyframes.splice(1, 1);
    actor.animation!.keyframes[1].easing = "ease-in-out";
    expect(alignPictureFootFrame(project, scene, actor.id, 0, "right", interval.afterIndex)).toBeUndefined();
    actor.animation!.keyframes[1].easing = "linear";
    expect(JSON.stringify(project)).toBe(original);
  });

  it("aligns a faster but bounded picture step at a later timeline frame", () => {
    const project = paintedFootCartoon(png);
    const scene = project.scenes[0], actor = scene.elements[0];
    actor.animation!.keyframes[1] = { ...actor.animation!.keyframes[1], time: 2, x: 650 };
    const review = sceneFootTravel(project, scene, actor.id, 1, "right")!;
    expect(review.possibleSlides[0].horizontalPixels).toBeGreaterThan(8);
    const next = alignPictureFootFrame(project, scene, actor.id, 1, "right",
      review.possibleSlides[0].afterIndex);
    expect(next).toBeDefined();
    const updated = { ...project, scenes: [next!] };
    const changed = sceneFootTravel(updated, next!, actor.id, 1, "right")!;
    const interval = review.possibleSlides[0];
    expect(Math.abs(changed.points[interval.afterIndex].x -
      review.points[interval.beforeIndex].x)).toBeLessThan(0.15);
    const footId = project.characters[0].puppet!.parts.find(part => part.role === "rightFoot")!.id;
    const other = project.characters[0].puppet!.parts.find(part => part.role === "leftFoot")!;
    for (const time of [0.2, 0.7, 1.3, 1.8]) {
      const oldFrame = sceneFramesAt(project, scene, time).get(actor.id)!;
      const newFrame = sceneFramesAt(updated, next!, time).get(actor.id)!;
      expect(newFrame.x).toBeCloseTo(oldFrame.x, 1);
      expect(newFrame.y).toBeCloseTo(oldFrame.y, 1);
      expect(puppetFootSoleAt(project.characters[0].puppet!, actor, newFrame, other).x)
        .toBeCloseTo(puppetFootSoleAt(project.characters[0].puppet!, actor, oldFrame, other).x, 1);
      expect(Math.abs(newFrame.joints?.[footId]?.x ?? 0)).toBeLessThan(12);
    }
  });
});

describe("three-frame picture-foot hold", () => {
  it("holds the same painted sole X across three adjacent samples without changing actor or other foot", () => {
    const project = paintedFootCartoon(png);
    const scene = project.scenes[0], actor = scene.elements[0];
    const rig = project.characters[0].puppet!;
    const other = rig.parts.find(part => part.role === "leftFoot")!;
    const review = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    const index = review.possibleSlides[0].afterIndex;
    const original = JSON.stringify(project);
    const next = holdPictureFootForThreeFrames(project, scene, actor.id, 0, "right", index)!;
    expect(next).toBeDefined();
    expect(JSON.stringify(project)).toBe(original);
    const keys = next.elements[0].animation!.keyframes;
    expect(keys).toHaveLength(actor.animation!.keyframes.length + 3);
    expect(keys[0]).toEqual(actor.animation!.keyframes[0]);
    expect(keys.at(-1)).toEqual(actor.animation!.keyframes.at(-1));
    const updated = { ...project, scenes: [next] };
    expect(validateProject(updated)).toBeTruthy();
    const held = sceneFootTravel(updated, next, actor.id, 0, "right")!;
    for (let sample = index; sample <= index + 2; sample++) {
      expect(held.points[sample].x).toBeCloseTo(review.points[index - 1].x, 1);
      expect(held.points[sample].y).toBeCloseTo(review.points[sample].y, 1);
      const time = review.points[sample].seconds;
      const before = sceneFramesAt(project, scene, time).get(actor.id)!;
      const after = sceneFramesAt(updated, next, time).get(actor.id)!;
      expect(after.x).toBeCloseTo(before.x, 1);
      expect(puppetFootSoleAt(rig, actor, after, other).x)
        .toBeCloseTo(puppetFootSoleAt(rig, actor, before, other).x, 1);
    }
  });

  it("rejects an authored middle key and a displacement beyond twelve pixels atomically", () => {
    const project = paintedFootCartoon(png);
    const scene = project.scenes[0], actor = scene.elements[0];
    const index = sceneFootTravel(project, scene, actor.id, 0, "right")!.possibleSlides[0].afterIndex;
    const before = JSON.stringify(project);
    actor.animation!.keyframes.splice(1, 0, {
      ...actor.animation!.keyframes[0], id: "authored-middle", time: 0.083,
    });
    expect(holdPictureFootForThreeFrames(project, scene, actor.id, 0, "right", index))
      .toBeUndefined();
    actor.animation!.keyframes.splice(1, 1);
    expect(JSON.stringify(project)).toBe(before);
    actor.animation!.keyframes[1].x = 610;
    expect(holdPictureFootForThreeFrames(project, scene, actor.id, 0, "right", index))
      .toBeUndefined();
  });
});
