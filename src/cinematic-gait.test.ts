import { describe, expect, it } from "vitest";
import { cinematicGaitAt, solveTwoBone } from "./cinematic-gait";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementAt, sceneElementAt, sceneFramesAt } from "./timeline";
import { puppetTransforms } from "./puppet-model";

function fixture() {
  const project = littleFixersFullBodyPilot();
  const scene = project.scenes[0];
  const actor = scene.elements.find(e => e.characterId)!;
  return { project, scene, actor };
}

describe("Cinematic foot planting", () => {
  it("respects the original authored scene, Classic mode, and calm previews", () => {
    const { project, scene, actor } = fixture();
    const original = JSON.stringify(project);
    const classic = sceneElementAt(project, scene, actor, 5.2, 0);
    expect(classic).toEqual(elementAt(actor, 5.2, scene.duration));
    project.visualStyle = "storybook-cinematic";
    const before = JSON.stringify(project);
    const cinematic = sceneElementAt(project, scene, actor, 5.2, 0);
    expect(cinematic.x).toBeCloseTo(classic.x, 8);
    expect(cinematic.joints?.leftFoot || cinematic.joints?.rightFoot).toBeDefined();
    expect(JSON.stringify(project)).toBe(before);
    const calm = sceneElementAt(project, scene, actor, 5.2, 0, true);
    expect(calm).toEqual(elementAt(actor, 5.2, scene.duration, true));
    project.visualStyle = undefined;
    expect(JSON.stringify(project)).toBe(original);
    expect(sceneElementAt(project, scene, actor, 5.2, 0)).toEqual(classic);
  });

  it("seeks deterministically and adds support to both original work boots", () => {
    const { project, scene, actor } = fixture();
    project.visualStyle = "storybook-cinematic";
    const time = 5.2;
    const first = sceneFramesAt(project, scene, time).get(actor.id)!;
    const repeated = sceneFramesAt(project, scene, time).get(actor.id)!;
    expect(first).toEqual(repeated);
    const rig = project.characters[0].puppet!;
    const original = puppetTransforms(rig, elementAt(actor, time, scene.duration).joints);
    const planted = puppetTransforms(rig, first.joints);
    const feet = rig.parts.flatMap((part, index) =>
      part.role === "leftFoot" || part.role === "rightFoot" ? [index] : []);
    expect(feet).toHaveLength(2);
    expect(feet.some(i => Math.abs(original[i].x - planted[i].x) > 0.01 ||
      Math.abs(original[i].y - planted[i].y) > 0.01 ||
      Math.abs(original[i].angle - planted[i].angle) > 0.01)).toBe(true);
    for (const i of feet) {
      expect(Number.isFinite(planted[i].x)).toBe(true);
      expect(Number.isFinite(planted[i].y)).toBe(true);
    }
  });

  it("settles back to the existing pose during stationary listening", () => {
    const { project, scene, actor } = fixture();
    project.visualStyle = "storybook-cinematic";
    const atRest = sceneElementAt(project, scene, actor, 24, 0);
    expect(atRest.joints?.leftFoot).toBeUndefined();
    expect(atRest.joints?.rightFoot).toBeUndefined();
    expect(atRest.joints?.leftArm).toEqual(elementAt(actor, 24, scene.duration).joints?.leftArm);
  });

  it("returns unmodified frames for incomplete or raster foot rigs", () => {
    const { project, scene, actor } = fixture();
    project.visualStyle = "storybook-cinematic";
    const rig = project.characters[0].puppet!;
    const base = elementAt(actor, 5.2, scene.duration);
    const sample = (t: number) => elementAt(actor, t, scene.duration, true);
    project.characters[0].puppet = { ...rig,
      parts: rig.parts.filter(part => part.role !== "rightFoot") };
    expect(cinematicGaitAt(project, actor, base, 5.2, scene.duration, false, sample)).toBe(base);
    project.characters[0].puppet = rig;
    expect(cinematicGaitAt(project, { ...actor, flipY: true }, base, 5.2,
      scene.duration, false, sample)).toBe(base);
  });

  it("solves an actual two-segment limb without introducing non-finite angles", () => {
    const target = { x: 22, y: 63 };
    const solution = solveTwoBone({ x: 0, y: 0 }, target, 40, 35, 1)!;
    const r1 = solution.upperAngle * Math.PI / 180;
    const r2 = solution.lowerAngle * Math.PI / 180;
    const endpoint = { x: 40 * Math.cos(r1) + 35 * Math.cos(r2),
      y: 40 * Math.sin(r1) + 35 * Math.sin(r2) };
    expect(endpoint.x).toBeCloseTo(target.x, 5);
    expect(endpoint.y).toBeCloseTo(target.y, 5);
    expect(solveTwoBone({ x: 0, y: 0 }, target, 0, 35, 1)).toBeUndefined();
  });
});
