import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { visualTeachingExample } from "../src/focus-examples";
import { FOCUS_TYPES } from "../src/focus-model";
import { transformExample } from "../src/transform-examples";
import { backup, number, restore, saved } from "./production-helpers";

test.use({ actionTimeout: 12_000 });
const title = "Show What We're Learning";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: title });
async function edit(page: Page) {
  const tab = button(page, "Edit scene");
  if (await tab.isVisible()) await tab.click();
  await button(page, title).click();
  return dialog(page);
}
async function previewTab(page: Page) {
  const tab = button(page, "Preview");
  if (await tab.isVisible()) await tab.click();
}
const preview = (page: Page) => dialog(page).getByRole("region", { name: "Proposed scene preview" });
const previewTime = (page: Page) => preview(page).getByRole("spinbutton", { name: "Preview time (seconds)" });
async function review(page: Page) { await dialog(page).getByRole("button", { name: "Preview", exact: true }).press("Enter"); }
async function apply(page: Page) {
  await dialog(page).getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog(page)).toBeHidden();
}

test("adds all six graphics with keyboard review, and preserves undo, captions and reopen", async ({ page }, info) => {
  test.setTimeout(95_000);
  const project = transformExample("wagon");
  await restore(page, project);
  await saved(page);
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  const original = (await backup(page)).data;
  let form = await edit(page);
  await form.getByLabel("Teaching text", { exact: true }).fill("Discard this draft");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await backup(page)).data.scenes).toEqual(original.scenes);

  for (const [i, kind] of Object.keys(FOCUS_TYPES).entries()) {
    form = await edit(page);
    await form.getByLabel("Teaching graphic", { exact: true }).selectOption(kind);
    await number(page, "Start time (seconds)", String(i * 1.7 + 0.1));
    await number(page, "End time (seconds)", String(i * 1.7 + 1.2));
    if (kind === "label" || kind === "card") await form.getByLabel("Teaching text", { exact: true }).fill(kind === "card" ? "Ask a grown-up to help" : "Look closely");
    await expect(form.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
    await review(page);
    await expect(preview(page).locator(`[data-focus-kind="${kind}"]`)).toHaveCount(1);
    if (kind === "card") {
      const size = await form.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
      expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
      expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    }
    await apply(page);
  }
  const result = (await backup(page)).data;
  expect(result.scenes[0].focusGraphics).toHaveLength(6);
  expect(result.captions).toEqual(original.captions);
  expect(result.scenes[0].elements).toEqual(original.scenes[0].elements);
  await button(page, "Undo edit").click();
  expect((await backup(page)).data.scenes[0].focusGraphics).toHaveLength(5);
  await button(page, "Redo edit").click();
  await saved(page);
  await page.reload();
  await button(page, `Continue ${project.title}`).click();
  await previewTab(page);
  await expect(page.getByRole("button", { name: "Edit teaching graphic: Ask a grown-up to help at 8.60 seconds", exact: true })).toBeVisible();
});

test("follows the held wagon and keeps an edited card fixed and clear of captions", async ({ page }, info) => {
  test.setTimeout(80_000);
  const project = transformExample("wagon");
  const wagon = project.scenes[0].elements.find(item => item.prop === "toy-wagon")!;
  await restore(page, project);
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  let form = await edit(page);
  await form.getByLabel("Teaching graphic", { exact: true }).selectOption("arrow");
  await form.getByLabel("Positioning", { exact: true }).selectOption("object");
  await form.getByLabel("Choose an object", { exact: true }).selectOption(wagon.id);
  await number(page, "Detail offset X", "61");
  await number(page, "Detail offset Y", "-6");
  await number(page, "Start time (seconds)", "3.5");
  await number(page, "End time (seconds)", "8.9");
  await review(page);
  const arrow = preview(page).locator('[data-focus-kind="arrow"]');
  await previewTime(page).fill("3.9");
  await expect(arrow).toHaveCount(1);
  const x = Number(await arrow.getAttribute("data-focus-x"));
  await previewTime(page).fill("7");
  expect(Math.abs(Number(await arrow.getAttribute("data-focus-x")) - x)).toBeGreaterThan(3);
  await expect(preview(page).locator(`[data-element-id="${wagon.id}"]`)).toHaveAttribute("data-held-by", /.+/);
  await apply(page);

  form = await edit(page);
  await form.getByLabel("Teaching graphic", { exact: true }).selectOption("card");
  await form.getByLabel("Teaching text", { exact: true }).fill("Hold it steady");
  await number(page, "Start time (seconds)", "5");
  await number(page, "End time (seconds)", "8.8");
  await number(page, "Screen Y", "420");
  await expect(form.getByRole("status").filter({ hasText: "near the caption area" })).toBeVisible();
  await form.getByText("Style and animation", { exact: true }).click();
  await form.getByLabel("Visual style", { exact: true }).selectOption("nature");
  await number(page, "Text size", "25");
  await form.getByText("Style and animation", { exact: true }).click();
  await number(page, "Screen Y", "60");
  await number(page, "Screen X", "375");
  await review(page);
  const card = preview(page).locator('[data-focus-kind="card"]');
  await expect(card).toHaveAttribute("data-focus-y", "60");
  await previewTime(page).fill("8.35");
  await expect(card).toHaveAttribute("data-focus-x", "375");
  await expect(card).toHaveAttribute("data-focus-y", "60");
  await expect(preview(page).locator("[data-caption-guide]")).toHaveCount(1);
  await expect(preview(page).locator(".caption-overlay")).toContainText("Hold it steady.");
  await form.locator(".interaction-review").scrollIntoViewIfNeeded();
  const screenshot = info.outputPath("focus-review.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await info.attach("reviewed teaching graphics", { path: screenshot, contentType: "image/png" });
  await apply(page);
  const graphics = (await backup(page)).data.scenes[0].focusGraphics!;
  expect(graphics[0].target).toMatchObject({ kind: "object", id: wagon.id, dx: 61 });
  expect(graphics[1]).toMatchObject({ style: "nature", textSize: 25, target: { kind: "screen", x: 375, y: 60 } });
});

test("suggests graphics from saved learning steps and transformations while preserving custom wording", async ({ page }) => {
  test.setTimeout(75_000);
  const project = transformExample("wagon");
  await restore(page, project);
  await button(page, "Write My Episode Script").click();
  const director = page.getByRole("dialog", { name: "Write My Episode Script" });
  await director.getByText("Teach It Step by Step", { exact: true }).click();
  await director.getByRole("button", { name: "Show This Step on Screen", exact: true }).click();
  await expect(dialog(page).getByLabel("Teaching text", { exact: true })).toHaveValue("Notice the wobble.");
  await dialog(page).getByLabel("Teaching text", { exact: true }).fill("Watch the little wagon");
  await review(page);
  await apply(page);
  await director.getByText("Teach It Step by Step", { exact: true }).click();
  await director.getByLabel("What will viewers learn?").fill("Notice what the loose wheel does.");
  await director.getByRole("button", { name: "Apply learning steps", exact: true }).click();
  await director.getByRole("button", { name: "Close dialog", exact: true }).click();
  await previewTab(page);
  await page.getByRole("button", { name: /Edit teaching graphic: Watch the little wagon.*review needed/ }).click();
  await expect(dialog(page).getByLabel("Teaching text", { exact: true })).toHaveValue("Watch the little wagon");
  await dialog(page).getByRole("button", { name: "Mark step suggestion reviewed", exact: true }).click();
  await review(page);
  await apply(page);
  await page.getByRole("button", { name: /Change Toy wagon to Wheel attached at 9.25 seconds/ }).click();
  const transform = page.getByRole("dialog", { name: "Show How Something Changes" });
  await transform.getByRole("button", { name: "Show this change on screen", exact: true }).click();
  await expect(dialog(page).getByText("Linked start · 9.25 s")).toBeVisible();
  await expect(dialog(page).getByLabel("Positioning", { exact: true })).toHaveValue("object");
  await review(page);
  await apply(page);
  const savedScene = (await backup(page)).data.scenes[0];
  expect(savedScene.focusGraphics![0].text).toBe("Watch the little wagon");
  expect(savedScene.focusGraphics![0].stepSource?.text).toBe("Notice what the loose wheel does.");
  expect(savedScene.focusGraphics![1].cue).toMatchObject({ kind: "change", id: savedScene.objectTracks![0].changes[0].id });
});

test("recovers a teaching target after deletion and restores it with undo", async ({ page }) => {
  test.setTimeout(65_000);
  const project = visualTeachingExample(transformExample("wagon"), "wagon");
  const wagon = project.scenes[0].elements.find(item => item.prop === "toy-wagon")!;
  await restore(page, project);
  const tab = button(page, "Edit scene");
  if (await tab.isVisible()) await tab.click();
  await page.getByLabel("Selected scene object").selectOption(wagon.id);
  await button(page, "Remove scene object").click();
  await expect(page.getByRole("status").filter({ hasText: "lost its target" })).toBeVisible();
  const deleted = (await backup(page)).data;
  expect(deleted.scenes[0].focusGraphics![0].target.kind).toBe("missing");
  await button(page, "Undo edit").click();
  expect((await backup(page)).data.scenes[0].focusGraphics![0].target).toMatchObject({ id: wagon.id });
  await button(page, "Redo edit").click();
  await previewTab(page);
  await page.getByRole("button", { name: /Edit teaching graphic: Circle This at 1.30 seconds.*review needed/ }).click();
  await dialog(page).getByRole("button", { name: "Keep this screen position", exact: true }).click();
  await review(page);
  await apply(page);
  expect((await backup(page)).data.scenes[0].focusGraphics![0].target.kind).toBe("screen");
});
