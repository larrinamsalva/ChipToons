import { test, expect } from "@playwright/test";

const samples = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;

function png(name: string, index: number) {
  return { name, mimeType: "image/png",
    buffer: Buffer.from(samples[index], "base64") };
}

test("single-shot local preview scrubs actual PNGs and revokes temporary frame URLs", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await page.evaluate(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    (window as unknown as { revokedPreviewUrls: string[] }).revokedPreviewUrls = [];
    URL.revokeObjectURL = (url: string) => {
      (window as unknown as { revokedPreviewUrls: string[] }).revokedPreviewUrls.push(url);
      revoke(url);
    };
  });
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("frame_0002.png", 1), png("frame_0001.png", 0),
  ]);
  const preview = picker.getByRole("region", { name: "Preview of single-shot" });
  const image = preview.getByRole("img");
  await expect(image).toHaveAttribute("alt", /Frame 1 of 2.*frame_0001\.png/);
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBe(2);
  const firstUrl = (await image.getAttribute("src"))!;
  expect(firstUrl).toMatch(/^blob:/);
  await preview.getByRole("button", { name: "Next frame of single-shot" }).click();
  await expect(image).toHaveAttribute("alt", /Frame 2 of 2.*frame_0002\.png/);
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBe(2);
  const secondUrl = (await image.getAttribute("src"))!;
  expect(secondUrl).toMatch(/^blob:/);
  expect(secondUrl).not.toBe(firstUrl);
  await expect.poll(() => page.evaluate((url) =>
    (window as unknown as { revokedPreviewUrls: string[] }).revokedPreviewUrls.includes(url), firstUrl))
    .toBe(true);
  await preview.getByRole("button", { name: "Previous frame of single-shot" }).click();
  await expect(image).toHaveAttribute("alt", /Frame 1 of 2/);
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([]);
  await expect(preview).toHaveCount(0);
  await expect.poll(() => page.evaluate((url) =>
    (window as unknown as { revokedPreviewUrls: string[] }).revokedPreviewUrls.includes(url), secondUrl))
    .toBe(true);
  await expect(page.locator(".editor")).toHaveCount(0);
});

test("Visual Shot Storyboard follows manual shot ordering without changing selected PNGs", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–3 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("shot02_frame_0002.png", 3),
    png("shot01_frame_0002.png", 1),
    png("shot02_frame_0001.png", 2),
    png("shot01_frame_0001.png", 0),
  ]);
  const director = picker.getByRole("region", { name: "Shot Director" });
  const list = director.getByRole("list", { name: "Shot playback order" });
  const first = list.locator("li").nth(0);
  const second = list.locator("li").nth(1);
  await expect(first).toContainText("shot01_frame_");
  await expect(second).toContainText("shot02_frame_");
  const firstPreview = director.getByRole("region", { name: "Preview of shot01_frame_" });
  const secondPreview = director.getByRole("region", { name: "Preview of shot02_frame_" });
  await expect.poll(() => firstPreview.getByRole("img").evaluate(
    (node: HTMLImageElement) => node.naturalWidth)).toBe(2);
  await expect.poll(() => secondPreview.getByRole("img").evaluate(
    (node: HTMLImageElement) => node.naturalWidth)).toBe(2);
  await firstPreview.getByRole("button", { name: "Next frame of shot01_frame_" }).click();
  await expect(firstPreview.getByRole("img")).toHaveAttribute(
    "alt", /Frame 2 of 2.*shot01_frame_0002\.png/);
  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await expect(first).toContainText("Shot 1 · shot02_frame_");
  await expect(second).toContainText("Shot 2 · shot01_frame_");
  await expect(firstPreview.getByRole("img")).toHaveAttribute(
    "alt", /Frame 2 of 2.*shot01_frame_0002\.png/);
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  await expect(picker.getByRole("status")).toContainText("Total 5 seconds");

  // Resetting selection must remove old previews, but must not change
  // the contents of any previously saved cartoon.
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([]);
  await expect(director).toHaveCount(0);
  await expect(page.locator(".editor")).toHaveCount(0);
});

test("corrupt frame selections cannot show a trusted visual shot storyboard", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–3 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("shot01_frame_0001.png", 0),
    png("shot01_frame_0003.png", 1),
    png("shot02_frame_0001.png", 2),
    png("shot02_frame_0002.png", 3),
  ]);
  await expect(picker.getByRole("alert")).toContainText("missing or duplicate");
  await expect(picker.getByRole("region", { name: "Shot Director" })).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "Create multi-shot cartoon" }))
    .toBeDisabled();
});
