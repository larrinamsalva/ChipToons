import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gardenInteractionDemo } from "../src/garden-demo";
import { soundAnchorKey } from "../src/sound-cues";
import { SOUND_DIRECTOR_TITLE } from "../src/sound-director";
import { gardenSoundDemo, SOUND_GARDEN_TITLE } from "../src/sound-garden-demo";
import { backup, number, restore, saved } from "./production-helpers";

test.use({ actionTimeout: 12_000 });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: SOUND_DIRECTOR_TITLE });
async function editTab(page: Page) {
  const tab = button(page, "Edit scene");
  if (await tab.isVisible()) await tab.click();
}
async function open(page: Page) {
  await editTab(page);
  await button(page, SOUND_DIRECTOR_TITLE).click();
  return dialog(page);
}
async function review(page: Page) {
  await dialog(page).getByRole("button", { name: "Preview sound with animation", exact: true }).press("Enter");
}
async function apply(page: Page) {
  await dialog(page).getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog(page)).toBeHidden();
}

test("previews the ordinary audio schedule, links an effect, and keeps it in sync after retiming and replacing", async ({ page }, info) => {
  test.setTimeout(95_000);
  await page.addInitScript(() => {
    const starts: { delay: number; duration?: number }[] = [];
    Object.assign(window, { effectPreviewStarts: starts });
    const nodes = new WeakMap<AudioBufferSourceNode, { when: number; entry: (typeof starts)[number] }>();
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      const entry = { delay: when - this.context.currentTime, duration };
      starts.push(entry);
      nodes.set(this, { when, entry });
      return duration === undefined ? start.call(this, when, offset) : start.call(this, when, offset, duration);
    };
    AudioBufferSourceNode.prototype.stop = function (when = 0) {
      const source = nodes.get(this);
      if (source && when >= source.when) source.entry.duration = when - source.when;
      return stop.call(this, when);
    };
  });
  const project = gardenInteractionDemo();
  const [action] = project.scenes[0].interactions!;
  await restore(page, project);
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  let form = await open(page);
  const attach = soundAnchorKey({ kind: "action", id: action.id, moment: "Attach" });
  await form.getByRole("combobox", { name: "What happens in the scene?" }).selectOption(attach);
  await form.getByRole("button", { name: "Use suggested sound · Soft object pickup" }).click();
  await number(page, "Offset from action (seconds)", "0.15");
  await expect(form.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
  await review(page);
  const preview = form.getByRole("region", { name: "Proposed scene preview" });
  await expect(preview.getByLabel("Sound in preview")).toBeChecked();
  await preview.getByRole("button", { name: "Preview this scene", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as {
    effectPreviewStarts: { delay: number; duration?: number }[];
  }).effectPreviewStarts.some(item => item.delay > 0.3 && item.delay < 0.6 && Math.abs((item.duration ?? 0) - 0.46) < 0.02))).toBe(true);
  await preview.getByRole("spinbutton", { name: "Preview time (seconds)" }).fill("2.65");
  await expect(preview.locator(`[data-element-id="${action.objectId}"]`)).toHaveAttribute("data-held-by", action.actorId);
  const size = await form.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
  expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await form.locator(".interaction-review").scrollIntoViewIfNeeded();
  const screenshot = info.outputPath("sound-action-review.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await info.attach("audio cue and reviewed garden action", { path: screenshot, contentType: "image/png" });
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await backup(page)).data.audioClips).toEqual([]);

  form = await open(page);
  await form.getByRole("combobox", { name: "What happens in the scene?" }).selectOption(attach);
  await form.getByRole("button", { name: "Use suggested sound · Soft object pickup" }).click();
  await number(page, "Offset from action (seconds)", "0.15");
  await review(page);
  await apply(page);
  const [original] = (await backup(page)).data.audioClips;
  expect(original.start).toBeCloseTo(2.57);
  const stageTab = button(page, "Preview");
  if (await stageTab.isVisible()) await stageTab.click();
  await page.getByRole("button", { name: /Water a Plant Attach at/ }).click();
  await number(page, "Attach", "2.7");
  const actionForm = page.getByRole("dialog", { name: "Make My Character Do Something" });
  await actionForm.getByRole("button", { name: "Preview", exact: true }).click();
  await actionForm.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await backup(page)).data.audioClips[0].start).toBeCloseTo(2.85);
  form = await open(page);
  await form.getByRole("combobox", { name: "Saved sound" }).selectOption(original.id);
  await form.getByRole("combobox", { name: "Choose a sound" }).selectOption("original:place");
  await review(page);
  await apply(page);
  const replaced = (await backup(page)).data;
  expect(replaced.audioClips).toHaveLength(1);
  expect(replaced.audioClips[0]).toMatchObject({ id: original.id, name: "Wooden object set down" });
  expect(replaced.audioAssets).toHaveLength(2);
  await button(page, "Undo edit").click();
  expect((await backup(page)).data.audioClips[0].assetId).toBe(original.assetId);
  await button(page, "Redo edit").click();
  await saved(page);
  await page.reload();
  await button(page, `Continue ${project.title}`).click();
  form = await open(page);
  await form.getByRole("combobox", { name: "Saved sound" }).selectOption(original.id);
  await expect(form.getByRole("combobox", { name: "What happens in the scene?" })).toHaveValue(attach);
});

test("reviews and continues a location atmosphere without adding sounds from the template automatically", async ({ page }) => {
  test.setTimeout(65_000);
  const project = gardenSoundDemo();
  project.audioAssets = [];
  project.audioClips = [];
  await restore(page, project);
  await editTab(page);
  await button(page, "Build My Cartoon World").click();
  const preset = page.getByRole("combobox", { name: "Suggested atmosphere for this location" });
  await preset.selectOption("rain");
  expect((await backup(page)).data.audioClips).toEqual([]);
  await button(page, "Review location atmosphere").click();
  const form = dialog(page);
  await expect(form.getByRole("combobox", { name: "Suggested location atmosphere" })).toHaveValue("rain");
  await form.getByRole("button", { name: "Use this atmosphere", exact: true }).click();
  await form.getByRole("combobox", { name: "Continue atmosphere through" }).selectOption(project.scenes[1].id);
  await number(page, "Fade out (seconds)", "1.25");
  await review(page);
  await apply(page);
  const result = (await backup(page)).data;
  expect(result.audioClips).toHaveLength(1);
  expect(result.audioClips[0]).toMatchObject({ start: 0, duration: 20, loop: true, fadeOut: 1.25,
    ambience: { first: project.scenes[0].id, last: project.scenes[1].id } });
  expect(result.audioAssets).toHaveLength(1);
});

test("shows optional dialogue-balance reminders with real voiced demo audio", async ({ page }) => {
  test.setTimeout(65_000);
  await page.goto("./");
  await page.getByText("Try a Sound Director example", { exact: true }).click();
  await button(page, SOUND_GARDEN_TITLE).click();
  await expect(page.locator(".editor")).toBeVisible();
  const form = await open(page);
  await form.getByRole("combobox", { name: "Choose a scene" }).selectOption("1");
  await form.getByRole("combobox", { name: "Choose a sound" }).selectOption("original:success");
  await number(page, "Start in this scene (seconds)", "0.75");
  await number(page, "Sound volume (%)", "100");
  await review(page);
  await expect(form.getByRole("list", { name: "Sound review notes" })).toContainText("Listen for loud sounds over dialogue");
  await apply(page);
  await button(page, "Finish My Cartoon").click();
  const checklist = page.getByRole("region", { name: "Production readiness checklist" });
  await expect(checklist).toContainText("No blocking content problems found");
  await checklist.locator("summary").click();
  await expect(checklist.getByText(/Listen for loud sounds over dialogue.*optional/)).toBeVisible();
});
