import "fake-indexeddb/auto";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { describe, expect, it } from "vitest";
import {
  newPart,
  neutralJoint,
  puppetTransforms,
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
