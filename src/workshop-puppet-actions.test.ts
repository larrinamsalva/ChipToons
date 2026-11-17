import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { validJoints, sunnyRig } from "./puppet-model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { presetAnimation } from "./presets";
import { elementAt } from "./timeline";

const at = (action: "walk-in-place" | "walk" | "point" | "wave", time: number) => {
  const character = newWorkshopPuppetStarter();
  const element = makeScene([character]).elements[0];
  const animation = presetAnimation(element, 3, action, 0, 3, character.puppet);
  const frame = elementAt({ ...element, animation }, time, 3);
  return { character, element, animation, frame };
};

describe("PR #148 articulated workshop walk and reach keyframes", () => {
  it("alternates actual left/right knee-shin and ankle poses during a real walk", () => {
    const { character, element, animation } = at("walk-in-place", .5);
    const source = JSON.stringify(element);
    const keys = animation.keyframes;
    expect(keys.length).toBeGreaterThanOrEqual(13);
    const first = keys.find(k => k.time === .5)!;
    const second = keys.find(k => k.time === 1.25)!;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    const a = first.joints!, b = second.joints!;
    expect(a.rightShin?.angle ?? 0).toBeGreaterThan(4);
    expect(a.leftShin?.angle ?? 0).toBe(0);
    expect(b.leftShin?.angle ?? 0).toBeGreaterThan(4);
    expect(b.rightShin?.angle ?? 0).toBe(0);
    expect(Math.abs(a.rightFoot?.angle ?? 0)).toBeGreaterThan(2);
    expect(Math.abs(b.leftFoot?.angle ?? 0)).toBeGreaterThan(2);
    expect(Math.abs(a.rightForearm?.angle ?? 0)).toBeGreaterThan(2);
    expect(Math.abs(a.leftForearm?.angle ?? 0)).toBeGreaterThan(2);
    for(const k of keys)
      expect(validJoints(k.joints ?? {}, new Set(character.puppet!.parts.map(p => p.id))))
        .toBe(true);
    expect(JSON.stringify(element)).toBe(source);
    const repeated = elementAt({ ...element, animation }, .5, 3);
    expect(repeated).toEqual(elementAt({ ...element, animation }, .5, 3));
    expect(repeated.x).toBe(element.x);
  });

  it("makes the elbow and hand bend on reaching and waving, with safe neutral endpoints", () => {
    const point = at("point", 1.5);
    const reach = point.frame.joints!;
    expect(reach.rightArm?.angle ?? 0).toBeLessThan(-50);
    expect(reach.rightForearm?.angle ?? 0).toBeLessThan(-15);
    expect(reach.rightHand?.angle ?? 0).toBeLessThan(-5);
    const neutral = at("point", 0);
    expect(neutral.frame.joints?.rightForearm?.angle ?? 0).toBe(0);
    const finish = at("point", 3);
    expect(finish.frame.joints?.rightForearm?.angle ?? 0).toBeCloseTo(0, 8);
    const wave = at("wave", 1.25);
    expect(Math.abs(wave.frame.joints?.rightForearm?.angle ?? 0)).toBeGreaterThan(10);
    const walk = at("walk", .5);
    expect(Math.abs(walk.frame.joints?.rightShin?.angle ?? 0)).toBeGreaterThan(4);
    expect(walk.frame.x).not.toBe(walk.element.x);
  });

  it("preserves older simple and incomplete puppet action presets", () => {
    const starter = newWorkshopPuppetStarter();
    const normal = sunnyRig();
    const before = JSON.stringify(normal);
    const element = makeScene([starter]).elements[0];
    const animated = presetAnimation(element, 3, "walk-in-place", 0, 3, normal);
    expect(animated.keyframes.every(k =>
      k.joints?.leftShin === undefined && k.joints?.rightShin === undefined &&
      k.joints?.leftForearm === undefined && k.joints?.rightForearm === undefined)).toBe(true);
    const legacyWorkshop = fullBodyWorkshopCharacter();
    const legacy = presetAnimation(element, 3, "walk-in-place", 0, 3, legacyWorkshop.puppet);
    expect(legacy.keyframes.every(k => k.joints?.leftShin === undefined &&
      k.joints?.rightShin === undefined)).toBe(true);
    expect(JSON.stringify(normal)).toBe(before);
  });
});
