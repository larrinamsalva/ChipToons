import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { sunnyRig, validJoints } from "./puppet-model";
import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { presetAnimation } from "./presets";
import { elementAt } from "./timeline";

describe("PR #152 articulated workshop victory celebration", () => {
  it("animates shoulders, elbows, hands, knees and bounce without moving stage x", () => {
    const hero = newWorkshopPuppetStarter();
    const rig = hero.puppet!;
    const element = makeScene([hero]).elements[0];
    element.x = 220;
    element.y = 380;
    const source = JSON.stringify({ hero, element });
    const animation = presetAnimation(element, 3, "celebrate", 0, 3, rig);
    const at = (time: number) => animation.keyframes.find(frame => frame.time === time)!;
    expect(animation.keyframes.length).toBeGreaterThanOrEqual(13);
    expect(at(1.5).joints!.rightArm!.angle).toBeLessThan(-70);
    expect(at(1.5).joints!.leftArm!.angle).toBeGreaterThan(70);
    expect(at(1.5).joints!.rightForearm!.angle).toBeGreaterThan(20);
    expect(at(1.5).joints!.leftForearm!.angle).toBeLessThan(-20);
    expect(at(1.5).joints!.rightHand!.angle).toBeLessThan(-10);
    expect(at(1.5).joints!.leftHand!.angle).toBeGreaterThan(10);
    expect(at(1.5).joints!.leftShin!.angle).toBeGreaterThan(10);
    expect(at(1.5).joints!.rightShin!.angle).toBeLessThan(-10);
    expect(at(1.5).y).toBeLessThan(element.y - 10);
    expect(at(.75).joints!.torso!.angle).toBeGreaterThan(1);
    expect(at(2.25).joints!.torso!.angle).toBeLessThan(-1);
    expect(animation.keyframes.every(frame => frame.x === element.x)).toBe(true);
    for (const frame of animation.keyframes)
      expect(validJoints(frame.joints ?? {}, new Set(rig.parts.map(part => part.id)))).toBe(true);
    expect(elementAt({ ...element, animation }, .75, 3))
      .toEqual(elementAt({ ...element, animation }, .75, 3));
    expect(JSON.stringify({ hero, element })).toBe(source);
  });

  it("returns exactly to the original standing position and neutral joints", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    const animation = presetAnimation(element, 3, "celebrate", 0, 3, hero.puppet);
    for (const time of [0, 3]) {
      const frame = animation.keyframes.find(key => key.time === time)!;
      expect(frame.y).toBe(element.y);
      expect(Object.values(frame.joints ?? {}).every(j => Math.abs(j.angle) < 1e-8)).toBe(true);
    }
    const mid = animation.keyframes.find(frame => frame.time === 1.5)!;
    expect(mid.emotion).toBe("excited");
  });

  it("preserves older Sunny and incomplete workshop celebration keyframes", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    for (const rig of [sunnyRig(), fullBodyWorkshopCharacter(true).puppet!]) {
      const before = JSON.stringify(rig);
      const animation = presetAnimation(element, 3, "celebrate", 0, 3, rig);
      expect(animation.keyframes).toHaveLength(3);
      const mid = animation.keyframes.find(frame => frame.time === 1.5)!;
      expect(mid.y).toBe(element.y - 32);
      expect(mid.joints?.rightArm?.angle).toBeLessThan(-100);
      expect(mid.joints?.leftForearm).toBeUndefined();
      expect(mid.joints?.rightShin).toBeUndefined();
      expect(JSON.stringify(rig)).toBe(before);
    }
  });
});
