import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { sunnyRig, validJoints } from "./puppet-model";
import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { presetAnimation } from "./presets";
import { elementAt } from "./timeline";

describe("PR #153 complete workshop full-body dance", () => {
  it("alternates knees while shoulders, elbows, hands and torso keep the beat", () => {
    const hero = newWorkshopPuppetStarter();
    const rig = hero.puppet!;
    const element = makeScene([hero]).elements[0];
    element.x = 215;
    element.y = 385;
    const before = JSON.stringify({ hero, element });
    const animation = presetAnimation(element, 3, "dance", 0, 3, rig);
    const at = (time: number) => animation.keyframes.find(k => k.time === time)!;

    expect(animation.keyframes).toHaveLength(13);
    expect(at(.5).joints!.rightShin!.angle).toBeLessThan(-5);
    expect(at(.5).joints!.leftShin).toBeUndefined();
    expect(at(1).joints!.leftShin!.angle).toBeGreaterThan(10);
    expect(at(1).joints!.rightShin).toBeUndefined();
    expect(at(.5).joints!.rightArm!.angle).toBeLessThan(-10);
    expect(at(.5).joints!.leftArm!.angle).toBeGreaterThan(10);
    expect(at(.5).joints!.rightForearm!.angle).toBeGreaterThan(5);
    expect(at(.5).joints!.leftForearm!.angle).toBeLessThan(-5);
    expect(at(.5).joints!.rightHand!.angle).toBeLessThan(-3);
    expect(at(.5).joints!.leftHand!.angle).toBeGreaterThan(3);
    expect(at(.75).joints!.torso!.angle).toBeGreaterThan(1);
    expect(at(2.25).joints!.torso!.angle).toBeLessThan(-1);
    expect(at(.75).joints!.head!.angle).toBeLessThan(-1);
    expect(at(2.25).joints!.head!.angle).toBeGreaterThan(1);
    expect(at(1.5).y).toBeLessThan(element.y - 6);
    expect(at(.75).rotation).toBeGreaterThan(element.rotation);
    expect(at(2.25).rotation).toBeLessThan(element.rotation);
    expect(animation.keyframes.every(k => k.x === element.x)).toBe(true);
    for (const frame of animation.keyframes) {
      expect(validJoints(frame.joints ?? {}, new Set(rig.parts.map(p => p.id)))).toBe(true);
    }
    expect(elementAt({ ...element, animation }, 1.25, 3))
      .toEqual(elementAt({ ...element, animation }, 1.25, 3));
    expect(JSON.stringify({ hero, element })).toBe(before);
  });

  it("returns exactly to the original ground position and joint angles", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    const animation = presetAnimation(element, 3, "dance", 0, 3, hero.puppet);
    for (const time of [0, 3]) {
      const key = animation.keyframes.find(k => k.time === time)!;
      expect(key.x).toBe(element.x);
      expect(key.y).toBeCloseTo(element.y, 8);
      expect(key.rotation).toBeCloseTo(element.rotation, 8);
      expect(Object.values(key.joints ?? {}).every(j => Math.abs(j.angle) < 1e-8)).toBe(true);
    }
  });

  it("does not alter legacy nine-frame dance or unrelated action presets", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    for (const rig of [sunnyRig(), fullBodyWorkshopCharacter(true).puppet!]) {
      const snapshot = JSON.stringify(rig);
      const dance = presetAnimation(element, 3, "dance", 0, 3, rig);
      expect(dance.keyframes).toHaveLength(9);
      const firstBeat = dance.keyframes.find(k => k.time === .375)!;
      expect(firstBeat.y).toBe(element.y - 8);
      expect(firstBeat.rotation).toBe(element.rotation - 8);
      expect(dance.keyframes.every(k =>
        k.joints?.leftShin === undefined && k.joints?.rightShin === undefined &&
        k.joints?.leftForearm === undefined && k.joints?.rightForearm === undefined)).toBe(true);
      expect(JSON.stringify(rig)).toBe(snapshot);
    }
    const jump = presetAnimation(element, 3, "jump", 0, 3, hero.puppet);
    const wave = presetAnimation(element, 3, "wave", 0, 3, hero.puppet);
    expect(jump.keyframes).toHaveLength(13);
    expect(wave.keyframes.at(-1)?.time).toBe(3);
  });
});
