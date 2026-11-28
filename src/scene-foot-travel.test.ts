import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { starterProject } from "./demo-starter";
import type { SceneElement } from "./model";
import { makeScene, validateProject, validGroundSlope } from "./model";
import { elementBase, sceneFramesAt } from "./timeline";
import { puppetFootSoleAt } from "./cinematic-gait";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { footSceneryImages, possibleFootDepth, possibleFootSceneryOverlaps, sceneFootGroundAt, sceneFootGroundPointAt, sceneGroundYAt, sceneFootTravel } from "./scene-foot-travel";
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
  it("finds only sampled shoe positions inside a placed scenery image box without editing animation", () => {
    const project = paintedFootCartoon("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=");
    const scene = project.scenes[0], actor = scene.elements[0];
    const points = sceneFootTravel(project, scene, actor.id, 0, "right")!.points;
    const middle = points[36];
    project.assets.push({ ...project.assets[0], id: "painted-scenery", name: "Painted scenery" });
    const image: SceneElement = { ...actor, id: "scenery-image", characterId: "", kind: "art",
      assetId: "painted-scenery", name: "Painted scenery", sceneryDepth: "behind" as const,
      animation: undefined, x: middle.x, y: middle.y + 45, width: 90, height: 100,
      motion: "still" as const };
    scene.elements.unshift(image);
    expect(validateProject(project)).toBeTruthy();
    expect(footSceneryImages(project, scene).map(item => item.id)).toEqual([image.id]);
    const original = JSON.stringify(project);
    const findings = possibleFootSceneryOverlaps(project, scene, image.id, points)!;
    expect(findings).toHaveLength(1);
    expect(findings[0].startIndex).toBeGreaterThan(0);
    expect(findings[0].endIndex).toBeLessThan(points.length - 1);
    expect(Math.abs(findings[0].peakIndex - 36)).toBeLessThanOrEqual(1);
    expect(findings[0].insetPixels).toBeCloseTo(45);
    expect(JSON.stringify(project)).toBe(original);
    image.y += 150;
    expect(possibleFootSceneryOverlaps(project, scene, image.id, points)).toEqual([]);
    image.backdrop = true;
    expect(possibleFootSceneryOverlaps(project, scene, image.id, points)).toBeUndefined();
  });

  it("uses moving, rotated and parallax image bounds and ignores hidden scenery", () => {
    const { project, scene, actor } = fixture();
    project.assets.push({ ...project.assets[0], id: "placed-image" });
    const image = { ...actor, id: "placed-image", characterId: "", kind: "art" as const,
      assetId: "placed-image", sceneryDepth: "behind" as const, animation: undefined,
      motion: "still" as const, x: 320, y: 350, width: 40, height: 100 };
    scene.elements.unshift(image);
    const point = { index: 0, seconds: 2, x: 348, y: 300, floorGap: 0 };
    expect(possibleFootSceneryOverlaps(project, scene, image.id, [point])).toEqual([]);
    scene.gentleDepth = true;
    scene.cameraAnimation = { keyframes: [
      { id: "still-camera", time: 0, x: 500, y: 225, zoom: 1, easing: "linear" },
    ] };
    expect(possibleFootSceneryOverlaps(project, scene, image.id, [point])).toMatchObject([
      { peakIndex: 0, seconds: 2, insetPixels: 12 },
    ]);
    scene.gentleDepth = false;
    image.rotation = 90;
    expect(possibleFootSceneryOverlaps(project, scene, image.id,
      [{ ...point, x: 370, y: 350 }])).toHaveLength(1);
    image.opacity = 0.3;
    expect(possibleFootSceneryOverlaps(project, scene, image.id,
      [{ ...point, x: 370, y: 350 }])).toEqual([]);
    image.opacity = 1;
    scene.objectTracks = [{ objectId: image.id, initial: "", states: [], changes: [] }];
    expect(footSceneryImages(project, scene)).toEqual([]);
  });

  it("bounds a two-point guide and finds a dip beneath its measured slope", () => {
    const { project, scene, actor } = fixture();
    actor.animation!.keyframes.splice(1, 0, {
      ...actor.animation!.keyframes[0], id: "slope-mid", time: 1.5, x: 340, y: 344,
    });
    actor.animation!.keyframes[2].y += 12;
    const first = sceneFootGroundPointAt(project, scene, actor.id, 0, "right")!;
    const second = sceneFootGroundPointAt(project, scene, actor.id, 3, "right")!;
    expect(validGroundSlope(first, second)).toBe(true);
    scene.footGroundY = first.y;
    scene.footGroundPoints = [first, second];
    const saved = JSON.stringify(project);
    const review = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    expect(review.possibleDepth).toEqual([]);
    expect(sceneGroundYAt(scene, review.points[36].x)).toBeCloseTo(first.y + 6);
    expect(review.possibleGroundDepth).toHaveLength(1);
    expect(review.possibleGroundDepth[0]).toMatchObject({ peakIndex: 36, depthPixels: 8 });
    expect(sceneGroundYAt(scene, Math.min(first.x, second.x) - 1)).toBeUndefined();
    expect(sceneGroundYAt(scene, Math.max(first.x, second.x) + 1)).toBeUndefined();
    const outside = { ...review.points[36], index: 0, x: first.x - 1, y: first.y + 40 };
    expect(possibleFootDepth([outside, review.points[36]], [true, true],
      point => sceneGroundYAt(scene, point.x))).toMatchObject([
      { startIndex: 1, endIndex: 1, peakIndex: 1, depthPixels: 8 },
    ]);
    scene.footGroundPoints = [second, first];
    scene.footGroundY = second.y;
    expect(sceneGroundYAt(scene, review.points[36].x)).toBeCloseTo(first.y + 6);
    scene.footGroundPoints = [first, second];
    scene.footGroundY = first.y;
    expect(JSON.stringify(project)).toBe(saved);
  });

  it("draws editor-only guide points in the same camera space as the puppet", () => {
    const project = paintedFootCartoon("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=");
    const scene = project.scenes[0], actor = scene.elements[0];
    const first = sceneFootGroundPointAt(project, scene, actor.id, 0, "right")!;
    const second = sceneFootGroundPointAt(project, scene, actor.id, 3, "right")!;
    scene.footGroundY = first.y;
    scene.footGroundPoints = [first, second];
    scene.cameraAnimation = { keyframes: [
      { id: "guide-camera-start", time: 0, x: 400, y: 225, zoom: 1, easing: "linear" },
      { id: "guide-camera-end", time: 4, x: 500, y: 245, zoom: 1.4, easing: "linear" },
    ] };
    const at = (time: number, showFootGroundGuide: boolean) =>
      renderToStaticMarkup(createElement(Stage, { project, scene, time, labelled: true, showFootGroundGuide }));
    const before = at(0, true), after = at(2, true);
    const guide = (html: string) => html.match(/<g class="scene-ground-guide"[^>]*>/)?.[0];
    expect(guide(before)).toContain('transform="translate(400 225) scale(1) translate(-400 -225)"');
    expect(guide(after)).toContain('transform="translate(400 225) scale(1.2) translate(-450 -235)"');
    expect(after).toContain('data-camera-transform="animated"');
    expect(after).toContain('x1="' + first.x + '"');
    expect(after).toContain('x2="' + second.x + '"');
    expect(at(2, false)).not.toContain("scene-ground-guide");
    scene.cameraAnimation = undefined;
    expect(guide(at(2, true))).toContain('transform="translate(400 225) scale(1) translate(-400 -225)"');
    expect(at(2, false)).not.toContain("scene-ground-guide");
  });

  it("keeps old flat guides portable and rejects malformed or implausible slopes", () => {
    const project = paintedFootCartoon("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=");
    const scene = project.scenes[0], actor = scene.elements[0];
    const first = sceneFootGroundPointAt(project, scene, actor.id, 0, "right")!;
    scene.footGroundY = first.y;
    expect(validateProject(project)).toBeTruthy(); // PR #192 portable backup: no point X stored.
    expect(sceneGroundYAt(scene, 0)).toBe(first.y);
    scene.footGroundPoints = [first];
    expect(validateProject(project)).toBeTruthy();
    const tooClose = { x: first.x + 79, y: first.y };
    const tooSteep = { x: first.x + 100, y: first.y - 51 };
    expect(validGroundSlope(first, tooClose)).toBe(false);
    expect(validGroundSlope(first, tooSteep)).toBe(false);
    for (const bad of [[first, tooClose], [first, tooSteep],
      [first, { x: first.x + 100, y: 451 }]]) {
      scene.footGroundPoints = bad;
      expect(() => validateProject(project)).toThrow();
    }
    scene.footGroundPoints = [{ ...first, y: first.y + 1 }];
    expect(() => validateProject(project)).toThrow();
    scene.footGroundPoints = undefined;
    expect(validateProject(project)).toBeTruthy();
  });

  it("compares a saved flat-scene reference when the entire actor moves below it", () => {
    const { project, scene, actor } = fixture();
    const reference = sceneFootGroundAt(project, scene, actor.id, 0, "right")!;
    scene.footGroundY = reference;
    actor.animation!.keyframes[1].y += 15;
    const original = JSON.stringify(project);
    const review = sceneFootTravel(project, scene, actor.id, 0, "right")!;
    expect(review.possibleDepth).toEqual([]);
    expect(review.possibleGroundDepth).toHaveLength(1);
    expect(review.possibleGroundDepth[0]).toMatchObject({ peakIndex: 72, depthPixels: 15 });
    expect(sceneFootGroundAt(project, scene, actor.id, 2, "right"))
      .toBeCloseTo(review.points[48].y);
    expect(JSON.stringify(project)).toBe(original);
    const portable = paintedFootCartoon(project.assets[0].dataUrl);
    portable.scenes[0].footGroundY = reference;
    expect(validateProject(portable)).toBeTruthy();
    portable.scenes[0].footGroundY = -1;
    expect(() => validateProject(portable)).toThrow();
    portable.scenes[0].footGroundY = Number.NaN;
    expect(() => validateProject(portable)).toThrow();
  });

  it("groups below-guide spans and refuses missing or offstage sole references", () => {
    const { project, scene, actor } = fixture();
    const y = sceneFootGroundAt(project, scene, actor.id, 0, "left")!;
    const points = [y, y + 4, y + 8, y + 3, y + 10].map((sole, index) => ({
      index, seconds: index / 24, x: 100, y: sole, floorGap: 0,
    }));
    expect(possibleFootDepth(points, [true, true, false, true, true], y))
      .toMatchObject([{ startIndex: 4, endIndex: 4, depthPixels: 10 },
        { startIndex: 1, endIndex: 1, depthPixels: 4 }]);
    expect(sceneFootGroundAt(project, scene, actor.id, Number.NaN, "left")).toBeUndefined();
    expect(sceneFootGroundAt(project, scene, actor.id, 4.01, "left")).toBeUndefined();
    actor.y = 650;
    actor.animation = undefined;
    expect(sceneFootGroundAt(project, scene, actor.id, 0, "left")).toBeUndefined();
  });

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
