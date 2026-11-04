import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { movieProofArtwork, segmentedProject } from "./creator-fixtures";
import { downloadAndVerifyMovie } from "./single-movie-proof";
import { backup, restore, saved } from "./production-helpers";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const pickVideos = (page: Page) => dialog(page).getByLabel("Choose video files", { exact: true });

async function exportPart(page: Page, index: number) {
  await button(page, `Export segment ${index}`).click();
  await expect(dialog(page).getByRole("heading", { name: `Segment ${index} is ready` })).toBeVisible({ timeout: 20_000 });
  const pending = page.waitForEvent("download");
  await button(page, `Download segment ${index}`).click();
  const movie = await pending;
  const path = (await movie.path())!;
  const buffer = await readFile(path);
  await button(page, "Close segment preview").click();
  return { path, buffer, name: movie.suggestedFilename(), mimeType: "video/webm" };
}

test("checks two genuine parts, resumes the existing exporter, watches in order and checks the downloaded ZIP", async ({ page }, info) => {
  test.setTimeout(120_000);
  const project = segmentedProject(movieProofArtwork);
  await page.goto("./");
  if (info.project.name !== "tablet") await button(page, "Switch to dark theme").click();
  await restore(page, project);
  await saved(page);
  const before = (await backup(page)).data;
  await button(page, "Finish My Cartoon").click();
  await dialog(page).getByRole("checkbox", { name: "Include timed captions", exact: true }).uncheck();
  const limit = dialog(page).getByRole("spinbutton", { name: "Maximum seconds per segment", exact: true });
  await limit.fill("4");
  await limit.press("Enter");
  const first = await exportPart(page, 1);
  const second = await exportPart(page, 2);
  await button(page, "Prepare My Complete Episode").press("Enter");
  await expect(dialog(page).getByRole("heading", { name: "Prepare My Complete Episode", exact: true })).toBeVisible();
  await expect(dialog(page).getByRole("status").filter({ hasText: /0 of 2 parts assigned/ })).toBeVisible();
  await pickVideos(page).setInputFiles({ name: "renamed-first.webm", mimeType: first.mimeType, buffer: first.buffer });
  await expect(dialog(page).getByRole("status").filter({ hasText: /1 of 2 parts assigned · 1 missing/ })).toBeVisible();
  await expect(dialog(page).getByText("Exact recorded export match", { exact: true })).toBeVisible();
  await expect(button(page, "Watch My Episode")).toBeDisabled();
  await button(page, "Re-Export Missing Part 2").press("Enter");
  await expect(button(page, "Export segment 2")).toBeFocused();
  await button(page, "Prepare My Complete Episode").click();
  await expect(dialog(page).getByRole("status").filter({ hasText: /1 of 2 parts assigned · 1 missing/ })).toBeVisible();
  await pickVideos(page).setInputFiles([
    { name: "duplicate.webm", mimeType: first.mimeType, buffer: first.buffer },
    { name: "broken.webm", mimeType: "video/webm", buffer: Buffer.alloc(1300) },
  ]);
  await expect(dialog(page).getByRole("region", { name: "Invalid and duplicate files" })).toContainText("These exact video bytes are already in the delivery list");
  await expect(dialog(page).getByRole("status").filter({ hasText: /2 invalid/ })).toBeVisible();
  await button(page, "Remove rejected file duplicate.webm").click();
  await button(page, "Remove rejected file broken.webm").click();
  // The same session can still check older downloads whose receipt is unavailable.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("chiptoons-delivery-receipts:")) localStorage.removeItem(key);
  });
  await pickVideos(page).setInputFiles({ name: second.name, mimeType: second.mimeType, buffer: second.buffer });
  await expect(dialog(page).getByText("The file name suggests part 2. Confirm where it belongs.", { exact: true })).toBeVisible();
  await button(page, "Confirm part assignment").press("Enter");
  const ready = dialog(page).getByRole("status").filter({ hasText: /2 of 2 parts assigned.*Ready for delivery/ });
  await expect(ready).toBeVisible();
  await button(page, "Remove part 2 from delivery list").click();
  await expect(button(page, "Watch My Episode")).toBeDisabled();
  const add = page.waitForEvent("filechooser");
  await button(page, "Add missing part 2").click();
  await (await add).setFiles({ name: second.name, mimeType: second.mimeType, buffer: second.buffer });
  await expect(ready).toBeVisible();
  const replace = page.waitForEvent("filechooser");
  await button(page, "Replace selected part 2").click();
  await (await replace).setFiles({ name: "confirmed-replacement.webm", mimeType: second.mimeType, buffer: second.buffer });
  await expect(dialog(page).getByText(/confirmed-replacement.webm/)).toBeVisible();
  await button(page, "Check Parts").click();
  await expect(dialog(page).getByRole("status").filter({ hasText: /checked bytes and the part list is complete/ })).toBeVisible();
  expect(await dialog(page).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await dialog(page).getByRole("list", { name: "Expected part order" }).evaluate(node => node.scrollIntoView({ block: "start" }));
  await info.attach("delivery-workspace", { body: await dialog(page).screenshot(), contentType: "image/png" });
  await button(page, "Watch My Episode").press("Enter");
  const video = dialog(page).getByLabel("Episode part video", { exact: true });
  await dialog(page).getByRole("checkbox", { name: "Show separate subtitles", exact: true }).check();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.textTracks[0]?.cues?.length ?? 0)).toBe(2);
  await video.evaluate((el: HTMLVideoElement) => el.play());
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0.15);
  await expect(dialog(page).getByRole("status").filter({ hasText: /Part 2 · scenes 3–4/ })).toBeVisible({ timeout: 9_000 });
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0.15);
  await expect(dialog(page).getByText("You reached the end of the episode.", { exact: true })).toBeVisible({ timeout: 9_000 });
  await button(page, "Previous part").press("Enter");
  await expect(dialog(page).getByRole("status").filter({ hasText: /Part 1 · scenes 1–2/ })).toBeVisible();
  await button(page, "Back to delivery list").click();
  const pending = page.waitForEvent("download");
  await button(page, "Download Episode Delivery Package").click();
  const archive = await pending;
  expect(archive.suggestedFilename()).toMatch(/-episode-delivery\.zip$/);
  const archivePath = info.outputPath(archive.suggestedFilename());
  await archive.saveAs(archivePath);
  const entries = execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" }).trim().split("\n");
  expect(entries).toEqual(["README.txt", "part-01-scenes-1-2.webm", "part-01-scenes-1-2.srt",
    "part-02-scenes-3-4.webm", "part-02-scenes-3-4.srt", "part-order.json"]);
  execFileSync("unzip", ["-tq", archivePath]);
  const manifest = JSON.parse(execFileSync("unzip", ["-p", archivePath, "part-order.json"], { encoding: "utf8" }));
  expect(manifest.parts.map((part: { video: { sha256: string } }) => part.video.sha256))
    .toEqual([first, second].map(movie => createHash("sha256").update(movie.buffer).digest("hex")));
  expect(manifest.parts.map((part: { start: number }) => part.start)).toEqual([0, 4]);
  expect(manifest.parts.map((part: { identity: string }) => part.identity)).toEqual(["recorded-export", "creator-assigned"]);
  await dialog(page).getByLabel("Choose a delivery package", { exact: true }).setInputFiles(archivePath);
  await expect(dialog(page).getByRole("heading", { name: "Package checks passed" })).toBeVisible();
  await button(page, "Watch Checked Package").click();
  await expect(dialog(page).getByRole("status").filter({ hasText: /Part 1 · Scenes 1–2/ })).toBeVisible();
  await button(page, "Back to delivery list").click();
  const makeMovie = button(page, "Make One Complete Movie");
  if (info.project.name === "phone") {
    await expect(makeMovie).toBeDisabled();
    await expect(dialog(page).getByText(/Make one movie on a larger screen/)).toBeVisible();
    await info.attach("movie-phone-fallback", { body: await dialog(page).getByRole("region", { name: "Single-movie builder" }).screenshot(), contentType: "image/png" });
  } else {
    await expect(makeMovie).toBeEnabled();
    await page.evaluate(() => {
      const storage = navigator.storage;
      Object.defineProperty(storage, "estimate", { configurable: true, value: async () => ({ usage: 5000, quota: 5010 }) });
    });
    await makeMovie.press("Enter");
    await expect(dialog(page).getByRole("alert")).toContainText("There isn’t enough estimated local storage");
    await expect(button(page, "Download Episode Delivery Package")).toBeEnabled();
    await page.evaluate(() => {
      const storage = navigator.storage;
      Reflect.deleteProperty(storage, "estimate");
      const estimate = storage.estimate.bind(storage);
      Object.defineProperty(storage, "estimate", { configurable: true, value: () => new Promise(resolve => {
        document.addEventListener("release-test-estimate", () => { void estimate().then(resolve); }, { once: true });
        document.documentElement.dataset.testEstimate = "waiting";
      }) });
    });
    await makeMovie.click();
    await expect(page.locator("html")).toHaveAttribute("data-test-estimate", "waiting");
    await button(page, "Cancel delivery operation").click();
    await page.evaluate(() => {
      document.dispatchEvent(new Event("release-test-estimate"));
      Reflect.deleteProperty(navigator.storage, "estimate");
    });
    await expect(dialog(page).getByRole("status").filter({ hasText: /Cancelled/ })).toBeVisible();
    await makeMovie.press("Enter");
    const media = await downloadAndVerifyMovie(page, info, [first.path, second.path], [4, 4]);
    expect(media.parts[1].start).toBeGreaterThan(4);
    const subtitlePending = page.waitForEvent("download");
    await button(page, "Download Complete Movie Subtitles").click();
    const subtitle = await subtitlePending;
    expect(subtitle.suggestedFilename()).toMatch(/-complete\.srt$/);
    const text = await readFile((await subtitle.path())!, "utf8");
    expect(text).toContain("00:00:00,400 --> 00:00:01,750");
    const timestamp = (time: number) => `00:00:${(time.toFixed(3)).padStart(6, "0").replace(".", ",")}`;
    expect(text).toContain(`3\n${timestamp(media.parts[1].start + 0.4)} --> ${timestamp(media.parts[1].start + 1.75)}\nScene 3`);
    await button(page, "Preview Complete Movie").press("Enter");
    const movie = dialog(page).getByLabel("Complete episode video");
    await expect(movie).toBeVisible();
    await dialog(page).getByRole("checkbox", { name: "Show separate subtitles", exact: true }).check();
    await expect.poll(() => movie.evaluate((el: HTMLVideoElement) => el.textTracks[0]?.cues?.length ?? 0)).toBe(4);
    expect((await new AxeBuilder({ page }).include("dialog")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await info.attach("movie-desktop-preview", { body: await dialog(page).screenshot(), contentType: "image/png" });
    await button(page, "Back to delivery list").click();
  }
  await dialog(page).getByRole("button", { name: "Close dialog", exact: true }).click();
  expect((await backup(page)).data).toEqual(before);
  await info.attach("delivery-package", { path: archivePath, contentType: "application/zip" });
  await info.attach("delivery-part-1", { body: first.buffer, contentType: "video/webm" });
  await info.attach("delivery-part-2", { body: second.buffer, contentType: "video/webm" });
  await info.attach("delivery-manifest", { body: JSON.stringify(manifest, null, 2), contentType: "application/json" });
});
