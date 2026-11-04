import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { starterProject } from "./demo-starter";
import { clone, parseBackup, uid, validateProject } from "./model";
import { imageLibraryItem, libraryItemFromLocation, listLibrary, placeLibraryItem,
  removeLibraryItem, saveLibraryItem, validateLibraryItem } from "./library";
import { libraryBackup, restoreLibraryBackup } from "./library-backup";
import { starterLocations } from "./world-starters";
import { isScenery, sceneryOffset, setSceneryDepth } from "./world-model";
import { newEpisode, newSeries, readSeriesBackup, seriesBackup } from "./series";

describe("reusable scenery layouts", () => {
  it("provides six valid original layouts made of movable props", () => {
    expect(starterLocations().map(item => item.name)).toEqual(["Kind Hearts Playground", "Little Learning Classroom",
      "Friendly Neighborhood", "Helping Hands Workshop", "Community Garden", "Cozy Family Home"]);
    for (const source of starterLocations()) {
      const item = validateLibraryItem(source);
      expect(item.location?.elements.every(element => element.kind === "prop")).toBe(true);
      expect(item.location!.elements.length).toBeGreaterThanOrEqual(6);
      expect(item.assets).toHaveLength(0);
    }
  });

  it("places the same scenery in two episodes, preserves story objects and copies its image asset", () => {
    let original = starterProject();
    const image = imageLibraryItem({
      id: uid(), type: "image", mime: "image/png", name: "My backdrop",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    }, "My backdrop", "background");
    const storyProp = { ...starterLocations()[0].location!.elements[0], id: uid(), sceneryDepth: undefined };
    original.scenes[0].elements.push(storyProp);
    original.scenes[0].camera = "close";
    original = placeLibraryItem(original, 0, starterLocations()[0]);
    original = placeLibraryItem(original, 0, image);
    const before = clone(original);
    const location = libraryItemFromLocation(original, original.scenes[0]);
    expect(location.assets).toHaveLength(1);
    expect(location.location?.camera).toBe("close");
    expect(location.location!.elements.map(element => element.id)).not.toContain(storyProp.id);
    expect(location.location!.elements.every(element => !element.characterId && !element.animation && !element.voiceMouth)).toBe(true);
    expect(JSON.stringify(location)).not.toContain('"narration"');
    const next = placeLibraryItem(original, 0, location);
    const other = placeLibraryItem(starterProject(), 0, location);
    expect(next.scenes[0].elements.filter(element => !isScenery(element))).toEqual(before.scenes[0].elements.filter(element => !isScenery(element)));
    expect(next.scenes[0]).toMatchObject({ camera: "close", narration: before.scenes[0].narration, dialogue: before.scenes[0].dialogue });
    expect(next.audioClips).toEqual(before.audioClips);
    expect(next.scenes[1]).toEqual(before.scenes[1]);
    expect(next.assets).toHaveLength(1);
    expect(other.assets[0].id).not.toBe(location.assets[0].id);
    expect(other.assets[0].dataUrl).toBe(image.assets[0].dataUrl);
    expect(parseBackup(JSON.stringify(other))).toEqual(other);
    expect(original).toEqual(before);
  });

  it("moves only the chosen object and applies deterministic depth only for opted-in animated cameras", () => {
    const project = placeLibraryItem(starterProject(), 0, starterLocations()[0]);
    const scene = project.scenes[0];
    const slide = scene.elements.find(element => element.prop === "slide")!;
    const changed = setSceneryDepth(scene.elements, slide.id, "front");
    expect(changed.at(-1)).toMatchObject({ id: slide.id, sceneryDepth: "front" });
    expect(changed.filter(element => element.id !== slide.id)).toEqual(scene.elements.filter(element => element.id !== slide.id));
    const camera = { x: 530, y: 250 };
    expect(sceneryOffset(scene, slide, camera, false)).toEqual({ x: 0, y: 0 });
    const depthScene = { ...scene, gentleDepth: true, cameraAnimation: { keyframes: [] } };
    expect(sceneryOffset(depthScene, slide, camera, false)).toEqual({ x: 26, y: 5 });
    expect(sceneryOffset(depthScene, slide, camera, true)).toEqual({ x: 0, y: 0 });
  });

  it("rejects malformed or episode-specific template data before import", () => {
    const invalid = clone(starterLocations()[0]);
    Object.assign(invalid.location!.elements[0], { voiceMouth: [] });
    expect(() => validateLibraryItem(invalid)).toThrow();
    const broken = clone(starterLocations()[0]);
    broken.location!.elements[0].x = Infinity;
    expect(() => validateLibraryItem(broken)).toThrow();
    const p = starterProject();
    p.scenes[0].elements[0].sceneryDepth = "behind";
    expect(() => validateProject(p)).toThrow();
  });

  it("restores library copies and keeps the recurring location link in series plans", async () => {
    const item = { ...starterLocations()[2], id: uid(), name: "Our block" };
    await saveLibraryItem(item, true);
    const plan = newSeries();
    plan.episodes = [{ ...newEpisode(1), locationId: item.id }, { ...newEpisode(2), locationId: item.id }];
    const restored = await readSeriesBackup(seriesBackup(plan));
    expect(restored.episodes.map(episode => episode.locationId)).toEqual([item.id, item.id]);
    const backup = await libraryBackup();
    expect(await restoreLibraryBackup(backup)).toBe(1);
    const copies = (await listLibrary()).filter(entry => entry.kind === "location");
    expect(copies).toHaveLength(2);
    await removeLibraryItem(item.id);
    const copy = (await listLibrary())[0];
    expect(copy.location).toEqual(item.location);
    await removeLibraryItem(copy.id);
  });
});
