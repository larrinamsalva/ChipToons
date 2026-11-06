import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  isLittleFixersVoiceProject,
  littleFixersVoiceCueSheet,
  littleFixersVoiceReadiness,
} from "../src/little-fixers-voice-readiness";
import { backup, saved } from "./production-helpers";

const BOARD = "Little Fixers · Finish the Voices";
const DEMO = "Watch Scout and the wobbly chair (1:30)";

test("Little Fixers voice board truthfully identifies four unrecorded lines without changing approved takes", async ({ page }) => {
  test.setTimeout(130_000);
  await page.goto("./");
  await page.getByRole("button", { name: DEMO, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 55_000 });
  await saved(page);
  const before = (await backup(page)).data;
  expect(isLittleFixersVoiceProject(before)).toBe(true);
  const progress = littleFixersVoiceReadiness(before);
  expect(progress.total).toBe(7);
  expect(progress.approved).toBe(3);
  expect(progress.unrecorded).toBe(4);
  expect(progress.complete).toBe(false);
  expect(progress.lines.slice(0, 3).every(line => line.approved && line.mouthReady && line.captionReady)).toBe(true);
  expect(progress.lines.slice(3).every(line => !line.approved && !line.captionReady)).toBe(true);
  expect(progress.lines.filter(line => line.needsMouth && line.mouthReady)).toHaveLength(3);

  await page.getByRole("button", { name: "Finish the Little Fixers voices", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: BOARD });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("3 of 7 script lines approved")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Record scene/ })).toHaveCount(4);
  await expect(dialog.getByText("This version is not fully voiced yet.", { exact: false })).toBeVisible();
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download voice recording cue sheet" }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/voice-cues\.txt$/);
  const contents = await readFile((await file.path())!, "utf8");
  expect(contents).toContain("3/7 approved recordings; 4 unrecorded lines.");
  expect(contents).toContain("That chair is wobbling.");
  expect(contents).toContain("a trusted grown-up");
  expect(contents).toContain("not a finished Little Fixers episode");

  await dialog.getByRole("button", { name: "Record scene 2 line 1", exact: true }).click();
  const recording = page.getByRole("dialog", { name: "Record This Line" });
  await expect(recording).toBeVisible();
  await expect(recording.getByText("First we make a picture plan.", { exact: false })).toBeVisible();
  await recording.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Finish the Little Fixers voices", exact: true }).click();
  await expect(page.getByRole("dialog", { name: BOARD })).toBeVisible();
  await page.getByRole("dialog", { name: BOARD })
    .getByRole("button", { name: "Return to my cartoon" }).click();
  const after = (await backup(page)).data;
  expect(after.scenes).toEqual(before.scenes);
  expect(after.audioClips).toEqual(before.audioClips);
  expect(after.captions).toEqual(before.captions);
});

test("voice cue sheet and progress derive from actual saved recording status, not the template title", async ({ page }) => {
  test.setTimeout(110_000);
  await page.goto("./");
  await page.getByRole("button", { name: DEMO, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 55_000 });
  const { data } = await backup(page);
  const cue = littleFixersVoiceCueSheet(data);
  expect(cue.match(/Scene \d+, line \d+:/g)).toHaveLength(7);
  expect(cue).toContain("Scene 3, line 2:");
  expect(isLittleFixersVoiceProject({ ...data, templateId: "not-little-fixers" })).toBe(false);
  expect(littleFixersVoiceReadiness({ ...data, captions: [] }).captionReady).toBe(0);
});
