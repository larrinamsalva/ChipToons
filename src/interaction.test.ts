import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";
import { episodePackage, restoreProjectFile, verifyBackupFile } from "./episode-package";
import { gardenInteractionDemo } from "./garden-demo";
import { interactionIssue, storyObject } from "./interaction-model";
import { handAt, interactionPaintOrder, stagePoint } from "./interaction-motion";
import { interactionSuggestion } from "./interaction-studio";
import { clone, parseBackup, uid, validateProject } from "./model";
import { starterProject } from "./planner";
import { newPart, puppetTransforms, sunnyRig } from "./puppet-model";
import { cleanSceneReferences, duplicateAnimatedScene, duplicateElement, elementAt, retimeScene, sceneFramesAt } from "./timeline";

function sampleGarden() {
  const project = gardenInteractionDemo();
  const scene = project.scenes[0];
  const action = scene.interactions![0];
  const can = scene.elements.find(item => item.id === action.objectId)!;
  const hero = scene.elements.find(item => item.id === action.actorId)!;
  const friend = scene.elements.find(item => item.characterId === project.characters[1].id)!;
  return { project, scene, action, can, hero, friend };
}

describe("scene interactions", () => {
  test("uses actual animated puppet anchors, tilts, waters and holds the release position when seeking", () => {
    const { project, scene, action, can, hero } = sampleGarden();
    const sample = (time: number) => sceneFramesAt(project, scene, time);
    const original = sample(0.4).get(can.id)!;
    expect(original).toMatchObject({ x: can.x, y: can.y });
    const held = sample(4.4).get(can.id)!;
    expect(held.heldBy).toBe(hero.id);
    expect(held.x).toBeLessThan(original.x - 160);
    expect(sample(6.2).get(can.id)?.watering).toBeDefined();
    expect(sample(6.2).get(can.id)!.rotation).toBeLessThan(-40);
    expect(sample(9).get(can.id)).toMatchObject({ ...action.release!.position, heldBy: undefined });
    expect(sample(4.4).get(can.id)).toEqual(held);
    const heroFrame = sample(4.4).get(hero.id)!;
    expect(held).toMatchObject(handAt(project.characters[0], hero, heroFrame, action.grip));
    expect(sample(5).get(can.id)!.x).toBeLessThan(held.x - 30);
  });

  test("converts nested hand joints into world space through pivot, scale, rotation and both flips", () => {
    const { project, hero } = sampleGarden();
    const rig = sunnyRig();
    const arm = rig.parts.find(part => part.role === "rightArm")!;
    const forearm = newPart("rightForearm", "fore", arm);
    const hand = { ...newPart("rightHand", "palm", forearm), pivotX: 4, pivotY: -8 };
    rig.parts.unshift(hand, forearm);
    const actor = { ...hero, flip: true, flipY: true, x: 380, y: 320, rotation: 90, scale: 2, animation: undefined };
    const frame = { ...elementAt(actor, 0, 10), joints: { torso: { x: 5, y: 4, angle: 30 }, rightArm: { x: 1, y: 2, angle: 60 } } };
    const joint = puppetTransforms(rig, frame.joints)[0];
    expect(joint.angle).toBe(90);
    expect(handAt({ ...project.characters[0], puppet: rig }, actor, frame, { hand: "right", x: 3, y: 2 }))
      .toEqual(stagePoint(actor, frame, { x: joint.x - 5, y: joint.y - 2 }));
    expect(stagePoint(actor, frame, { x: 0, y: 10 })).toEqual({ x: 400, y: 320 });
  });

  test("hands off one object, preserves its layer after release and remaps copies", () => {
    const { project, scene, action, can, hero, friend } = sampleGarden();
    const transfer = { actorId: friend.id, time: 4.6, grip: { hand: "left" as const, x: 3, y: 8 } };
    scene.interactions = [{ ...action, kind: "give", transfer }];
    scene.elements = [can, ...scene.elements.filter(item => item !== can)];
    const before = sceneFramesAt(project, scene, transfer.time - 0.01);
    const after = sceneFramesAt(project, scene, transfer.time);
    expect(before.get(can.id)?.heldBy).toBe(hero.id);
    expect(after.get(can.id)?.heldBy).toBe(friend.id);
    expect(after.get(can.id)).toMatchObject(handAt(project.characters[1], friend, after.get(friend.id)!, transfer.grip));
    const order = interactionPaintOrder(scene.elements, after);
    expect(order.filter(item => item.id === can.id)).toHaveLength(1);
    expect(order.indexOf(can)).toBeGreaterThan(order.indexOf(friend));
    expect(interactionPaintOrder(scene.elements, sceneFramesAt(project, scene, 9))).toEqual(scene.elements);
    const cloneScene = duplicateAnimatedScene(scene);
    expect(cloneScene.interactions![0]).toMatchObject({
      actorId: cloneScene.elements[scene.elements.indexOf(hero)].id, objectId: cloneScene.elements[0].id,
      transfer: { actorId: cloneScene.elements[scene.elements.indexOf(friend)].id },
    });
    expect(cloneScene.interactions![0].id).not.toBe(action.id);
    expect(validateProject({ ...project, scenes: [cloneScene, scene] })).toBeTruthy();
    const cloneObject = duplicateElement(can);
    expect(sceneFramesAt(project, { ...scene, elements: [...scene.elements, cloneObject] }, 5)
      .get(cloneObject.id)?.heldBy).toBeUndefined();
  });

  test("starts later interactions at the released position and points without moving the object", () => {
    const { project, scene, action, can, friend } = sampleGarden();
    const point = { ...action, id: uid(), kind: "point" as const, actorId: friend.id,
      start: 8.8, attach: 8.8, finish: 9.4, release: undefined };
    const pickup = { ...action, id: uid(), kind: "pickup" as const, actorId: friend.id,
      start: 9.5, attach: 10, finish: 12, release: undefined };
    scene.interactions = [pickup, point, action];
    expect(validateProject(project)).toBeTruthy();
    const pointing = sceneFramesAt(project, scene, 9.12).get(can.id);
    expect(pointing).toMatchObject({ ...action.release!.position, heldBy: undefined, pointing: 1 });
    expect(sceneFramesAt(project, scene, 9.5).get(can.id)).toMatchObject(action.release!.position);
    expect(sceneFramesAt(project, scene, 10.3).get(can.id)?.heldBy).toBe(friend.id);
  });

  test("keeps authored arm movement, supports shapes and flat image anchors", () => {
    const { project, scene, can, hero } = sampleGarden();
    const joint = { x: 0, y: 0, angle: 72 };
    hero.animation!.keyframes.forEach(key => { key.joints = { ...key.joints, rightArm: joint }; });
    expect(sceneFramesAt(project, scene, 4).get(hero.id)?.joints?.rightArm).toEqual(joint);
    delete project.characters[0].puppet;
    const shape = sceneFramesAt(project, scene, 4);
    expect(shape.get(hero.id)?.interactionArm?.right).toBeDefined();
    expect(shape.get(can.id)).toMatchObject(handAt(project.characters[0], hero, shape.get(hero.id)!, scene.interactions![0].grip));
    hero.assetId = "flat-art-fixture";
    const raster = sceneFramesAt(project, scene, 4);
    expect(raster.get(hero.id)?.interactionArm).toBeUndefined();
    expect(raster.get(can.id)).toMatchObject(handAt(project.characters[0], hero, raster.get(hero.id)!, scene.interactions![0].grip));
  });

  test("rejects malformed times, dangling references, scenery, duplicate identities and overlapping holds", () => {
    const { project, scene, action, can, friend } = sampleGarden();
    expect(interactionIssue([action], scene.duration, scene.elements)).toBeUndefined();
    for (const patch of [{ attach: NaN }, { finish: 130 }, { start: 4 }, { objectId: "missing" },
      { grip: { ...action.grip, x: 121 } }, { release: { time: 1, position: { x: 10, y: 10 } } },
      { kind: "give", transfer: { actorId: action.actorId, time: 4, grip: action.grip } }]) {
      expect(() => validateProject({ ...project, scenes: [{ ...scene, interactions: [{ ...action, ...patch }] }] })).toThrow();
    }
    expect(interactionIssue([action, action], scene.duration, scene.elements)).toMatch(/identity/);
    expect(interactionIssue([action, { ...action, id: uid(), actorId: friend.id }], scene.duration, scene.elements)).toMatch(/busy/);
    expect(interactionIssue(Array(25).fill(action), scene.duration, scene.elements)).toMatch(/24/);
    expect(storyObject({ ...can, sceneryDepth: "alongside" })).toBe(false);
    expect(storyObject({ ...can, prop: "slide" })).toBe(false);
    const cleaned = cleanSceneReferences({ ...scene, elements: scene.elements.filter(item => item !== can) });
    expect(cleaned.interactions).toEqual([]);
    expect(cleaned.elements.filter(item => item.animation)).toEqual(scene.elements.filter(item => item.animation));
    expect(validateProject({ ...project, captions: [], scenes: [retimeScene(scene, 2)] })).toBeTruthy();
  });

  test("carries interaction data through JSON and complete packages without changing old projects", async () => {
    const old = starterProject();
    expect(parseBackup(JSON.stringify(old))).toEqual(old);
    const { project, scene } = sampleGarden();
    const json = parseBackup(JSON.stringify(project));
    expect(json.scenes[0].interactions).toEqual(JSON.parse(JSON.stringify(scene.interactions)));
    const data = new File([await episodePackage(project)], "garden.ctepisode");
    await expect(verifyBackupFile(data)).resolves.toMatchObject({ scenes: 1 });
    const restored = await restoreProjectFile(data);
    expect(restored.id).not.toBe(project.id);
    expect(restored.scenes).toEqual(json.scenes);
  });

  test("suggests a literal story action without duplicating a prop or guessing between identities", () => {
    const { project, scene, hero, can, friend } = sampleGarden();
    expect(interactionSuggestion(project, scene)).toMatchObject({ kind: "water", objectId: can.id, actorId: hero.id });
    scene.action = "Helping Hands picks up a book.";
    scene.narration = "";
    project.idea = "";
    const duplicate = { ...friend, name: "Helping Hands" };
    const story = { ...scene, elements: scene.elements.map(item => item === friend ? duplicate : item) };
    expect(interactionSuggestion(clone(project), story)).toMatchObject({ kind: "pickup", prop: "book", alreadyPresent: false, actorId: undefined });
  });
});
