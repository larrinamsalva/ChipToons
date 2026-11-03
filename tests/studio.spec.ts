import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function editPanel(page: Page) {
  if (
    await page
      .getByRole("button", { name: "Edit scene", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "Edit scene", exact: true }).click();
}
async function previewPanel(page: Page) {
  if (
    await page.getByRole("button", { name: "Preview", exact: true }).isVisible()
  )
    await page.getByRole("button", { name: "Preview", exact: true }).click();
}
async function scenesPanel(page: Page) {
  if (
    await page.getByRole("button", { name: "Scenes", exact: true }).isVisible()
  )
    await page.getByRole("button", { name: "Scenes", exact: true }).click();
}
async function openDemo(page: Page) {
  await page.getByRole("button", { name: "Try a demo cartoon" }).click();
  await expect(
    page.getByRole("heading", {
      name: "A little room for a friend",
      exact: true,
    }),
  ).toBeVisible();
}
async function saved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "Saved on this device" }),
  ).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("idea → outline → editable storyboard → autosave → refresh → resume", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("button", { name: "Start with an idea", exact: true })
    .click();
  await page
    .getByLabel("What’s your story idea?")
    .fill("A shy cloud learns to share rain with a sunflower.");
  await page
    .getByLabel("Cartoon title", { exact: true })
    .fill("Cloud and Sunflower");
  await page.getByLabel("Character names").fill("Cloud, Sunny");
  await page.getByRole("button", { name: "Find my story" }).click();
  await expect(
    page.getByRole("heading", { name: "Your story has a beginning!" }),
  ).toBeVisible();
  await page
    .getByLabel("The beginning")
    .fill("A small cloud discovers a thirsty sunflower.");
  await page.getByRole("button", { name: "Create my storyboard" }).click();
  await editPanel(page);
  await page
    .getByLabel("Scene title", { exact: true })
    .fill("A tiny raincloud");
  await page
    .getByRole("textbox", { name: "Narration", exact: true })
    .fill("Cloud sees Sunny waiting for a little rain.");
  await page.getByLabel("Duration (seconds)").fill("");
  await page.getByLabel("Duration (seconds)").pressSequentially("12");
  await expect(page.getByLabel("Duration (seconds)")).toHaveValue("12");
  await page
    .getByRole("combobox", { name: "Background", exact: true })
    .selectOption("moonlight");
  await page
    .getByRole("combobox", { name: "Feeling", exact: true })
    .selectOption("surprised");
  await page
    .getByRole("combobox", { name: "Movement", exact: true })
    .selectOption("bounce");
  await saved(page);
  await page.reload();
  await page
    .getByRole("button", { name: "Continue Cloud and Sunflower" })
    .click();
  await editPanel(page);
  await expect(page.getByLabel("Scene title", { exact: true })).toHaveValue(
    "A tiny raincloud",
  );
  await expect(
    page.getByRole("textbox", { name: "Narration", exact: true }),
  ).toHaveValue("Cloud sees Sunny waiting for a little rain.");
  await expect(
    page.getByRole("combobox", { name: "Background", exact: true }),
  ).toHaveValue("moonlight");
  await expect(
    page.getByRole("combobox", { name: "Movement", exact: true }),
  ).toHaveValue("bounce");
  await page.getByRole("button", { name: "My story", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Beginning", exact: true }),
  ).toHaveValue("A small cloud discovers a thirsty sunflower.");
  expect(errors).toEqual([]);
});

test("scene ordering, add, duplicate, remove, undo and redo", async ({
  page,
}) => {
  await openDemo(page);
  await scenesPanel(page);
  await page
    .getByRole("button", { name: "Duplicate scene", exact: true })
    .click();
  await expect(page.locator(".scene-list > li")).toHaveCount(7);
  await page.getByRole("button", { name: "Move scene 2 down" }).click();
  await expect(page.locator(".scene-card strong").nth(2)).toHaveText(
    "A sunny kind of day (copy)",
  );
  await page.getByRole("button", { name: "Remove scene", exact: true }).click();
  await expect(page.locator(".scene-list > li")).toHaveCount(6);
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(page.locator(".scene-list > li")).toHaveCount(7);
  await page.getByRole("button", { name: "Redo edit" }).click();
  await expect(page.locator(".scene-list > li")).toHaveCount(6);
  await page.getByRole("button", { name: "Add a scene", exact: true }).click();
  await expect(page.locator(".scene-list > li")).toHaveCount(7);
  await saved(page);
});

test("full cartoon playback advances scenes, pauses, scrubs and finishes at the real duration", async ({
  page,
}) => {
  await openDemo(page);
  await previewPanel(page);
  await page.getByRole("checkbox", { name: "Sound", exact: true }).uncheck();
  await page.clock.install();
  await page.getByRole("button", { name: "Play cartoon", exact: true }).click();
  await page.clock.runFor(11_000);
  await expect(page.locator(".stage-header")).toContainText("SCENE 2 OF 6");
  await page
    .getByRole("button", { name: "Pause cartoon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play cartoon", exact: true }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Cartoon play position" }).fill("49");
  await page.getByRole("button", { name: "Play cartoon", exact: true }).click();
  await page.clock.runFor(12_000);
  await expect(page.locator(".time-display")).toHaveText("1:00 / 1:00");
  await expect(page.locator(".stage-header")).toContainText("SCENE 6 OF 6");
  await expect(
    page.getByRole("button", { name: "Play cartoon", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart cartoon" }).click();
  await expect(page.locator(".time-display")).toHaveText("0:00 / 1:00");
});

test("backup download restores edits and artwork as a separate project; storyboard is real SVG", async ({
  page,
}) => {
  await openDemo(page);
  await editPanel(page);
  await page
    .getByRole("textbox", { name: "Narration", exact: true })
    .fill("Keep this original line safe. <script>alert(1)</script>");
  const backupPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Project backup", exact: true })
    .click();
  const backup = await backupPromise;
  const path = await backup.path();
  const original = JSON.parse(await readFile(path!, "utf8"));
  expect(original.scenes[0].narration).toContain(
    "Keep this original line safe.",
  );
  const storyboardPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download storyboard", exact: true })
    .click();
  const storyboard = await storyboardPromise;
  const svg = await readFile((await storyboard.path())!, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("6 scenes");
  expect(svg).toContain("&lt;script&gt;");
  expect(svg).not.toContain("<script>");
  await page
    .getByRole("button", { name: "Save and return to my cartoons" })
    .click();
  await page.getByLabel("Restore project backup file").setInputFiles(path!);
  await expect(
    page.getByRole("heading", {
      name: "A little room for a friend",
      exact: true,
    }),
  ).toBeVisible();
  await saved(page);
  await page
    .getByRole("button", { name: "Save and return to my cartoons" })
    .click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("status")).toContainText(
    "invalid or unsupported",
  );
  await expect(page.locator(".project-card")).toHaveCount(2);
});

test("original image uploads survive refresh and project backups; SVG is rejected", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Upload a sketch or image" }).click();
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=",
    "base64",
  );
  const choosingImage = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose my image", exact: true })
    .click();
  const imageChooser = await choosingImage;
  await imageChooser.setFiles({
    name: "my-sketch.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(
    page.getByRole("heading", { name: "my-sketch’s first story" }),
  ).toBeVisible();
  await saved(page);
  await page.reload();
  await page
    .getByRole("button", { name: "Continue my-sketch’s first story" })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Project backup", exact: true })
    .click();
  const backup = await downloadPromise;
  const p = JSON.parse(await readFile((await backup.path())!, "utf8"));
  expect(p.assets[0].dataUrl).toBe(
    `data:image/png;base64,${pixel.toString("base64")}`,
  );
  expect(p.characters[0].assetId).toBe(p.assets[0].id);
  await page
    .getByRole("button", { name: "Save and return to my cartoons" })
    .click();
  await page.getByRole("button", { name: "Upload a sketch or image" }).click();
  await page.getByLabel("Upload original image file").setInputFiles({
    name: "script.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg onload="alert(1)"/>'),
  });
  await expect(page.getByRole("alert")).toContainText(
    "SVG import is not available",
  );
  await expect(
    page.getByRole("button", { name: "Choose my image" }),
  ).toBeEnabled();
  await page.getByLabel("Upload original image file").setInputFiles({
    name: "retry.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(
    page.getByRole("heading", { name: "retry’s first story" }),
  ).toBeVisible();
  await saved(page);
});

test("drawing, undo stroke, save and motion controls work", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Draw a character" }).click();
  const canvas = page.locator(".drawing-canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 70, box.y + 70);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 110);
  await page.mouse.move(box.x + 130, box.y + 75);
  await page.mouse.up();
  await page.getByRole("button", { name: "Undo stroke" }).click();
  await expect(
    page.getByRole("button", { name: "Give my character a story" }),
  ).toBeDisabled();
  await page.mouse.move(box.x + 70, box.y + 70);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 110);
  await page.mouse.up();
  await page.getByLabel("Character name", { exact: true }).fill("Doodle");
  await page.getByRole("button", { name: "Give my character a story" }).click();
  await expect(
    page.getByRole("heading", { name: "Doodle’s first story" }),
  ).toBeVisible();
  await editPanel(page);
  await page
    .getByRole("combobox", { name: "Movement", exact: true })
    .selectOption("spin");
  await saved(page);
});

test("responsive light/dark screens, keyboard dialog escape, and accessibility", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Big ideas. Little cartoons." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  let scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page
    .getByRole("button", { name: "New cartoon", exact: true })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await openDemo(page);
  await editPanel(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("a quota failure offers a working backup instead of claiming a save", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.reload();
  await openDemo(page);
  await expect(
    page.getByRole("status").filter({ hasText: "Save failed" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("storage is full");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my work" }).click();
  const backup = await pending;
  expect(
    JSON.parse(await readFile((await backup.path())!, "utf8")).scenes,
  ).toHaveLength(6);
});
