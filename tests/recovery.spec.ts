import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { starterProject } from "../src/planner";
import { builtInSound } from "../src/sounds";
import { restore, saved, voices } from "./production-helpers";

const name = "The lantern lesson";
const source = { ...builtInSound("notice"), name: "Lantern scene voice" };
const bytes = Buffer.from(source.dataUrl.split(",")[1], "base64");

async function seed(page: Page, original = true) {
  await restore(page, { ...starterProject(), title: name, audioAssets: original ? [source] : [] });
  await saved(page);
  if (original) {
    await voices(page);
    await page.getByRole("button", { name: "Enable long-episode audio", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Long-episode audio is enabled" })).toBeVisible();
    await page.getByRole("button", { name: "Back to cartoon", exact: true }).click();
    await saved(page);
  }
}
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dashboard = (page: Page) => button(page, "Save and return to my cartoons").click();
const sceneTitle = (page: Page) => page.getByLabel("Scene title", { exact: true });
async function showSceneEditor(page: Page) {
  const edit = button(page, "Edit scene");
  if (await edit.isVisible()) await edit.click();
}
async function recovery(page: Page) {
  await button(page, "Project & Media Recovery").click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(/ready to review/);
}
async function remove(page: Page, title = name) {
  await button(page, `Delete ${title}`).click();
  await button(page, "Delete cartoon").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function download(page: Page, control: string) {
  const pending = page.waitForEvent("download");
  await button(page, control).click();
  const file = await pending;
  return { name: file.suggestedFilename(), buffer: await readFile((await file.path())!) };
}

test("recovery lists shared audio, previews and downloads originals, and verifies a complete backup", async ({ page }, info) => {
  await seed(page);
  await dashboard(page);
  await button(page, `Duplicate ${name}`).click();
  await expect(page.getByRole("heading", { name: `${name} (copy)`, exact: true })).toBeVisible();
  await recovery(page);
  await button(page, "Check My Projects").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(/passed/);
  const pack = await download(page, `Download Complete Backup for ${name}`);
  expect(pack.name).toMatch(/\.ctepisode$/);
  expect(pack.buffer.subarray(0, 8).toString()).toBe("CTEPKG01");
  const choose = page.waitForEvent("filechooser");
  await button(page, "Verify Backup File").click();
  await (await choose).setFiles({ ...pack, mimeType: "application/octet-stream" });
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(/Backup verified.*1 file-backed originals/);
  await button(page, "Find My Recordings").click();
  await expect(page.getByText(/Used in .*lantern lesson/)).toContainText("(copy)");
  await page.getByRole("searchbox", { name: "Search recordings" }).fill("Lantern scene");
  await page.getByLabel("Filter recordings").selectOption("referenced");
  await button(page, "Preview Recording").click();
  const audio = page.locator("audio").filter({ visible: true });
  await expect(audio).toHaveCount(1);
  await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => node.duration)).toBeGreaterThan(0.02);
  await audio.evaluate((node: HTMLAudioElement) => node.play());
  await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => node.currentTime)).toBeGreaterThan(0);
  expect((await download(page, "Download Original")).buffer).toEqual(bytes);
  await button(page, "Close dialog").click();
  await remove(page);
  await recovery(page);
  await button(page, "Find My Recordings").click();
  await expect(page.getByText(/Used in The lantern lesson \(copy\)/)).toBeVisible();

  if (info.project.name === "desktop") {
    await button(page, "Close dialog").click();
    await button(page, "Switch to dark theme").click();
    await recovery(page);
    await button(page, "Find My Recordings").click();
  }
  const dialog = page.getByRole("dialog");
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await info.attach(`recovery-${info.project.name}`, { body: await dialog.screenshot(), contentType: "image/png" });
});

test("cleanup dry run is cancellable, respects active tabs and restores the complete backup afterward", async ({ page, context }) => {
  await seed(page);
  const pack = await download(page, "Project backup");
  await dashboard(page);
  await remove(page);
  await recovery(page);
  await button(page, "Review Storage").click();
  const checkbox = page.getByRole("checkbox", { name: /Lantern scene voice/ });
  await checkbox.check();
  await button(page, "Review Cleanup").click();
  await expect(page.getByRole("group", { name: "Confirm permanent removal" })).toBeVisible();
  await button(page, "Cancel Cleanup").click();
  await expect(checkbox).toBeChecked();

  const other = await context.newPage();
  await restore(other, { ...starterProject(), title: "Open draft", audioAssets: [] });
  await saved(other);
  await button(page, "Review Cleanup").click();
  await button(page, "Permanently Remove Selected Originals").click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(/Close open cartoon editors/);
  await other.close();
  await button(page, "Permanently Remove Selected Originals").click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(/Removed 1 original recording/);
  await button(page, "Find My Recordings").click();
  await expect(page.getByText("No recordings match this view.")).toBeVisible();
  await button(page, "Close dialog").click();
  await page.getByLabel("Restore project backup file").setInputFiles({ ...pack, mimeType: "application/octet-stream" });
  await expect(page.locator(".editor")).toBeVisible();
  await saved(page);
  const restored = await download(page, "Project backup");
  expect(restored.buffer.subarray(0, 8).toString()).toBe("CTEPKG01");
});

test("a second tab opens read-only and takeover keeps both the newest version and a conflicting draft", async ({ page, context }) => {
  await seed(page, false);
  const other = await context.newPage();
  await other.goto(page.url());
  await button(other, `Continue ${name}`).click();
  await expect(other.getByRole("status").filter({ hasText: "Open read-only" })).toBeVisible();
  await expect(other.locator(".editor")).toHaveCount(0);
  await button(other, "Edit in This Tab").click();
  await button(other, "Keep Read-Only").click();
  await button(other, "Edit in This Tab").click();
  await button(other, "Take Over Editing").click();
  await expect(other.locator(".editor")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Another tab changed this cartoon");
  await button(page, "Save and return to my cartoons").click();
  await button(page, "Keep Draft Open").click();
  await showSceneEditor(page);
  await showSceneEditor(other);
  await sceneTitle(page).fill("The preserved conflicting draft");
  await sceneTitle(other).fill("The new saved scene");
  await saved(other);
  await button(page, "Save as a Separate Copy").click();
  await expect(page.getByRole("heading", { name: `${name} (copy)`, exact: true })).toBeVisible();
  await showSceneEditor(page);
  await expect(sceneTitle(page)).toHaveValue("The preserved conflicting draft");
  await other.close();
  const after = await context.newPage();
  await after.goto(page.url());
  await button(after, `Continue ${name}`).click();
  await expect(after.locator(".editor")).toBeVisible();
  await showSceneEditor(after);
  await expect(sceneTitle(after)).toHaveValue("The new saved scene");
});

test("durable revisions reject stale saves when tab coordination is unavailable", async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  await seed(page, false);
  const other = await context.newPage();
  await other.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  await other.goto(page.url());
  await button(other, `Continue ${name}`).click();
  await expect(other.locator(".editor")).toBeVisible();
  await saved(other);
  await showSceneEditor(other);
  await showSceneEditor(page);
  await sceneTitle(other).fill("The later saved scene");
  await saved(other);
  await sceneTitle(page).fill("An outdated tab's draft");
  await expect(page.getByRole("alert")).toContainText("Another tab changed this cartoon");
  await expect(sceneTitle(page)).toHaveValue("An outdated tab's draft");
  await expect(sceneTitle(other)).toHaveValue("The later saved scene");
});

test("a missing recording can be reconnected with exact bytes without changing the scene or clip settings", async ({ page }) => {
  await seed(page);
  const pack = await download(page, "Project backup");
  const manifest = JSON.parse(pack.buffer.subarray(16, 16 + pack.buffer.readUInt32LE(8)).toString());
  const key: string = manifest.project.audioAssets[0].file.key;
  await dashboard(page);
  await page.evaluate(key => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("chiptoons-studio");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const database = req.result;
      const tx = database.transaction("media", "readwrite");
      tx.objectStore("media").delete(key);
      tx.onabort = () => { database.close(); reject(tx.error); };
      tx.oncomplete = () => { database.close(); resolve(); };
    };
  }), key);
  await recovery(page);
  await expect(page.getByText(/Originals need attention/)).toBeVisible();
  await page.getByLabel("Source to repair").selectOption({ index: 1 });
  const picker = page.getByLabel("Choose identical audio file");
  const wrong = Buffer.from(builtInSound("birds").dataUrl.split(",")[1], "base64");
  await picker.setInputFiles({ name: "voice.wav", mimeType: "audio/wav", buffer: wrong });
  await button(page, "Reconnect Exact Original").click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(/different from the original/);
  await picker.setInputFiles({ name: "voice.wav", mimeType: "audio/wav", buffer: bytes });
  await button(page, "Reconnect Exact Original").click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(/exact original was reconnected/);
  const repaired = await download(page, `Download Complete Backup for ${name}`);
  const after = JSON.parse(repaired.buffer.subarray(16, 16 + repaired.buffer.readUInt32LE(8)).toString());
  expect(after.project.audioClips).toEqual(manifest.project.audioClips);
  expect(after.project.scenes).toEqual(manifest.project.scenes);
  expect(after.project.audioAssets[0].file.sha256).toBe(manifest.project.audioAssets[0].file.sha256);
});
