import { test, expect } from "@playwright/test";
import { backup } from "./production-helpers";
import { execFileSync } from "node:child_process";

const samples = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;

test("Framefield bridge creates a local editable animation from real ordered PNGs", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  const files = samples.map((_, i) => ({
    name: `shot_000${4 - i}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(samples[3 - i], "base64"),
  }));
  // Intentionally select in descending order: importer must sort by frame
  // number and must never trust the native file-input ordering.
  await picker.getByLabel("Choose numbered PNG files").setInputFiles(files);
  await expect(picker.getByRole("status")).toContainText("4 frames in order");
  await picker.getByLabel("Animation playback speed").selectOption("2");
  await picker.getByRole("button", { name: "Create cartoon from numbered PNGs" }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/new numbered-PNG animation is ready/i)).toBeVisible();

  // Real browser decoding + app project creation are exercised above on all
  // three viewports; only desktop also verifies the actual portable backup.
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data } = await backup(page);
    expect(data.scenes).toHaveLength(1);
    expect(data.scenes[0].elements).toHaveLength(1);
    expect(data.scenes[0].elements[0].frameSequence).toEqual({
      fps: 2,
      assetIds: data.assets.map(a => a.id),
    });
    expect(data.assets.map(a => a.name)).toEqual([
      "shot_0001.png", "shot_0002.png", "shot_0003.png", "shot_0004.png",
    ]);

    // Produce a GENUINE two-second WebM from the imported sequence and
    // independently decode its actual colored pixel frames using FFmpeg.
    await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
    const silent = page.getByRole("checkbox", { name: "Include mixed audio", exact: true });
    if (await silent.isEnabled() && await silent.isChecked()) await silent.uncheck();
    const captions = page.getByRole("checkbox", { name: "Include timed captions", exact: true });
    if (await captions.isEnabled() && await captions.isChecked()) await captions.uncheck();
    await page.getByRole("button", { name: "Export complete cartoon", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your movie is ready", exact: true }))
      .toBeVisible({ timeout: 60_000 });
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download completed video", exact: true }).click();
    const path = (await (await pending).path())!;
    const rgb = (seconds: number) =>
      execFileSync("ffmpeg", [
        "-v", "error", "-ss", String(seconds), "-i", path,
        "-vf", "crop=2:2:400:220", "-frames:v", "1",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
      ]);
    const first = rgb(0.35), last = rgb(1.8);
    expect(first.length).toBe(12);
    expect(last.length).toBe(12);
    // 2x2 sample PNGs are solid saturated colors. The independent video
    // decoder must see the correct *ordered* source images, not a poster.
    expect(first[0]).toBeGreaterThan(first[1] + 55); // red frame
    expect(first[0]).toBeGreaterThan(first[2] + 55);
    expect(last[0]).toBeGreaterThan(last[2] + 60); // yellow frame
    expect(last[1]).toBeGreaterThan(last[2] + 60);
  }
});

test("Framefield bridge refuses gaps before opening a new cartoon", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    { name: "shot_0001.png", mimeType: "image/png", buffer: Buffer.from(samples[0], "base64") },
    { name: "shot_0003.png", mimeType: "image/png", buffer: Buffer.from(samples[1], "base64") },
  ]);
  await expect(picker.getByRole("alert")).toContainText("missing or duplicate");
  await expect(picker.getByRole("button", { name: "Create cartoon from numbered PNGs" })).toBeDisabled();
  await expect(page.locator(".editor")).toHaveCount(0);
});
