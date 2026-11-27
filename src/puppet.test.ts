import "fake-indexeddb/auto";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { describe, expect, it } from "vitest";
import {
  mirrorPuppetCutout,
  newPart,
  neutralJoint,
  puppetTransforms,
  reparentPuppetPart,
  sunnyRig,
  validPuppet,
} from "./puppet-model";
import { actionsForPuppet, presetAnimation } from "./presets";
import {
  sunnyCartoon,
  sunnyLibraryItem,
  updateScenePuppet,
} from "./puppet-project";
import { validateLibraryItem, placeLibraryItem } from "./library";
import { parseBackup, validateProject } from "./model";
import { elementAt, keyAt } from "./timeline";
import { starterProject } from "./planner";
import { suggestDirection, directScene } from "./assistant";

const assets = new Set<string>();
describe("puppet rig, timeline and project snapshots", () => {
  it("validates picture-foot sole markers and mirrors their displayed horizontal position", () => {
    const rig = sunnyRig();
    const left = newPart("leftFoot", "left-foot", rig.parts.find(part => part.role === "leftLeg"));
    rig.parts.push({ ...left, assetId: "shoe", soleX: 0.2, soleY: 0.85 });
    const mirrored = mirrorPuppetCutout(rig, left.id, "right-foot")!;
    expect(mirrored.parts.find(part => part.id === "right-foot")).toMatchObject({
      role: "rightFoot", assetId: "shoe", soleX: 0.8, soleY: 0.85, flipX: true,
    });
    expect(validPuppet(mirrored, new Set(["shoe"]))).toBe(true);
    for (const changes of [{ soleY: undefined }, { soleX: -0.1 },
      { role: "leftHand" as const }, { assetId: undefined }]) {
      const invalid = { ...rig, parts: rig.parts.map(part => part.id === left.id
        ? { ...part, ...changes } : part) };
      expect(validPuppet(invalid, new Set(["shoe"]))).toBe(false);
    }
  });
  it("reparents a pictured part without moving its still artwork and then follows the new joint", () => {
    const rig = sunnyRig();
    const hand = { ...newPart("leftHand", "hand", rig.parts.find(part => part.role === "torso")),
      x: -68, y: 125, pivotX: 4, pivotY: -7, assetId: "painted-hand" };
    rig.parts.push(hand);
    const handIndex = rig.parts.indexOf(hand);
    const before = puppetTransforms(rig)[handIndex];
    const shoulder = rig.parts.find(part => part.role === "leftArm")!;
    const connected = reparentPuppetPart(rig, hand.id, shoulder.id)!;
    const after = puppetTransforms(connected)[handIndex];
    expect(connected.parts[handIndex].parentId).toBe(shoulder.id);
    expect(after.x - hand.pivotX).toBeCloseTo(before.x - hand.pivotX);
    expect(after.y - hand.pivotY).toBeCloseTo(before.y - hand.pivotY);
    expect(connected.poses).toBe(rig.poses);
    expect(validPuppet(connected, new Set(["painted-hand"]))).toBe(true);
    const waved = puppetTransforms(connected, { leftArm: { x: 0, y: 0, angle: 60 } });
    expect(waved[handIndex].x).not.toBeCloseTo(after.x);
    expect(waved[handIndex].angle).toBe(60);
    expect(puppetTransforms(rig, { leftArm: { x: 0, y: 0, angle: 60 } })[handIndex]).toEqual(before);
    const detached = reparentPuppetPart(connected, hand.id)!;
    expect(puppetTransforms(detached)[handIndex].y).toBeCloseTo(before.y);
    expect(reparentPuppetPart(connected, shoulder.id, hand.id)).toBeUndefined();
    expect(reparentPuppetPart(connected, hand.id, "missing")).toBeUndefined();
  });
  it("mirrors an existing cutout into an independently articulated opposite limb", () => {
    const rig = sunnyRig();
    const left = rig.parts.find(part => part.role === "leftArm")!;
    const right = rig.parts.find(part => part.role === "rightArm")!;
    left.assetId = "original-arm";
    left.x = -50;
    left.pivotX = 7;
    left.flipX = true;
    const mirrored = mirrorPuppetCutout(rig, left.id, "unused")!;
    expect(mirrored.parts.find(part => part.role === "rightArm")).toMatchObject({
      id: right.id, parentId: "torso", x: 50, pivotX: -7,
      assetId: "original-arm", flipX: false,
    });
    expect(mirrored.poses).toBe(rig.poses);
    expect(mirrored.parts.find(part => part.role === "leftArm")).toBe(left);
    expect(validPuppet(mirrored, new Set(["original-arm"]))).toBe(true);
    const moved = puppetTransforms(mirrored, { rightArm: { x: 0, y: 0, angle: 45 } });
    expect(moved[mirrored.parts.indexOf(left)].angle).toBe(0);
    expect(moved[mirrored.parts.findIndex(part => part.role === "rightArm")].angle).toBe(45);
    expect(mirrorPuppetCutout(mirrored, left.id, "another")).toBeUndefined();
    expect(validPuppet({ ...mirrored, parts: mirrored.parts.map(part =>
      part.role === "rightArm" ? { ...part, flipX: "yes" } : part) },
    new Set(["original-arm"]))).toBe(false);
  });

  it("creates a missing opposite part only when its mirrored parent exists", () => {
    const left = { ...newPart("leftShin", "shin", newPart("leftLeg", "leg")),
      x: -12, assetId: "shin-image" };
    const leftLeg = newPart("leftLeg", "leg");
    const torso = newPart("torso", "torso");
    const withoutParent = { ...sunnyRig(), parts: [torso, leftLeg, left], poses: [] };
    expect(mirrorPuppetCutout(withoutParent, left.id, "other-shin")).toBeUndefined();
    const rightLeg = newPart("rightLeg", "other-leg");
    const rig = { ...withoutParent, parts: [...withoutParent.parts, rightLeg] };
    const result = mirrorPuppetCutout(rig, left.id, "other-shin")!;
    expect(result.parts.find(part => part.id === "other-shin")).toMatchObject({
      role: "rightShin", parentId: rightLeg.id, x: 12,
      assetId: "shin-image", flipX: true,
    });
    expect(validPuppet(result, new Set(["shin-image"]))).toBe(true);
    expect(rig.parts).toHaveLength(4);
  });
  it("rejects cycles, duplicate IDs, missing parent and asset references, and invalid poses", () => {
    const rig = sunnyRig();
    expect(validPuppet(rig, assets)).toBe(true);
    const head = rig.parts.find((p) => p.role === "head")!;
    head.parentId = head.id;
    expect(validPuppet(rig, assets)).toBe(false);
    head.parentId = "missing";
    expect(validPuppet(rig, assets)).toBe(false);
    head.parentId = "torso";
    head.assetId = "not-local";
    expect(validPuppet(rig, assets)).toBe(false);
    expect(validPuppet(rig, new Set(["not-local"]))).toBe(true);
    delete head.assetId;
    rig.parts.push({ ...head });
    expect(validPuppet(rig, assets)).toBe(false);
    rig.parts.pop();
    rig.poses[0].joints = { head: { x: 0, y: 0, angle: Infinity } };
    expect(validPuppet(rig, assets)).toBe(false);
  });

  it("rotates children around the parent joint in original paint order", () => {
    const torso = { ...newPart("torso", "torso"), x: 8, y: 12 };
    const child = { ...newPart("head", "head", torso), x: 20, y: 0 };
    const rig = { ...sunnyRig(), poses: [], parts: [child, torso] };
    const [head, root] = puppetTransforms(rig, {
      torso: { ...neutralJoint, angle: 90 },
    });
    expect(root).toEqual({ x: 8, y: 12, angle: 90 });
    expect(head.x).toBeCloseTo(8);
    expect(head.y).toBeCloseTo(32);
    expect(head.angle).toBe(90);
  });

  it("samples joints and expressions deterministically and keeps a copied pose after its library pose is removed", () => {
    const project = sunnyCartoon(),
      scene = project.scenes[1];
    const actor = scene.elements[1];
    const rig = project.characters.find(
      (c) => c.id === actor.characterId,
    )!.puppet!;
    const pose = rig.poses.find((p) => p.id === "waving")!;
    actor.animation!.keyframes = [
      { ...keyAt(actor, 0, 5), time: 0, joints: {} },
      {
        ...keyAt(actor, 1, 5),
        time: 1,
        joints: pose.joints,
        emotion: "sad",
        mouth: "open",
        easing: "linear",
      },
    ];
    rig.poses = rig.poses.filter((p) => p.id !== pose.id);
    expect(
      validateProject(project).scenes[1].elements[1].animation?.keyframes[1]
        .joints,
    ).toEqual(pose.joints);
    const middle = elementAt(actor, 0.5, 5);
    expect(middle.joints?.rightArm.angle).toBe(-62.5);
    expect(elementAt(actor, 0.5, 5)).toEqual(middle);
    expect(elementAt(actor, 1, 5)).toMatchObject({
      emotion: "sad",
      mouth: "open",
    });
    expect(keyAt(actor, 0.5, 5).joints).toEqual(middle.joints);
    actor.animation!.keyframes[1].joints!.rightArm.angle = 181;
    expect(() => validateProject(project)).toThrow();
  });

  it("makes whole-image fallback explicit and preserves the original when reused or updated", () => {
    const item = sunnyLibraryItem();
    expect(validateLibraryItem(item)).toEqual(item);
    const first = placeLibraryItem(starterProject(), 0, item);
    const second = placeLibraryItem(starterProject(), 0, item);
    const firstElement = first.scenes[0].elements.at(-1)!;
    item.character!.puppet!.parts.find((p) => p.id === "head")!.pivotY = 18;
    const updated = updateScenePuppet(first, 0, firstElement.id, item);
    expect(updated.scenes[0].elements.at(-1)?.id).toBe(firstElement.id);
    expect(
      updated.characters
        .find((c) => c.id === updated.scenes[0].elements.at(-1)?.characterId)
        ?.puppet?.parts.find((p) => p.id === "head")?.pivotY,
    ).toBe(18);
    expect(
      second.characters.at(-1)?.puppet?.parts.find((p) => p.id === "head")
        ?.pivotY,
    ).not.toBe(18);
    const rig = {
      ...sunnyRig(),
      parts: [newPart("torso", "torso")],
      poses: [],
    };
    expect(actionsForPuppet(rig).map(([id]) => id)).not.toContain("wave");
    const walk = presetAnimation(firstElement, 5, "walk", 0, 3, rig);
    expect(walk.keyframes.at(-1)?.x).not.toBe(firstElement.x);
    expect(
      walk.keyframes.every((k) => !Object.keys(k.joints ?? {}).length),
    ).toBe(true);
  });

  it("imports schema 4 with puppet snapshots and retains older scene behavior", () => {
    const puppet = sunnyCartoon();
    expect(
      parseBackup(JSON.stringify(puppet)).characters.at(-1)?.puppet,
    ).toBeTruthy();
    const legacy = starterProject();
    expect(parseBackup(JSON.stringify(legacy)).scenes).toEqual(legacy.scenes);
    expect(
      elementAt(legacy.scenes[0].elements[0], 0.5, 5).joints,
    ).toBeUndefined();
    const scene = {
      ...puppet.scenes[1],
      narration: "Sunny waves hello to a friend.",
      elements: [puppet.scenes[1].elements[1]],
    };
    const suggestion = suggestDirection(puppet, scene);
    expect(suggestion.action).toBe("wave");
    expect(
      directScene(
        puppet,
        scene,
        suggestion,
        false,
      ).elements[0].animation?.keyframes.some((k) => k.joints?.rightArm?.angle),
    ).toBe(true);
  });
});

it("restores puppet part images and joints from a complete episode package", async () => {
  const project = sunnyCartoon();
  const art = {
    id: "sunny-head-original",
    name: "Sunny head",
    type: "image" as const,
    mime: "image/png" as const,
    dataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=",
  };
  project.assets.push(art);
  project.characters
    .at(-1)!
    .puppet!.parts.find((part) => part.id === "head")!.assetId = art.id;
  const packed = await episodePackage(project);
  const restored = await restoreProjectFile(
    new File([packed], "sunny.ctepisode"),
  );
  expect(restored.id).not.toBe(project.id);
  expect(restored.characters).toEqual(project.characters);
  expect(restored.assets).toEqual(project.assets);
  expect(restored.scenes).toEqual(project.scenes);
});
