import { test, expect } from "@playwright/test";

const images = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
];

test("Playable Shot Director shows real original PNG frames across cut, pause, replay and reset", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–8 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    { name: "shot02_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(images[3], "base64") },
    { name: "shot01_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(images[1], "base64") },
    { name: "shot02_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(images[2], "base64") },
    { name: "shot01_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(images[0], "base64") },
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  const reel = picker.getByRole("region", { name: "Play full storyboard" });
  const screen = reel.locator(".studio-reel-screen").getByRole("img");
  const clock = reel.locator("[data-reel-clock]");
  await expect(screen).toHaveAttribute("alt", /shot01_frame_0001\.png/);
  await expect.poll(() => screen.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(2);
  await reel.getByRole("button", { name: "Play storyboard" }).click();
  await expect.poll(async () =>
    Number((await clock.innerText()).split(" / ")[0])).toBeGreaterThan(0.2);
  await reel.getByRole("button", { name: "Pause storyboard" }).click();
  const paused = await clock.innerText();
  await page.waitForTimeout(150);
  expect(await clock.innerText()).toBe(paused);
  const seek = reel.getByRole("slider", { name: "Seek full storyboard" });
  await seek.focus();
  await seek.press("End");
  await expect(screen).toHaveAttribute("alt", /shot02_frame_0002\.png/);
  await expect(reel.locator("[data-reel-frame-status]"))
    .toContainText("holding final frame");
  await reel.getByRole("button", { name: "Restart storyboard" }).click();
  await expect(screen).toHaveAttribute("alt", /shot01_frame_0001\.png/);
  await expect(clock).toContainText("0.00 / 4.00 seconds");
  await expect(page.locator(".editor")).toHaveCount(0);
});

test("Reordering shots and adding a hold updates the playable reel before import", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–8 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    { name: "shot02_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(images[3], "base64") },
    { name: "shot01_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(images[0], "base64") },
    { name: "shot02_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(images[2], "base64") },
    { name: "shot01_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(images[1], "base64") },
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  const director = picker.getByRole("region", { name: "Shot Director" });
  const reel = director.getByRole("region", { name: "Play full storyboard" });
  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  await expect(reel.locator(".studio-reel-screen").getByRole("img")).toHaveAttribute("alt", /shot02_frame_0001\.png/);
  await expect(reel.locator("[data-reel-clock]")).toContainText("0.00 / 5.00 seconds");
  await reel.getByRole("slider", { name: "Seek full storyboard" }).focus();
  await reel.getByRole("slider", { name: "Seek full storyboard" }).press("End");
  await expect(reel.locator(".studio-reel-screen").getByRole("img")).toHaveAttribute("alt", /shot01_frame_0002\.png/);
  // The user's file set remains untouched, and old saved cartoons do not open.
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([]);
  await expect(reel).toHaveCount(0);
  await expect(page.locator(".editor")).toHaveCount(0);
});

test("Invalid or incomplete PNG sequences never start a playable storyboard", async ({ page }) => {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–8 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    { name: "shot01_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(images[0], "base64") },
    { name: "shot01_frame_0003.png", mimeType: "image/png", buffer: Buffer.from(images[1], "base64") },
    { name: "shot02_frame_0001.png", mimeType: "image/png", buffer: Buffer.from(images[2], "base64") },
    { name: "shot02_frame_0002.png", mimeType: "image/png", buffer: Buffer.from(images[3], "base64") },
  ]);
  await expect(picker.getByRole("alert")).toContainText("missing or duplicate");
  await expect(picker.getByRole("region", { name: "Play full storyboard" })).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "Create multi-shot cartoon" })).toBeDisabled();
});
