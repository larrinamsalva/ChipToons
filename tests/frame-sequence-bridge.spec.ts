import { test, expect } from "@playwright/test";
import { backup } from "./production-helpers";

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
  const files = samples.map((contents, i) => ({
    name: `shot_000${4 - i}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(contents, "base64"),
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
  if ((page.viewportSize()?.width ?? 0) >= 700) {
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
