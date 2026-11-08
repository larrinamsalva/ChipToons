import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { backup } from "./production-helpers";

// Real small PNGs with four different colors. The browser decodes these,
// while ffmpeg independently checks the resulting *recorded WebM* frames.
const samples = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;

test("Framefield multi-shot importer builds two real scenes and exports matching colored frames", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–3 numbered sequences)",
  }).check();

  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    { name: "shot02_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(samples[3], "base64") },
    { name: "shot01_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(samples[1], "base64") },
    { name: "shot02_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(samples[2], "base64") },
    { name: "shot01_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(samples[0], "base64") },
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  await expect(picker.getByRole("status")).toContainText("2 shots in order");
  await expect(picker.getByRole("status")).toContainText("shot01_frame_");
  await expect(picker.getByRole("status")).toContainText("shot02_frame_");
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/new multi-shot cartoon is ready/i)).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data } = await backup(page);
    expect(data.scenes.map(scene => scene.duration)).toEqual([2, 2]);
    expect(data.scenes.map(scene => scene.transition)).toEqual(["cut", "cut"]);
    expect(data.scenes.every(scene => scene.elements.length === 1)).toBe(true);
    expect(data.assets.map(asset => asset.name)).toEqual([
      "shot01_frame_0001.png", "shot01_frame_0002.png",
      "shot02_frame_0001.png", "shot02_frame_0002.png",
    ]);
    expect(data.scenes[0].elements[0].frameSequence?.assetIds).toEqual(
      data.assets.slice(0, 2).map(asset => asset.id));
    expect(data.scenes[1].elements[0].frameSequence?.assetIds).toEqual(
      data.assets.slice(2).map(asset => asset.id));

    // The actual recorded movie must cross a real *scene boundary* instead
    // of looping the first shot's two source frames.
    await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
    const silent = page.getByRole("checkbox", { name: "Include mixed audio", exact: true });
    if (await silent.isEnabled() && await silent.isChecked()) await silent.uncheck();
    const captions = page.getByRole("checkbox", { name: "Include timed captions", exact: true });
    if (await captions.isEnabled() && await captions.isChecked()) await captions.uncheck();
    await page.getByRole("button", { name: "Export complete cartoon", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your movie is ready", exact: true }))
      .toBeVisible({ timeout: 90_000 });
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download completed video", exact: true }).click();
    const path = (await (await pending).path())!;
    const rgb = (seconds: number) =>
      execFileSync("ffmpeg", [
        "-v", "error", "-ss", String(seconds), "-i", path,
        "-vf", "crop=2:2:400:220", "-frames:v", "1",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
      ]);
    const first = rgb(0.35), last = rgb(3.35);
    expect(first.length).toBe(12);
    expect(last.length).toBe(12);
    expect(first[0]).toBeGreaterThan(first[1] + 55);
    expect(first[0]).toBeGreaterThan(first[2] + 55);
    expect(last[0]).toBeGreaterThan(last[2] + 60);
    expect(last[1]).toBeGreaterThan(last[2] + 60);
  }
});

test("Shot Director reorders shots and holds a real frame across the recorded WebM cut", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–3 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    { name: "shot02_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(samples[3], "base64") },
    { name: "shot01_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(samples[0], "base64") },
    { name: "shot02_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(samples[2], "base64") },
    { name: "shot01_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(samples[1], "base64") },
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  const director = picker.getByLabel("Shot Director", { exact: true });
  await expect(director.getByRole("list", { name: "Shot playback order" }).locator("li").first())
    .toContainText("shot01_frame_");
  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  await expect(director.getByRole("list", { name: "Shot playback order" }).locator("li").first())
    .toContainText("Shot 1 · shot02_frame_");
  await expect(picker.getByRole("status")).toContainText("Total 5 seconds");
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/new multi-shot cartoon is ready/i)).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data } = await backup(page);
    expect(data.scenes.map(scene => scene.duration)).toEqual([3, 2]);
    expect(data.scenes.map(scene => scene.transition)).toEqual(["cut", "cut"]);
    expect(data.assets.map(asset => asset.name)).toEqual([
      "shot02_frame_0001.png", "shot02_frame_0002.png",
      "shot01_frame_0001.png", "shot01_frame_0002.png",
    ]);
    await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
    const audio = page.getByRole("checkbox", { name: "Include mixed audio", exact: true });
    if (await audio.isEnabled() && await audio.isChecked()) await audio.uncheck();
    const captions = page.getByRole("checkbox", { name: "Include timed captions", exact: true });
    if (await captions.isEnabled() && await captions.isChecked()) await captions.uncheck();
    await page.getByRole("button", { name: "Export complete cartoon", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your movie is ready", exact: true }))
      .toBeVisible({ timeout: 90_000 });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download completed video", exact: true }).click();
    const path = (await (await download).path())!;
    const rgb = (seconds: number) => execFileSync("ffmpeg", [
      "-v", "error", "-ss", String(seconds), "-i", path,
      "-vf", "crop=2:2:400:220", "-frames:v", "1",
      "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ]);
    // Extra hold leaves the *real yellow image* visible near the end
    // of the first 3-second shot; the manually reordered second shot
    // starts with the *real red image* after that hard scene cut.
    const held = rgb(2.75), after = rgb(3.45);
    expect(held.length).toBe(12);
    expect(after.length).toBe(12);
    expect(held[0]).toBeGreaterThan(held[2] + 55);
    expect(held[1]).toBeGreaterThan(held[2] + 55);
    expect(after[0]).toBeGreaterThan(after[1] + 55);
    expect(after[0]).toBeGreaterThan(after[2] + 55);
  }
});

test("Framefield multi-shot importer rejects incomplete shots before creating or changing a cartoon", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–3 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    { name: "shot01_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(samples[0], "base64") },
    { name: "shot01_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(samples[1], "base64") },
    { name: "shot02_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(samples[2], "base64") },
    { name: "shot02_frame_0003.png", mimeType: "image/png", buffer: Buffer.from(samples[3], "base64") },
  ]);
  await expect(picker.getByRole("alert")).toContainText("missing or duplicate");
  await expect(picker.getByRole("button", { name: "Create multi-shot cartoon" })).toBeDisabled();
  await expect(page.locator(".editor")).toHaveCount(0);
});
