import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { puppetTransforms, sunnyRig, validJoints } from "./puppet-model";
import type { PuppetRig, JointSnapshot } from "./puppet-model";
import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { presetAnimation } from "./presets";
import { elementAt } from "./timeline";

function worldAngle(rig: PuppetRig, joints: JointSnapshot, role: string): number {
  const index = rig.parts.findIndex(part => part.role === role);
  if (index < 0) throw new Error(`Missing workshop role: ${role}`);
  return puppetTransforms(rig, joints)[index].angle;
}

describe("PR #149 natural workshop weight transfer and boot stance", () => {
  it("softly counter-leans head while alternate stance boots approach level", () => {
    const hero = newWorkshopPuppetStarter();
    const rig = hero.puppet!;
    const element = makeScene([hero]).elements[0];
    const source = JSON.stringify({ rig, element });
    const animation = presetAnimation(element, 3, "walk-in-place", 0, 3, rig);
    const rightStance = animation.keyframes.find(k => k.time === 1)!;
    const leftStance = animation.keyframes.find(k => k.time === 2)!;
    expect(rightStance).toBeDefined();
    expect(leftStance).toBeDefined();
    expect(rightStance.joints!.torso!.angle).toBeGreaterThan(1);
    expect(rightStance.joints!.head!.angle).toBeLessThan(-1);
    expect(leftStance.joints!.torso!.angle).toBeLessThan(-1);
    expect(leftStance.joints!.head!.angle).toBeGreaterThan(1);
    expect(Math.abs(worldAngle(rig, rightStance.joints!, "rightFoot"))).toBeLessThan(8);
    expect(Math.abs(worldAngle(rig, leftStance.joints!, "leftFoot"))).toBeLessThan(8);
    // Swinging boots still articulate, rather than freezing the whole rig.
    expect(Math.abs(rightStance.joints!.leftFoot!.angle)).toBeGreaterThan(5);
    expect(Math.abs(leftStance.joints!.rightFoot!.angle)).toBeGreaterThan(5);
    for (const frame of animation.keyframes)
      expect(validJoints(frame.joints ?? {}, new Set(rig.parts.map(part => part.id)))).toBe(true);
    expect(elementAt({ ...element, animation }, 1, 3).x).toBe(element.x);
    expect(elementAt({ ...element, animation }, 2, 3).y).toBe(element.y);
    expect(JSON.stringify({ rig, element })).toBe(source);
  });

  it("starts and ends neutral, keeps authored walk travel, and replays exactly", () => {
    const hero = newWorkshopPuppetStarter();
    const rig = hero.puppet!;
    const element = makeScene([hero]).elements[0];
    const stillWalk = presetAnimation(element, 3, "walk-in-place", 0, 3, rig);
    for (const t of [0, 3]) {
      const joints = elementAt({ ...element, animation: stillWalk }, t, 3).joints ?? {};
      expect(Math.abs(joints.torso?.angle ?? 0)).toBeLessThan(0.000001);
      expect(Math.abs(joints.head?.angle ?? 0)).toBeLessThan(0.000001);
    }
    const travel = presetAnimation(element, 3, "walk", 0, 3, rig);
    expect(elementAt({ ...element, animation: travel }, 1, 3).x)
      .toBeGreaterThan(element.x);
    const a = elementAt({ ...element, animation: travel }, 1, 3);
    const b = elementAt({ ...element, animation: travel }, 1, 3);
    expect(a).toEqual(b);
    expect(travel.keyframes.find(k => k.time === 1)?.joints?.torso?.angle)
      .toBeGreaterThan(1);
  });

  it("leaves non-workshop and incomplete historical rigs unchanged", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    for (const rig of [sunnyRig(), fullBodyWorkshopCharacter(true).puppet!]) {
      const snapshot = JSON.stringify(rig);
      const walk = presetAnimation(element, 3, "walk-in-place", 0, 3, rig);
      expect(walk.keyframes.every(frame =>
        frame.joints?.torso === undefined && frame.joints?.leftFoot === undefined &&
        frame.joints?.rightFoot === undefined)).toBe(true);
      expect(JSON.stringify(rig)).toBe(snapshot);
    }
  });
});
