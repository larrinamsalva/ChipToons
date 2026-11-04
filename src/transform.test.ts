import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { imageLibraryItem, placeLibraryItem, starterLibrary, validateLibraryItem } from "./library";
import { clone, parseBackup, uid, validateProject } from "./model";
import type { Asset } from "./model";
import { starterProject } from "./planner";
import { duplicateScript, withScript } from "./script";
import { cleanSceneReferences, duplicateAnimatedScene, retimeScene, sceneFramesAt } from "./timeline";
import { EXAMPLE_NAMES, changeTime, learningIssue, stepTime, transformIssue } from "./transform-model";
import type { TransformExample } from "./transform-model";
import { objectAppearanceAt, reconcileTransformReferences } from "./transform-motion";
import { transformExample } from "./transform-examples";
import { libraryArtworkFromState, stateArtworkFromLibrary } from "./transform-studio";

const raster = (): Asset => ({
  id: uid(), name: "An original image", mime: "image/png", type: "image",
  dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=",
});

function wagon() {
  const project = transformExample("wagon");
  const scene = project.scenes[0];
  const track = scene.objectTracks![0];
  return { project, scene, track, change: track.changes[0], pickup: scene.interactions![1],
    object: scene.elements.find(item => item.id === track.objectId)! };
}

describe("object appearance tracks", () => {
  test("validates all four original examples and leaves legacy cartoons unchanged", () => {
    for (const name of Object.keys(EXAMPLE_NAMES) as TransformExample[]) {
      const project = transformExample(name);
      expect(validateProject(project).scenes[0].objectTracks?.[0].changes.length).toBeGreaterThanOrEqual(1);
    }
    const old = starterProject();
    expect(parseBackup(JSON.stringify(old))).toEqual(old);
    expect(old.scenes.every(scene => !scene.objectTracks && !scene.learningSteps)).toBe(true);
  });

  test("seeks deterministically through a one-artwork fade and a clipped reveal", () => {
    const { scene, track, change } = wagon();
    track.changes = [{ ...change, transition: "fade", at: 4, length: 1 }];
    expect(objectAppearanceAt(scene, track, 4.4).state?.name).toBe("Loose wheel");
    const mid = objectAppearanceAt(scene, track, 4.5);
    expect(mid.state?.name).toBe("Wheel attached");
    expect(mid.opacity).toBeCloseTo(0.08);
    expect(objectAppearanceAt(scene, track, 5.3)).toMatchObject({ opacity: 1, reveal: 1, state: { name: "Wheel attached" } });
    expect(objectAppearanceAt(scene, track, 4.5)).toEqual(mid);
    track.changes[0].transition = "reveal";
    expect(objectAppearanceAt(scene, track, 4.25)).toMatchObject({ opacity: 1, reveal: 0.25, state: { name: "Wheel attached" } });
  });

  test("keeps the same object held through the repair and rolls the fixed wagon in the next scene", () => {
    const { project, scene, track, change, pickup, object } = wagon();
    const before = sceneFramesAt(project, scene, change.at - 0.2).get(object.id)!;
    const after = sceneFramesAt(project, scene, change.at + 0.2).get(object.id)!;
    expect(before.heldBy).toBe(pickup.actorId);
    expect(after.heldBy).toBe(pickup.actorId);
    expect(objectAppearanceAt(scene, track, change.at - 0.2).state?.name).toBe("Loose wheel");
    expect(objectAppearanceAt(scene, track, change.at + 0.2).state?.name).toBe("Wheel attached");
    expect(sceneFramesAt(project, scene, 13).get(object.id)).toMatchObject({ ...pickup.release!.position, heldBy: undefined });
    const next = project.scenes[1];
    const rolled = next.elements.find(item => item.prop === "toy-wagon")!;
    expect(rolled.propAppearance).toBe("fixed-wheel");
    expect(sceneFramesAt(project, next, 3.6).get(rolled.id)!.x).toBeGreaterThan(rolled.x + 100);
  });

  test("follows a moved cue, rejects overlap, and keeps the last time when its interaction is removed", () => {
    const { scene, track, change, pickup } = wagon();
    change.cue = { interactionId: pickup.id, moment: "Attach" };
    const previous = { ...scene, interactions: scene.interactions!.map(item => item === pickup ? { ...item, attach: 5.4 } : item) };
    expect(changeTime(previous, track, change)).toBe(5.4);
    expect(stepTime(previous, previous.learningSteps!.at(-1)!)).toBe(5.4);
    const overlap = { ...track, changes: [{ ...change, length: 0.6, transition: "fade" },
      { ...change, cue: undefined, id: uid(), at: 5.7 }] };
    expect(transformIssue([overlap], previous, new Set())).toMatch(/overlap/);
    const detached = cleanSceneReferences({ ...previous, interactions: [scene.interactions![0]] }, previous);
    expect(detached.objectTracks![0].changes[0]).toMatchObject({ cue: undefined, at: 5.4 });
    const short = retimeScene(previous, 7);
    expect(changeTime(short, short.objectTracks![0], short.objectTracks![0].changes[0])).toBeCloseTo(2.7);
  });

  test("validates state, timing, artwork, step and object references at the import boundary", () => {
    const { project, scene, track, change } = wagon();
    function invalid(patch: object) {
      expect(() => validateProject({ ...project, scenes: [{ ...scene, ...patch }, project.scenes[1]] })).toThrow(/invalid/);
    }
    invalid({ objectTracks: [{ ...track, objectId: "unavailable" }] });
    invalid({ objectTracks: [{ ...track, initial: "unknown" }] });
    invalid({ objectTracks: [{ ...track, changes: [{ ...change, at: 150 }] }] });
    invalid({ objectTracks: [{ ...track, states: [...track.states, ...Array.from({ length: 3 }, () =>
      ({ id: uid(), name: "Another", art: { kind: "original" } }))] }] });
    invalid({ objectTracks: [{ ...track, states: track.states.map(state => ({
      ...state, art: { kind: "image", assetId: "missing-source" },
    })) }] });
    invalid({ learningSteps: [{ id: uid(), at: 1, text: "Missing line", lineId: "elsewhere" }] });
    invalid({ objectTracks: [{ ...track, changes: [] }] });
    expect(learningIssue([{ id: uid(), text: "Problem", at: -1 }], scene)).toMatch(/time/);
  });

  test("copies compatible library states and raster sources without modifying the originals", () => {
    const { project, track, object } = wagon();
    const reusable = libraryArtworkFromState(project, object, track.states[0]);
    expect(validateLibraryItem(reusable).propAppearance).toBe("loose-wheel");
    const placed = placeLibraryItem(starterProject(), 0, reusable);
    expect(placed.scenes[0].elements.at(-1)?.propAppearance).toBe("loose-wheel");
    expect(starterLibrary().find(item => item.prop === "toy-wagon")?.propAppearance).toBeUndefined();
    const original = raster();
    const image = imageLibraryItem(original, "Original artwork", "prop");
    const source = clone(image);
    const destination: Asset[] = [];
    const first = stateArtworkFromLibrary(image, destination);
    expect(stateArtworkFromLibrary(image, destination)).toEqual(first);
    expect(destination).toHaveLength(1);
    expect(destination[0].id).not.toBe(original.id);
    expect(destination[0].dataUrl).toBe(original.dataUrl);
    expect(image).toEqual(source);
  });

  test("remaps duplicated objects, states, action and script links and safely detaches deleted links", () => {
    const { project, scene, track, change, pickup } = wagon();
    change.cue = { interactionId: pickup.id, moment: "Release" };
    const duplicate = duplicateScript(duplicateAnimatedScene(scene), [], []);
    const moved = duplicate.objectTracks![0];
    expect(moved.objectId).not.toBe(track.objectId);
    expect(moved.initial).not.toBe(track.initial);
    expect(moved.changes[0].cue?.interactionId).toBe(duplicate.interactions![1].id);
    expect(duplicate.learningSteps!.at(-1)).toMatchObject({ lineId: duplicate.script!.lines[3].id,
      cue: { kind: "change", changeId: moved.changes[0].id } });
    expect(validateProject({ ...project, scenes: [...project.scenes, duplicate] })).toBeTruthy();
    const priorTime = stepTime(scene, scene.learningSteps!.at(-1)!);
    const withoutChange = reconcileTransformReferences({ ...scene, objectTracks: [{ ...track, changes: [] }] }, scene);
    expect(withoutChange.learningSteps!.at(-1)).toMatchObject({ at: priorTime, cue: undefined });
    const lines = scene.script!.lines.slice(0, 3);
    expect(withScript(scene, { ...scene.script!, lines }).learningSteps!.at(-1)?.lineId).toBeUndefined();
    const removed = cleanSceneReferences({ ...scene, elements: scene.elements.filter(item => item.id !== track.objectId) }, scene);
    expect(removed.objectTracks).toEqual([]);
    expect(removed.interactions).toEqual([]);
  });

  test("keeps timing, object identities and reusable original art in JSON and complete episode backups", async () => {
    const { project, scene, track } = wagon();
    const original = raster();
    project.assets.push(original);
    track.states[1].art = { kind: "image", assetId: original.id };
    const json = parseBackup(JSON.stringify(project));
    const packageFile = new File([await episodePackage(project)], "wagon.ctepisode");
    const restored = await restoreProjectFile(packageFile);
    expect(restored.id).not.toBe(project.id);
    expect(restored.scenes).toEqual(json.scenes);
    expect(restored.assets).toEqual(json.assets);
    expect(restored.scenes[0].id).toBe(scene.id);
  });
});
