import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { starterProject } from "./demo-starter";
import { makeScene, validateProject } from "./model";
import { elementBase, sceneFramesAt } from "./timeline";
import { puppetFootSoleAt } from "./cinematic-gait";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { sceneFootTravel } from "./scene-foot-travel";
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
