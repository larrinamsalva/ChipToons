import { legacyFixture } from "../tests/legacy-fixture";
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterProject } from "./planner";
import { clone, parseBackup, validateProject, uid } from "./model";
import { blankDrawing, validDrawing } from "./art-model";
import {
  newLibraryItem,
  imageLibraryItem,
  placeLibraryItem,
  saveLibraryItem,
  listLibrary,
  removeLibraryItem,
  validateLibraryItem,
  starterLibrary,
  libraryItemFromElement,
  resolvedCharacter,
  savePalette,
  readPalette,
} from "./library";
import { saveProject, listProjects, deleteProject } from "./storage";
import type { DrawObject } from "./art-model";

const original = "data:image/png;base64,iVBORw0KGgo=";
afterEach(() => vi.restoreAllMocks());
describe("versioned artwork, reusable libraries and project independence", () => {
  it("migrates schema 1 without mutating the original, IDs, timing or positions", () => {
    const p = starterProject("friendship");
    const old = legacyFixture(p, 1);
    const before = JSON.stringify(old);
    const migrated = validateProject(old);
    expect(migrated.schemaVersion).toBe(4);
    expect(JSON.stringify(old)).toBe(before);
    expect(migrated.scenes[0].id).toBe(p.scenes[0].id);
    expect(migrated.scenes.map((s) => s.duration)).toEqual(
      p.scenes.map((s) => s.duration),
    );
    expect(migrated.scenes[0].elements[0]).toMatchObject({
      ...p.scenes[0].elements[0],
      kind: "character",
      pose: "standing",
      opacity: 1,
    });
  });
  it("saves, reopens, renames and duplicates a personal character independently", async () => {
    const item = newLibraryItem("Mira");
    item.group = "Garden crew";
    item.tags = ["kind", "garden"];
    await saveLibraryItem(item, true);
    expect((await listLibrary()).find((i) => i.id === item.id)).toEqual(item);
    const copy = { ...clone(item), id: uid(), name: "Mira copy" };
    await saveLibraryItem(copy, true);
    item.name = "Mira renamed";
    await saveLibraryItem(item);
    expect((await listLibrary()).find((i) => i.id === copy.id)?.name).toBe(
      "Mira copy",
    );
    await expect(saveLibraryItem(item, true)).rejects.toMatchObject({
      name: "ConstraintError",
    });
    await removeLibraryItem(item.id);
    await removeLibraryItem(copy.id);
  });
  it("copies a character to multiple projects and scenes while deduplicating artwork within a project", () => {
    const item = imageLibraryItem(
      {
        id: uid(),
        name: "original.png",
        type: "image",
        mime: "image/png",
        dataUrl: original,
      },
      "Patch",
      "character",
    );
    const source = clone(item);
    let a = placeLibraryItem(starterProject(), 0, item);
    a = placeLibraryItem(a, 1, item);
    const b = placeLibraryItem(starterProject(), 0, item);
    expect(a.assets).toHaveLength(1);
    expect(a.assets[0].id).not.toBe(item.assets[0].id);
    expect(a.assets[0].id).not.toBe(b.assets[0].id);
    a.scenes[0].elements.at(-1)!.x = 650;
    a.scenes[0].elements.at(-1)!.crop = {
      left: 0.25,
      top: 0,
      width: 0.5,
      height: 1,
    };
    expect(a.scenes[1].elements.at(-1)!.x).toBe(400);
    expect(b.scenes[0].elements.at(-1)!.x).toBe(400);
    expect(item).toEqual(source);
    expect(a.assets[0].dataUrl).toBe(original);
    expect(parseBackup(JSON.stringify(a))).toEqual(a);
  });
  it("keeps expressions, poses and appearance specific to a scene", () => {
    const source = newLibraryItem("Mira");
    let p = placeLibraryItem(starterProject(), 0, source);
    p = placeLibraryItem(p, 1, source);
    const e = p.scenes[0].elements.at(-1)!;
    e.appearance = { shirt: "#123456" };
    e.name = "Mira waving";
    e.pose = "waving";
    e.emotion = "excited";
    expect(resolvedCharacter(p, e)?.shirt).toBe("#123456");
    expect(resolvedCharacter(p, p.scenes[1].elements.at(-1))?.shirt).toBe(
      source.character!.shirt,
    );
    expect(source.pose).toBe("standing");
    expect(source.name).toBe("Mira");
    expect(validateProject(p)).toEqual(p);
    const saved = libraryItemFromElement(p, e);
    expect(saved.character?.shirt).toBe("#123456");
    expect(saved.pose).toBe("waving");
  });
  it("deleting a library source never removes copied project artwork", async () => {
    const item = imageLibraryItem(
      {
        id: uid(),
        name: "original.png",
        type: "image",
        mime: "image/png",
        dataUrl: original,
      },
      "Patch",
      "character",
    );
    await saveLibraryItem(item, true);
    const p = placeLibraryItem(starterProject(), 0, item);
    await saveProject(p);
    await removeLibraryItem(item.id);
    const saved = (await listProjects()).find((i) => i.id === p.id)!;
    expect(saved.assets[0].dataUrl).toBe(original);
    expect(validateProject(saved)).toEqual(p);
    await deleteProject(p.id);
  });
  it("supplies original starter backgrounds and reusable prop snapshots", () => {
    const starters = starterLibrary();
    for (const item of starters)
      expect(validateLibraryItem(item)).toEqual(item);
    for (const name of [
      "Classroom",
      "Playground",
      "Park",
      "House",
      "Bedroom",
      "Forest",
      "Garden",
      "Beach",
      "Town street",
      "Magical world",
    ])
      expect(
        starters.some((i) => i.name === name && i.kind === "background"),
      ).toBe(true);
    const book = starters.find((i) => i.prop === "book")!;
    const p = placeLibraryItem(starterProject(), 0, book);
    expect(p.scenes[0].elements.at(-1)).toMatchObject({
      kind: "prop",
      prop: "book",
    });
    expect(
      placeLibraryItem(
        p,
        0,
        starters.find((i) => i.background === "beach")!,
      ).scenes[0].background,
    ).toBe("beach");
  });
  it("round trips editable drawing objects with the embedded PNG and rejects invalid strokes", () => {
    const object: DrawObject = {
      id: uid(),
      kind: "star",
      x: 40,
      y: 50,
      width: 130,
      height: 130,
      rotation: 25,
      stroke: "#123456",
      fill: "#e4ba5d",
      lineWidth: 5,
      eraser: false,
      points: [],
    };
    const drawing = { ...blankDrawing(), objects: [object] };
    const item = imageLibraryItem(
      {
        id: uid(),
        name: "star.png",
        type: "image",
        mime: "image/png",
        dataUrl: original,
        drawing,
      },
      "Star",
      "drawing",
    );
    const p = placeLibraryItem(starterProject(), 0, item);
    expect(parseBackup(JSON.stringify(p)).assets[0].drawing).toEqual(drawing);
    const bad = clone(drawing);
    bad.objects.push({ ...object });
    expect(validDrawing(bad)).toBe(false);
    bad.objects[1].id = uid();
    bad.objects[1].rotation = Infinity;
    expect(validDrawing(bad)).toBe(false);
  });
  it("rejects missing assets, invalid crops, unsupported poses and disguised active SVG", () => {
    const p = starterProject();
    const e = p.scenes[0].elements[0];
    e.crop = { left: 0.9, top: 0, width: 0.5, height: 1 };
    expect(() => validateProject(p)).toThrow();
    delete e.crop;
    e.pose = "running-code" as "standing";
    expect(() => validateProject(p)).toThrow();
    delete e.pose;
    e.kind = "art";
    e.assetId = "missing";
    expect(() => validateProject(p)).toThrow();
    const item = imageLibraryItem(
      {
        id: uid(),
        name: "unsafe.png",
        type: "image",
        mime: "image/png",
        dataUrl: `data:image/png;base64,${btoa('<svg onload="alert(1)"/>')}`,
      },
      "Unsafe",
      "prop",
    );
    expect(() => validateLibraryItem(item)).toThrow();
    item.assets[0].dataUrl = "data:image/svg+xml;base64,PHN2Zy8+";
    expect(() => validateLibraryItem(item)).toThrow();
  });
  it("handles quota failures without dropping an earlier saved source", async () => {
    const safe = newLibraryItem("Already saved");
    await saveLibraryItem(safe, true);
    const p = newLibraryItem("Unsaved");
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    await expect(saveLibraryItem(p, true)).rejects.toMatchObject({
      name: "QuotaExceededError",
    });
    vi.restoreAllMocks();
    expect((await listLibrary()).some((i) => i.id === safe.id)).toBe(true);
    expect((await listLibrary()).some((i) => i.id === p.id)).toBe(false);
    await removeLibraryItem(safe.id);
  });
  it("keeps saved palettes local and filters invalid settings on read", async () => {
    await savePalette(["#123456", "#ffffff"]);
    expect(await readPalette()).toEqual(["#123456", "#ffffff"]);
  });
});
