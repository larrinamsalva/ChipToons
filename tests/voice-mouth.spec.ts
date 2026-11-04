import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { backup, saved } from "./production-helpers";

const title = "A Hello Heart — Shine Says Hello";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const modal = (page: Page) => page.getByRole("dialog");
const select = (page: Page, name: string) => modal(page).getByRole("combobox", { name, exact: true });
const proposal = (page: Page) => modal(page).getByRole("figure").nth(1).locator("[data-voice-opening]");

async function demo(page: Page) {
  await page.goto("./");
  await button(page, "Try Shine Says Hello").click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await saved(page);
}

async function openStudio(page: Page) {
  await button(page, "Make My Character Talk").click();
  await expect(modal(page).getByRole("heading", { name: "Make My Character Talk" })).toBeVisible();
  await select(page, "Recorded voice").selectOption({ index: 1 });
}

async function analyze(page: Page) {
  await button(page, "Analyze recording").click();
  await expect(modal(page).getByText("Mouth animation suggested", { exact: true })).toBeVisible();
}

async function at(page: Page, seconds: number) {
  const field = modal(page).getByRole("spinbutton", { name: "Preview scene time (seconds)", exact: true });
  await field.fill(String(seconds));
  await field.press("Enter");
}

async function audit(page: Page) {
  expect(await modal(page).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}

test("compares real voice, cancels safely, corrects a mouth cue, and reopens the approved animation", async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.goto("./");
  await button(page, "Switch to dark theme").click();
  await button(page, "Try Shine Says Hello").click();
  await saved(page);
  const original = (await backup(page)).data;
  await openStudio(page);
  await expect(select(page, "Talking character").locator("option:checked")).toHaveText(/Shine/);
  await analyze(page);
  await at(page, 0.72);
  await expect.poll(async () => Number(await proposal(page).getAttribute("data-voice-opening"))).toBeGreaterThan(0.2);
  await audit(page);
  await modal(page).getByRole("region", { name: "Mouth animation comparison" })
    .evaluate(node => node.scrollIntoView({ block: "start" }));
  await info.attach("mouth-studio", { body: await modal(page).screenshot(), contentType: "image/png" });
  await button(page, "Cancel").click();
  expect((await backup(page)).data.scenes[0].elements[0]).toEqual(original.scenes[0].elements[0]);
  await openStudio(page);
  await analyze(page);
  await button(page, "Play comparison with sound").click();
  await expect(button(page, "Pause comparison")).toBeVisible();
  await button(page, "Pause comparison").click();
  await select(page, "Talking style").selectOption("expressive");
  await at(page, 3.1);
  await expect(proposal(page)).toHaveAttribute("data-voice-opening", "0");
  await at(page, 0.72);
  await modal(page).getByText("Correct the mouth at the playhead", { exact: true }).click();
  await button(page, "Close mouth here").press("Enter");
  await expect(proposal(page)).toHaveAttribute("data-voice-opening", "0");
  await button(page, "Apply mouth animation").click();
  await saved(page);
  const applied = (await backup(page)).data;
  expect(applied.scenes[0].elements[0].voiceMouth?.[0]).toMatchObject({
    preset: "expressive", corrections: [{ start: expect.any(Number), end: expect.any(Number), opening: 0 }],
  });
  expect(applied.scenes[0].elements[0].animation).toEqual(original.scenes[0].elements[0].animation);
  expect(applied.audioAssets).toEqual(original.audioAssets);
  await button(page, "Undo edit").click();
  expect((await backup(page)).data.scenes[0].elements[0].voiceMouth).toBeUndefined();
  await button(page, "Redo edit").click();
  await saved(page);
  await button(page, "Save and return to my cartoons").click();
  await page.reload();
  await button(page, `Continue ${title}`).click();
  await openStudio(page);
  await expect(modal(page).getByText("Applied", { exact: true })).toBeVisible();
  await at(page, 0.72);
  await expect(proposal(page)).toHaveAttribute("data-voice-opening", "0");
});

test("uses an approved script line, restores the cue from a complete package, and flags an edited trim", async ({ page }, info) => {
  test.setTimeout(60_000);
  await demo(page);
  await button(page, "Write My Episode Script").click();
  await button(page, "Animate This Voice").click();
  await expect(select(page, "Talking character").locator("option:checked")).toHaveText(/Shine/);
  await analyze(page);
  await audit(page);
  await info.attach("script-voice-shortcut", { body: await modal(page).screenshot(), contentType: "image/png" });
  await button(page, "Apply mouth animation").click();
  await expect(modal(page).getByText("Mouth animation · Applied", { exact: true })).toBeVisible();
  await button(page, "Edit audio timing").click();
  await button(page, "Enable long-episode audio").click();
  await expect(modal(page).getByRole("heading", { name: "Long-episode audio is enabled" })).toBeVisible();
  await button(page, "Back to cartoon").click();
  await button(page, "Close dialog").click();
  await saved(page);
  const pending = page.waitForEvent("download");
  await button(page, "Project backup").click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/\.ctepisode$/);
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "shine.ctepisode", mimeType: "application/octet-stream",
    buffer: await readFile((await file.path())!),
  });
  await expect(page.getByRole("status").filter({ hasText: "Backup restored as a separate project" })).toBeVisible();
  await saved(page);
  await button(page, "Write My Episode Script").click();
  await expect(modal(page).getByText("Mouth animation · Applied", { exact: true })).toBeVisible();
  await button(page, "Edit audio timing").click();
  const trim = modal(page).getByRole("spinbutton", { name: "Trim start (seconds)", exact: true });
  await trim.fill("0.15");
  await trim.press("Enter");
  await button(page, "Back to cartoon").click();
  await expect(modal(page).getByText("Mouth animation · Needs timing review", { exact: true })).toBeVisible();
  await button(page, "Close dialog").click();
  await openStudio(page);
  await expect(modal(page).getByText(/Needs timing review. The clip/)).toBeVisible();
  await expect(button(page, "Apply mouth animation")).toBeDisabled();
});

test("an analyzed draft cannot overwrite the active project after a second tab takes over", async ({ page, context }) => {
  await demo(page);
  await openStudio(page);
  await analyze(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await button(other, `Continue ${title}`).click();
  await expect(other.getByRole("status").filter({ hasText: "Open read-only" })).toBeVisible();
  await button(other, "Edit in This Tab").click();
  await button(other, "Take Over Editing").click();
  await expect(other.locator(".editor")).toBeVisible();
  await button(page, "Apply mouth animation").click();
  await expect(page.getByRole("status").filter({ hasText: /Saving paused/ }).first()).toBeVisible();
  expect((await backup(other)).data.scenes[0].elements[0].voiceMouth).toBeUndefined();
  expect((await backup(page)).data.scenes[0].elements[0].voiceMouth).toHaveLength(1);
});
