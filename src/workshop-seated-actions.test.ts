import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { puppetTransforms, sunnyRig, validJoints } from "./puppet-model";
import type { PuppetRig, JointSnapshot } from "./puppet-model";
import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { presetAnimation } from "./presets";
import { elementAt } from "./timeline";

function footAngle(rig: PuppetRig, joints: JointSnapshot, role: string): number {
  const index = rig.parts.findIndex(part => part.role === role);
  if (index < 0) throw new Error("Missing " + role);
  return puppetTransforms(rig, joints)[index].angle;
}

describe("PR #154 articulated workshop Sit Down / Stand Up", () => {
  it("uses intermediate knee, shin, boot, arm and torso keys for sitting", () => {
    const hero = newWorkshopPuppetStarter();
    const rig = hero.puppet!;
    const element = makeScene([hero]).elements[0];
    element.x = 201;
    element.y = 380;
    const original = JSON.stringify({ element, hero });
    const sitting = presetAnimation(element, 3, "sit", 0, 3, rig);
    const at = (time: number) => sitting.keyframes.find(k => k.time === time)!;
    expect(sitting.keyframes).toHaveLength(13);
    expect(at(0).y).toBe(element.y);
    expect(at(3).y).toBe(element.y + 20);
    expect(at(1.5).y).toBeCloseTo(element.y + 10, 8);
    expect(at(1.5).joints!.leftLeg!.angle).toBeLessThan(-20);
    expect(at(1.5).joints!.rightLeg!.angle).toBeLessThan(-20);
    expect(at(1.5).joints!.leftShin!.angle).toBeGreaterThan(25);
    expect(at(1.5).joints!.rightShin!.angle).toBeGreaterThan(25);
    expect(at(1.5).joints!.torso!.angle).toBeGreaterThan(3);
    expect(at(1.5).joints!.head!.angle).toBeLessThan(-2);
    expect(at(1.5).joints!.rightForearm!.angle).toBeLessThan(-10);
    expect(at(1.5).joints!.leftHand!.angle).toBeLessThan(-2);
    expect(at(3).pose).toBe("sitting");
    expect(Math.abs(footAngle(rig, at(3).joints!, "leftFoot"))).toBeLessThan(1e-8);
    expect(Math.abs(footAngle(rig, at(3).joints!, "rightFoot"))).toBeLessThan(1e-8);
    for (const k of sitting.keyframes) {
      expect(k.x).toBe(element.x);
      expect(validJoints(k.joints ?? {}, new Set(rig.parts.map(p => p.id)))).toBe(true);
    }
    expect(elementAt({ ...element, animation: sitting }, 1.25, 3))
      .toEqual(elementAt({ ...element, animation: sitting }, 1.25, 3));
    expect(JSON.stringify({ element, hero })).toBe(original);
  });

  it("reverses the seated pose into the same original standing pose", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    const sit = presetAnimation(element, 3, "sit", 0, 3, hero.puppet);
    const stand = presetAnimation(element, 3, "stand", 0, 3, hero.puppet);
    const firstSit = sit.keyframes.find(k => k.time === 0)!;
    const lastSit = sit.keyframes.find(k => k.time === 3)!;
    const firstStand = stand.keyframes.find(k => k.time === 0)!;
    const lastStand = stand.keyframes.find(k => k.time === 3)!;
    expect(stand.keyframes).toHaveLength(13);
    expect(firstStand.joints).toEqual(lastSit.joints);
    expect(firstStand.y).toBe(lastSit.y);
    expect(firstStand.pose).toBe("sitting");
    expect(lastStand.joints).toEqual(firstSit.joints);
    expect(lastStand.y).toBe(firstSit.y);
    expect(lastStand.pose).toBe("standing");
    expect(stand.keyframes.every(k => k.x === element.x)).toBe(true);
    expect(stand.keyframes.find(k => k.time === 1.5)!.y)
      .toBeCloseTo(element.y + 10, 8);
  });

  it("preserves existing simple and incomplete workshop action behavior", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    for (const rig of [sunnyRig(), fullBodyWorkshopCharacter(true).puppet!]) {
      const before = JSON.stringify(rig);
      for (const action of ["sit", "stand"] as const) {
        const animation = presetAnimation(element, 3, action, 0, 3, rig);
        expect(animation.keyframes).toHaveLength(13);
        expect(animation.keyframes.every(k =>
          k.joints?.leftShin === undefined && k.joints?.rightShin === undefined &&
          k.joints?.leftForearm === undefined && k.joints?.rightForearm === undefined))
          .toBe(true);
        const mid = animation.keyframes.find(k => k.time === 1.5)!;
        expect(mid.joints?.rightLeg?.angle).toBeCloseTo(27.5, 8);
        expect(mid.joints?.leftLeg?.angle).toBeCloseTo(-27.5, 8);
      }
      expect(JSON.stringify(rig)).toBe(before);
    }
  });
});
