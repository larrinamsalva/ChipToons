import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { sunnyRig } from "./puppet-model";
import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { presetAnimation } from "./presets";
import { elementAt } from "./timeline";

describe("PR #150 natural full-workshop walk arrivals", () => {
  it("smoothly accelerates and settles without changing the walk destination", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    element.x = 180;
    element.y = 370;
    const before = JSON.stringify({ element, hero });
    const animation = presetAnimation(element, 3, "walk", 0, 3, hero.puppet);
    const at = (t: number) => animation.keyframes.find(frame => frame.time === t)!;
    const destination = 720;
    // Linear motion would travel 1/12 of the path in the first 0.25 sec.
    expect(at(.25).x).toBeGreaterThan(element.x);
    expect(at(.25).x).toBeLessThan(element.x + (destination - element.x) / 12);
    expect(at(2.75).x).toBeGreaterThan(element.x + (destination - element.x) * 11 / 12);
    expect(at(3).x).toBe(destination);
    // Smooth feet/body bob: no instantaneous 5px first-step jump.
    expect(at(.25).y).toBeLessThan(element.y);
    expect(at(.25).y).toBeGreaterThan(element.y - 5);
    expect(at(0).y).toBe(element.y);
    expect(at(3).y).toBe(element.y);
    expect(at(3).gesture).toBe("none");
    expect(animation.keyframes.length).toBeGreaterThanOrEqual(13);
    const frame = elementAt({ ...element, animation }, .75, 3);
    expect(frame).toEqual(elementAt({ ...element, animation }, .75, 3));
    expect(JSON.stringify({ element, hero })).toBe(before);
  });

  it("leaves incomplete workshop and historical Sunny walks unchanged", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    element.x = 180;
    element.y = 370;
    for (const rig of [sunnyRig(), fullBodyWorkshopCharacter(true).puppet!]) {
      const source = JSON.stringify(rig);
      const animation = presetAnimation(element, 3, "walk", 0, 3, rig);
      const early = animation.keyframes.find(frame => frame.time === .25)!;
      expect(early.x).toBe(180 + (720 - 180) / 12);
      expect(early.y).toBe(365);
      expect(animation.keyframes.find(frame => frame.time === 3)!.x).toBe(720);
      expect(JSON.stringify(rig)).toBe(source);
    }
  });

  it("preserves walk-in-place stage position, other actions, and saved source", () => {
    const hero = newWorkshopPuppetStarter();
    const element = makeScene([hero]).elements[0];
    element.x = 180;
    const before = JSON.stringify(element);
    const place = presetAnimation(element, 3, "walk-in-place", 0, 3, hero.puppet);
    expect(place.keyframes.every(frame => frame.x === element.x)).toBe(true);
    const reach = presetAnimation(element, 3, "point", 0, 3, hero.puppet);
    expect(reach.keyframes.every(frame => frame.x === element.x)).toBe(true);
    expect(JSON.stringify(element)).toBe(before);
  });
});
