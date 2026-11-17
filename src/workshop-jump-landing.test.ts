import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { sunnyRig, validJoints } from "./puppet-model";
import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { presetAnimation } from "./presets";
import { elementAt } from "./timeline";

describe("PR #151 real articulated workshop jump and gentle landing", () => {
  it("crouches, rises, bends both knees, then compresses into a stable landing", () => {
    const hero = newWorkshopPuppetStarter();
    const rig = hero.puppet!;
    const element = makeScene([hero]).elements[0];
    element.x = 210;
    element.y = 380;
    const source = JSON.stringify({ hero, element });
    const animation = presetAnimation(element, 3, "jump", 0, 3, rig);
    const at = (time: number) => animation.keyframes.find(k => k.time === time)!;
    expect(animation.keyframes.length).toBeGreaterThanOrEqual(13);
    expect(at(.25).y).toBeGreaterThan(element.y);
    expect(at(.25).joints!.leftShin?.angle).toBeGreaterThan(10);
    expect(at(.25).joints!.rightShin?.angle).toBeLessThan(-10);
    expect(at(1.5).y).toBeLessThan(element.y - 40);
    expect(Math.abs(at(1.5).joints!.leftArm?.angle ?? 0)).toBeGreaterThan(20);
    expect(Math.abs(at(1.5).joints!.rightForearm?.angle ?? 0)).toBeGreaterThan(10);
    expect(at(2.75).y).toBeGreaterThan(element.y);
    expect(at(2.75).joints!.leftShin?.angle).toBeGreaterThan(10);
    expect(at(0).y).toBe(element.y);
    expect(at(3).y).toBe(element.y);
    expect(Object.values(at(3).joints ?? {}).every(j => Math.abs(j.angle) < 1e-8)).toBe(true);
    expect(animation.keyframes.every(k => k.x === element.x)).toBe(true);
    for (const key of animation.keyframes)
      expect(validJoints(key.joints ?? {}, new Set(rig.parts.map(p => p.id)))).toBe(true);
    expect(elementAt({ ...element, animation }, 1.5, 3))
      .toEqual(elementAt({ ...element, animation }, 1.5, 3));
    expect(JSON.stringify({ hero, element })).toBe(source);
  });

  it("keeps existing simple and incomplete rig jumps exactly as before", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    element.y = 380;
    for (const rig of [sunnyRig(), fullBodyWorkshopCharacter(true).puppet!]) {
      const source = JSON.stringify(rig);
      const animation = presetAnimation(element, 3, "jump", 0, 3, rig);
      expect(animation.keyframes.length).toBe(3);
      expect(animation.keyframes.find(k => k.time === 1.5)!.y).toBe(348);
      expect(animation.keyframes.find(k => k.time === 0)!.y).toBe(380);
      expect(animation.keyframes.find(k => k.time === 3)!.y).toBe(380);
      expect(animation.keyframes.every(k =>
        k.joints?.leftShin === undefined && k.joints?.rightShin === undefined)).toBe(true);
      expect(JSON.stringify(rig)).toBe(source);
    }
  });

  it("does not change the existing wave and walk-in-place actions", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    const before = JSON.stringify(element);
    const wave = presetAnimation(element, 3, "wave", 0, 3, hero.puppet);
    const walk = presetAnimation(element, 3, "walk-in-place", 0, 3, hero.puppet);
    expect(wave.keyframes.every(k => k.x === element.x)).toBe(true);
    expect(walk.keyframes.every(k => k.x === element.x)).toBe(true);
    expect(JSON.stringify(element)).toBe(before);
  });
});
