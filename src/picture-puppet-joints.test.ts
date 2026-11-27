import { describe, expect, it } from "vitest";
import { picturePuppet } from "./picture-studio";
import type { PreparedPart } from "./picture-studio";
import { puppetTransforms, validPuppet } from "./puppet-model";
import { presetAnimation } from "./presets";
import { makeScene } from "./model";

const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=";
function cutout(role: PreparedPart["role"], x: number, y: number,
  width: number, height: number): PreparedPart {
  return { role, cutout: {
    asset: { id: `art-${role}`, name: role, type: "image", mime: "image/png", dataUrl: pixel },
    center: { x, y }, width, height,
  } };
}

describe("picture cutouts as articulated puppets", () => {
  it("connects arms, forearms, hands, legs, shins and feet without shifting the original picture", () => {
    // Deliberately trace children before parents: authoring order must not
    // decide the skeleton or silently move already prepared artwork.
    const prepared = [
      cutout("leftHand", 7, 181, 12, 18), cutout("leftForearm", 13, 148, 18, 42),
      cutout("leftFoot", 32, 256, 29, 17), cutout("leftShin", 33, 227, 20, 45),
      cutout("head", 50, 40, 46, 46), cutout("leftArm", 18, 105, 22, 60),
      cutout("leftLeg", 36, 177, 28, 72), cutout("torso", 50, 100, 100, 100),
    ];
    const item = picturePuppet("Original figure", prepared);
    const rig = item.character!.puppet!;
    expect(validPuppet(rig, new Set(item.assets.map(asset => asset.id)))).toBe(true);
    expect(Object.fromEntries(rig.parts.map(part => [part.role, part.parentId]))).toMatchObject({
      leftHand: "leftForearm", leftForearm: "leftArm", leftFoot: "leftShin",
      leftShin: "leftLeg", leftArm: "torso", leftLeg: "torso", head: "torso",
    });
    const neutral = puppetTransforms(rig);
    for (const original of prepared) {
      const partIndex = rig.parts.findIndex(part => part.role === original.role);
      const part = rig.parts[partIndex], joint = neutral[partIndex];
      expect(joint.x - part.pivotX).toBeCloseTo((original.cutout.center.x - 50) * 1.2);
      expect(joint.y - part.pivotY).toBeCloseTo((original.cutout.center.y - 100) * 1.2 - 100);
    }
    expect(rig.parts.find(part => part.role === "leftForearm")!.pivotY).toBeLessThan(0);
    const posed = puppetTransforms(rig, {
      leftForearm: { x: 0, y: 0, angle: 45 }, leftShin: { x: 0, y: 0, angle: -35 },
    });
    const byRole = (role: PreparedPart["role"]) => posed[rig.parts.findIndex(part => part.role === role)];
    expect(byRole("leftArm")).toEqual(neutral[rig.parts.findIndex(part => part.role === "leftArm")]);
    expect(byRole("leftHand").angle).toBe(45);
    expect(byRole("leftFoot").angle).toBe(-35);
    expect(byRole("leftHand").x).not.toBeCloseTo(neutral[rig.parts.findIndex(part => part.role === "leftHand")].x);
  });

  it("keeps a usable body fallback and samples animated joint data for a traced figure", () => {
    const item = picturePuppet("One leg", [
      cutout("leftFoot", 20, 190, 24, 18),
      cutout("torso", 50, 100, 100, 100),
      cutout("leftLeg", 25, 153, 25, 70),
    ]);
    const rig = item.character!.puppet!;
    expect(rig.parts.find(part => part.role === "leftFoot")?.parentId).toBe("leftLeg");
    const noLeg = picturePuppet("No leg yet", [
      cutout("leftFoot", 20, 190, 24, 18), cutout("torso", 50, 100, 100, 100),
    ]);
    expect(noLeg.character!.puppet!.parts.find(part => part.role === "leftFoot")?.parentId).toBe("torso");
    const element = makeScene([item.character!]).elements[0];
    const walk = presetAnimation(element, 5, "walk", 0, 3, rig);
    expect(walk.keyframes.some(frame => frame.joints?.leftLeg?.angle)).toBe(true);
  });
});
