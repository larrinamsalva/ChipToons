import { legacyFixture } from "./legacy-fixture";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { starterProject } from "../src/demo-starter";
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=",
  "base64",
);
async function saved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "Saved on this device" }),
  ).toBeVisible();
}
async function properties(page: Page) {
  await expect(page.locator(".editor")).toBeVisible();
  const tab = page.getByRole("button", { name: "Edit scene", exact: true });
  if (await tab.isVisible()) await tab.click();
}
async function library(page: Page) {
  await page.locator(".dashboard, .editor").waitFor({ state: "visible" });
  const dashboard = page.getByRole("button", {
    name: "Open art library",
    exact: true,
  });
  if (await dashboard.isVisible()) await dashboard.click();
  else
    await page
      .locator(".editor-toolbar")
      .getByRole("button", { name: "Art library", exact: true })
      .click();
}
const card = (page: Page, name: string) =>
  page
    .locator(".library-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
async function backup(page: Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Project backup", exact: true })
    .click();
  const download = await pending;
  const path = (await download.path())!;
  return { path, data: JSON.parse(await readFile(path, "utf8")) };
}

test("personal characters survive reload, work in two projects and keep scene-specific edits separate", async ({
  page,
}) => {
  await page.goto("./");
  await library(page);
  await page
    .getByRole("button", { name: "New character", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Artwork name", exact: true })
    .fill("Mira");
  await page.getByLabel("Collection", { exact: true }).fill("Garden crew");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Saved Mira",
  );
  await page.reload();
  await library(page);
  await page.getByRole("searchbox", { name: "Find artwork" }).fill("Mira");
  await expect(card(page, "Mira")).toHaveCount(1);
  await card(page, "Mira")
    .getByRole("button", { name: "Start cartoon with this" })
    .click();
  await saved(page);
  await page
    .getByRole("button", { name: "Save and return to my cartoons" })
    .click();
  await library(page);
  await page.getByRole("searchbox", { name: "Find artwork" }).fill("Mira");
  await card(page, "Mira")
    .getByRole("button", { name: "Start cartoon with this" })
    .click();
  await properties(page);
  await page
    .getByRole("combobox", { name: "Selected scene object", exact: true })
    .selectOption({ label: "Mira" });
  await page
    .getByRole("spinbutton", { name: "Object X", exact: true })
    .fill("650");
  await page
    .getByRole("textbox", { name: "Character name", exact: true })
    .fill("Mira waving");
  await saved(page);
  await library(page);
  await page.getByRole("searchbox", { name: "Find artwork" }).fill("Mira");
  await card(page, "Mira")
    .getByRole("button", { name: "Add to three scenes" })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "three scenes",
  );
  await page.getByRole("button", { name: "Back to my story" }).click();
  await saved(page);
  const { data } = await backup(page);
  const placed = data.scenes
    .flatMap((s: { elements: unknown[] }) => s.elements)
    .filter((e: { sourceLibraryId?: string }) => e.sourceLibraryId);
  expect(placed).toHaveLength(4);
  expect(placed.find((e: { name: string }) => e.name === "Mira waving").x).toBe(
    650,
  );
  expect(
    placed
      .filter((e: { name: string }) => e.name === "Mira")
      .every((e: { x: number }) => e.x === 400),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Save and return to my cartoons" })
    .click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  await library(page);
  await page.getByRole("searchbox", { name: "Find artwork" }).fill("Mira");
  await expect(card(page, "Mira")).toHaveCount(1);
  await card(page, "Mira")
    .getByRole("button", { name: "Duplicate Mira", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Artwork name" })
    .fill("Unused friend");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "Find artwork" }).fill("Unused");
  await card(page, "Unused friend")
    .getByRole("button", { name: "Delete library Unused friend" })
    .click();
  await page
    .getByRole("button", { name: "Delete library entry", exact: true })
    .click();
  await expect(card(page, "Unused friend")).toHaveCount(0);
});

test("editable drawings, shape transforms, palette, undo/redo and real PNG export", async ({
  page,
}) => {
  await page.goto("./");
  await library(page);
  await page.getByRole("button", { name: "Drawings", exact: true }).click();
  await page.getByRole("button", { name: "Draw artwork", exact: true }).click();
  await page.getByRole("button", { name: "Star", exact: true }).click();
  await page.getByRole("button", { name: "Insert shape", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Drawing rotation", exact: true })
    .fill("25");
  await page
    .getByRole("textbox", { name: "Character name", exact: true })
    .fill("Star friend");
  await page
    .getByRole("button", { name: "Save this color", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo stroke", exact: true }).click();
  await page.getByRole("button", { name: "Redo drawing", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export artwork PNG", exact: true })
    .click();
  const d = await pending;
  const bytes = await readFile((await d.path())!);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.readUInt32BE(16)).toBe(600);
  expect(bytes.readUInt32BE(20)).toBe(400);
  await page.getByRole("button", { name: "Continue to save artwork" }).click();
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await expect(card(page, "Star friend")).toHaveCount(1);
  await page.reload();
  await library(page);
  await page.getByRole("button", { name: "Drawings", exact: true }).click();
  await card(page, "Star friend")
    .getByRole("button", { name: "Edit / rename" })
    .click();
  await page.getByRole("button", { name: "Edit drawing objects" }).click();
  await page
    .getByRole("combobox", { name: "Select drawn object" })
    .selectOption({ label: "1. star" });
  await expect(
    page.getByRole("spinbutton", { name: "Drawing rotation", exact: true }),
  ).toHaveValue("25");
  await page
    .getByRole("spinbutton", { name: "Drawing x", exact: true })
    .fill("120");
  await page.getByRole("button", { name: "Continue to save artwork" }).click();
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await card(page, "Star friend")
    .getByRole("button", { name: "Start cartoon with this" })
    .click();
  await saved(page);
  const { data } = await backup(page);
  expect(data.assets[0].drawing.objects[0]).toMatchObject({
    kind: "star",
    rotation: 25,
    x: 120,
  });
});

test("crop preserves uploads, props reorder, source deletion and portable restore retain all art", async ({
  page,
}) => {
  await page.goto("./");
  await library(page);
  const choosing = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Upload artwork", exact: true })
    .click();
  const chooser = await choosing;
  await chooser.setFiles({
    name: "patch.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await page.getByRole("textbox", { name: "Artwork name" }).fill("Patch");
  await page.locator(".crop-controls summary").click();
  await page.getByRole("slider", { name: "Crop left", exact: true }).fill("25");
  await page
    .getByRole("slider", { name: "Crop width", exact: true })
    .fill("50");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await card(page, "Patch")
    .getByRole("button", { name: "Start cartoon with this" })
    .click();
  await saved(page);
  await library(page);
  await page.getByRole("button", { name: "Props", exact: true }).click();
  await card(page, "Book")
    .getByRole("button", { name: "Add to scene", exact: true })
    .click();
  await card(page, "Flower")
    .getByRole("button", { name: "Add to scene", exact: true })
    .click();
  await page.getByRole("button", { name: "Backgrounds", exact: true }).click();
  await card(page, "Beach")
    .getByRole("button", { name: "Add to scene", exact: true })
    .click();
  await page.getByRole("button", { name: "Back to my story" }).click();
  await properties(page);
  await page
    .getByRole("combobox", { name: "Selected scene object", exact: true })
    .selectOption({ label: "Book" });
  await page
    .getByRole("button", { name: "Bring forward", exact: true })
    .click();
  await saved(page);
  const exported = await backup(page);
  expect(exported.data.scenes[0].background).toBe("beach");
  expect(exported.data.scenes[0].elements.at(-1).prop).toBe("book");
  expect(exported.data.assets[0].dataUrl).toBe(
    `data:image/png;base64,${pixel.toString("base64")}`,
  );
  expect(
    exported.data.scenes[0].elements.find(
      (e: { name: string }) => e.name === "Patch",
    ).crop,
  ).toMatchObject({ left: 0.25, width: 0.5 });
  await library(page);
  await page.getByRole("searchbox", { name: "Find artwork" }).fill("Patch");
  await card(page, "Patch")
    .getByRole("button", { name: "Delete library Patch" })
    .click();
  await page.getByRole("button", { name: "Delete library entry" }).click();
  await page.getByRole("button", { name: "Back to my story" }).click();
  await page
    .getByRole("button", { name: "Save and return to my cartoons" })
    .click();
  await page
    .getByLabel("Restore project backup file")
    .setInputFiles(exported.path);
  await saved(page);
  const restored = await backup(page);
  expect(restored.data.assets).toEqual(exported.data.assets);
  expect(restored.data.scenes).toEqual(exported.data.scenes);
});

test("schema 1 projects upgrade without loss, new libraries recover after reload", async ({
  page,
}) => {
  const p = starterProject("friendship");
  p.title = "Legacy story";
  const legacy = legacyFixture(p, 1);
  await page.addInitScript((data) => {
    if (localStorage.getItem("seeded-legacy")) return;
    localStorage.setItem("seeded-legacy", "yes");
    const req = indexedDB.open("chiptoons-studio", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("projects", { keyPath: "id" });
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(data);
      tx.oncomplete = () => db.close();
    };
  }, legacy);
  await page.goto("./");
  await page.getByRole("button", { name: "Continue Legacy story" }).click();
  await saved(page);
  const { data } = await backup(page);
  expect(data.schemaVersion).toBe(4);
  expect(data.scenes[0].id).toBe(p.scenes[0].id);
  expect(data.scenes[0].elements[0]).toMatchObject({
    ...p.scenes[0].elements[0],
  });
  await library(page);
  await page
    .getByRole("button", { name: "New character", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Artwork name" }).fill("New source");
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Saved New source",
  );
  await page.reload();
  await library(page);
  await page
    .getByRole("searchbox", { name: "Find artwork" })
    .fill("New source");
  await expect(card(page, "New source")).toHaveCount(1);
});

test("library quota errors retain unsaved work, retry succeeds, and light/dark library accessibility", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const env = globalThis as unknown as { failLibrary: boolean };
    env.failLibrary = true;
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "library" && env.failLibrary)
        throw new DOMException("Full", "QuotaExceededError");
      return add.apply(this, args);
    };
  });
  await page.goto("./");
  await library(page);
  await page
    .getByRole("button", { name: "New character", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Artwork name" }).fill("Still here");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("still open");
  await expect(page.getByRole("textbox", { name: "Artwork name" })).toHaveValue(
    "Still here",
  );
  await page.evaluate(() => {
    (globalThis as unknown as { failLibrary: boolean }).failLibrary = false;
  });
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await expect(card(page, "Still here")).toHaveCount(1);
  let scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Back to my studio" }).click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await library(page);
  scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.getByRole("button", { name: "Props", exact: true }).click();
  await expect(card(page, "Chair")).toHaveCount(1);
  await page.getByRole("button", { name: "Backgrounds", exact: true }).click();
  await expect(page.locator(".library-card")).toHaveCount(11);
});
