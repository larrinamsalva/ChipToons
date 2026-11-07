import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Stage } from "./components/Stage";
import { workshopGroundShadows, workshopLayerTransform } from "./cinematic-workshop";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementAt, sceneFramesAt, stageCameraAt } from "./timeline";
import { puppetTransforms } from "./puppet-model";
import { stagePoint } from "./interaction-motion";
import { parseBackup } from "./model";
import { sceneryOffset, sceneryParallax } from "./world-model";

describe("Cinematic workshop depth and grounding", () => {
  function fixture() {
    const project = littleFixersFullBodyPilot();
    project.visualStyle = "storybook-cinematic";
    const scene = project.scenes[0];
    const actor = scene.elements.find(e => e.characterId)!;
    const character = project.characters[0];
    return { project, scene, actor, character };
  }

  it("adds three decorative depth planes only to opted-in workshop scenes", () => {
    const { project, scene } = fixture();
    const draw = () => renderToStaticMarkup(createElement(Stage, { project, scene, time: 6, labelled: false }));
    const before = JSON.stringify(project);
    const cinematic = draw();
    for (const depth of ["behind", "alongside", "front"])
      expect(cinematic).toContain(`data-workshop-depth="${depth}"`);
    expect(cinematic).toContain("data-ground-shadow=");
    expect(cinematic).not.toContain("<filter");
    expect(draw()).toBe(cinematic);
    expect(JSON.stringify(project)).toBe(before);
    expect(parseBackup(before)).toEqual(project);
    project.visualStyle = undefined;
    const classic = draw();
    expect(classic).not.toContain("data-workshop-depth");
    expect(classic).not.toContain("data-ground-shadow");
    expect(classic).toContain('fill="#3b5b45" opacity=".14"');
    project.visualStyle = "storybook-cinematic";
    scene.background = "garden";
    expect(draw()).not.toContain("data-workshop-depth");
    expect(draw()).not.toContain("data-ground-shadow");
  });

  it("gently separates decorative planes with the existing bounded camera offsets", () => {
    const { project, scene, actor } = fixture();
    const a = stageCameraAt(project, scene, 0);
    const b = stageCameraAt(project, scene, 20);
    expect(a.x).not.toBe(b.x);
    expect(workshopLayerTransform("behind", a, false))
      .not.toBe(workshopLayerTransform("behind", b, false));
    expect(sceneryParallax("behind", { x: 10000, y: 10000 })).toEqual({ x: 28, y: 16 });
    expect(sceneryParallax("front", { x: 10000, y: 10000 })).toEqual({ x: -28, y: -16 });
    expect(workshopLayerTransform("alongside", b, false))
      .toBe("translate(0 0) translate(400 290) scale(1) translate(-400 -290)");
    for (const depth of ["behind", "alongside", "front"] as const)
      expect(workshopLayerTransform(depth, b, true)).toBe(workshopLayerTransform(depth, a, true));
    // The actor/hand and existing prop placement continue using their original
    // scenery offsets; camera-responsive decoration never changes their frames.
    expect(sceneryOffset(scene, actor, b, false)).toEqual({ x: 0, y: 0 });
    const table = scene.elements.find(e => e.prop === "table")!;
    expect(sceneryOffset(scene, table, b, false)).toEqual(sceneryParallax("behind", b));
  });

  it("follows actual animated boot positions and softens contact when a foot lifts", () => {
    const { project, scene, actor, character } = fixture();
    const time = 5.2;
    const frame = sceneFramesAt(project, scene, time).get(actor.id)!;
    const floor = elementAt(actor, time, scene.duration, true);
    const shadows = workshopGroundShadows(actor, frame, floor, character);
    expect(shadows.map(s => s.id)).toEqual(["body", "leftFoot", "rightFoot"]);
    const rig = character.puppet!;
    const parts = puppetTransforms(rig, frame.joints);
    const foot = rig.parts.find(p => p.role === "leftFoot")!;
    const pose = parts[rig.parts.indexOf(foot)];
    const angle = pose.angle * Math.PI / 180;
    const sole = foot.height / 2 - foot.pivotY + 2;
    const point = stagePoint(actor, frame, {
      x: pose.x - foot.pivotX * Math.cos(angle) - sole * Math.sin(angle),
      y: pose.y - foot.pivotX * Math.sin(angle) + sole * Math.cos(angle),
    });
    expect(shadows[1].x).toBeCloseTo(point.x, 8);
    expect(shadows[1].y).toBeGreaterThanOrEqual(point.y);
    const lifted = workshopGroundShadows(actor, { ...frame, y: frame.y - 18 }, floor, character);
    expect(lifted[1].y).toBeCloseTo(shadows[1].y, 8);
    expect(lifted[1].opacity).toBeLessThan(shadows[1].opacity);
    const moved = workshopGroundShadows(actor, { ...frame, x: frame.x + 91 }, floor, character);
    expect(moved[1].x - shadows[1].x).toBeCloseTo(91, 8);
    expect(moved[1].y).toBeCloseTo(shadows[1].y, 8);
    expect(workshopGroundShadows(actor, frame, floor, character)).toEqual(shadows);
  });

  it("keeps shadows horizontal outside actor rotation and skips carried or non-grounded artwork", () => {
    const { project, scene, actor, character } = fixture();
    const frame = sceneFramesAt(project, scene, 6).get(actor.id)!;
    const floor = elementAt(actor, 6, scene.duration, true);
    expect(workshopGroundShadows(actor, { ...frame, heldBy: "other" }, floor, character)).toEqual([]);
    expect(workshopGroundShadows({ ...actor, backdrop: true }, frame, floor, character)).toEqual([]);
    expect(workshopGroundShadows({ ...actor, flipY: true }, frame, floor, character)).toEqual([]);
    const book = scene.elements.find(e => e.prop === "book")!;
    expect(workshopGroundShadows(book, frame, floor)).toEqual([]);
    const table = scene.elements.find(e => e.prop === "table")!;
    const tableFrame = sceneFramesAt(project, scene, 6).get(table.id)!;
    expect(workshopGroundShadows(table, tableFrame, tableFrame)[0])
      .toMatchObject({ x: tableFrame.x, y: tableFrame.y + 2 * tableFrame.scale });
    const svg = renderToStaticMarkup(createElement(Stage, { project, scene, time: 6, labelled: false }));
    expect(svg).toContain(`data-ground-shadow="${actor.id}"`);
    // Ground ellipses have world-space centers, no inherited actor roll/flip.
    expect(svg).toMatch(new RegExp(`data-ground-shadow="${actor.id}"[^>]*><ellipse[^>]*cx=`));
  });
});
