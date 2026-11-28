import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { starterProject } from "./demo-starter";
import { makeScene, validateProject } from "./model";
import { elementBase, sceneFramesAt } from "./timeline";
import { puppetFootSoleAt } from "./cinematic-gait";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { possibleFootDepth, sceneFootTravel } from "./scene-foot-travel";
import { paintedFootCartoon } from "../tests/custom-foot-fixture";
import { Stage } from "./components/Stage";

function fixture() {
  const project = starterProject();
  const character = newWorkshopPuppetStarter();
  character.puppet = { ...character.puppet!, costume: undefined,
    parts: character.puppet!.parts.map(part =>
      part.role === "rightFoot" ? { ...part, assetId: "painted-shoe" } : part) };
  project.characters.push(character);
  project.assets.push({ id: "painted-shoe", name: "Painted shoe", type: "image",
    mime: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=" });
  const scene = makeScene([character]);
  scene.duration = 4;
  const actor = scene.elements[0];
  actor.x = 250; actor.y = 330; actor.motion = "still";
  actor.animation = { blink: false, idle: "none", keyframes: [
    { ...elementBase(actor), id: "foot-start", time: 0, x: 250, easing: "linear" },
    { ...elementBase(actor), id: "foot-end", time: 3, x: 430, easing: "linear" },
  ] };
  project.scenes = [scene];
  return { project, scene, actor, character };
}

describe("custom puppet foot review", () => {
  it("groups below-neutral samples, ignores tilted poses and ranks the deepest span", () => {
    const gaps = [0, -4, -6, -5, -3, -8, -2, -8];
    const points = gaps.map((floorGap, index) => ({ index, seconds: index / 24,
      x: 100, y: 300 - floorGap, floorGap }));
    const findings = possibleFootDepth(points,
      [true, true, true, false, true, true, true, true]);
    expect(findings.map(({ startIndex, endIndex, peakIndex, depthPixels }) =>
      [startIndex, endIndex, peakIndex, depthPixels])).toEqual([
      [5, 5, 5, 8], [7, 7, 7, 8], [1, 2, 2, 6],
    ]);
  });

  it("finds a lowered painted sole using real Stage samples without editing the cartoon", () => {
    const { project, scene, actor, character } = fixture();
    const neutral = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    expect(neutral.possibleDepth).toEqual([]);
    const foot = character.puppet!.parts.find(part => part.role === "rightFoot")!;
    actor.animation!.keyframes[1].joints = { [foot.id]: { x: 0, y: 12, angle: 0 } };
    const saved = JSON.stringify(project);
    const lowered = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    expect(lowered.possibleDepth).toHaveLength(1);
    expect(lowered.possibleDepth[0].depthPixels).toBeCloseTo(12);
    expect(lowered.possibleDepth[0].seconds).toBeCloseTo(3);
    expect(lowered.points[48].floorGap).toBeCloseTo(-8);
    const frame = sceneFramesAt(project, scene, 2).get(actor.id)!;
    expect(lowered.points[48].y).toBeCloseTo(
      puppetFootSoleAt(character.puppet!, actor, frame, foot).y);
    expect(JSON.stringify(project)).toBe(saved);
  });

  it("uses the workshop vector boot's outsole for the same depth warning", () => {
    const project = paintedFootCartoon("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=");
    project.characters[0].puppet!.costume = "workshop";
    const scene = project.scenes[0], actor = scene.elements[0];
    actor.animation!.keyframes[1].joints = { leftFoot: { x: 0, y: 10, angle: 0 } };
    const left = sceneFootTravel(project, scene, actor.id, 0, "left")!;
    const right = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    expect(left.paintedFoot).toBe(false);
    expect(left.possibleDepth[0].depthPixels).toBeCloseTo(10);
    expect(right.possibleDepth).toEqual([]);
  });

  it("accepts the same portable picture-foot project used by browser and media proof", () => {
    const project = paintedFootCartoon("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=");
    expect(validateProject(project)).toBeTruthy();
    expect(sceneFootTravel(project, project.scenes[0], project.scenes[0].elements[0].id, 0, "right")?.paintedFoot)
      .toBe(true);
    const before = renderToStaticMarkup(createElement(Stage, {
      project, scene: project.scenes[0], time: 1.5, labelled: false,
    }));
    const foot = project.characters[0].puppet!.parts.find(part => part.role === "rightFoot")!;
    foot.soleX = 0.75; foot.soleY = 0.8;
    expect(validateProject(project)).toBeTruthy();
    expect(renderToStaticMarkup(createElement(Stage, {
      project, scene: project.scenes[0], time: 1.5, labelled: false,
    }))).toBe(before);
  });
  it("samples painted feet from the actual Stage motion without editing their animation", () => {
    const { project, scene, actor, character } = fixture();
    const saved = JSON.stringify(project);
    const review = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    expect(review.paintedFoot).toBe(true);
    expect(review.points).toHaveLength(73);
    expect(review.points.at(-1)?.seconds).toBe(3);
    expect(review.possibleSlides).toHaveLength(5);
    expect(review.points[0].x).toBeGreaterThan(100);
    expect(review.points[0].y).toBeLessThan(420);
    expect(review.points[36].x - review.points[7].x).toBeGreaterThan(50);
    const sample = review.points[24];
    const frame = sceneFramesAt(project, scene, sample.seconds).get(actor.id)!;
    const foot = character.puppet!.parts.find(part => part.role === "rightFoot")!;
    expect(sample).toMatchObject(puppetFootSoleAt(character.puppet!, actor, frame, foot));
    expect(JSON.stringify(project)).toBe(saved);
    const left = sceneFootTravel(project, scene, actor.id, 0, "left")!;
    expect(left.paintedFoot).toBe(false);
    expect(left.points[24].x).not.toBeCloseTo(sample.x);
  });

  it("uses the creator's picture-sole marker without moving any rendered artwork", () => {
    const { project, scene, actor, character } = fixture();
    const foot = character.puppet!.parts.find(part => part.role === "rightFoot")!;
    const original = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    foot.soleX = 0.75; foot.soleY = 0.8;
    const marked = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    expect(marked.markedSole).toBe(true);
    expect(marked.points[24].x - original.points[24].x).toBeCloseTo(foot.width * 0.25);
    expect(marked.points[24].y - original.points[24].y).toBeCloseTo(-foot.height * 0.2);
    const before = sceneFramesAt(project, scene, 1).get(actor.id)!;
    foot.soleX = undefined; foot.soleY = undefined;
    expect(sceneFramesAt(project, scene, 1).get(actor.id)).toEqual(before);
  });

  it("uses the current three-second window and rejects unsupported rigs safely", () => {
    const { project, scene, actor, character } = fixture();
    const review = sceneFootTravel(project, scene, actor.id, 3.9, "right")!;
    expect(review.start).toBe(1);
    expect(review.end).toBe(4);
    expect(sceneFootTravel(project, scene, actor.id, Number.NaN, "right")).toBeUndefined();
    expect(sceneFootTravel(project, scene, "missing", 0, "right")).toBeUndefined();
    actor.flipY = true;
    expect(sceneFootTravel(project, scene, actor.id, 0, "right")).toBeUndefined();
    actor.flipY = false;
    character.puppet!.parts = character.puppet!.parts.filter(part => part.role !== "leftFoot");
    expect(sceneFootTravel(project, scene, actor.id, 0, "right")).toBeUndefined();
  });
});
