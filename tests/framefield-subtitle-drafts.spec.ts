import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const images = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;
const png = (name: string, index: number) => ({
  name, mimeType: "image/png", buffer: Buffer.from(images[index], "base64"),
});
async function prepare(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–8 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("shot02_frame_0002.png", 3), png("shot01_frame_0002.png", 1),
    png("shot02_frame_0001.png", 2), png("shot01_frame_0001.png", 0),
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  return { picker, director: picker.getByRole("region", { name: "Shot Director" }) };
}

test("Storyboard captions preview real written text and export correctly reordered SRT", async ({ page }) => {
  const { picker, director } = await prepare(page);
  const downloadButton = director.getByRole("button", { name: "Download subtitle draft (.srt)" });
  await expect(downloadButton).toBeDisabled();
  await director.getByRole("textbox", { name: "Written narration for shot01_frame_" })
    .fill("First, we check the tire.");
  await director.getByRole("textbox", { name: "Written narration for shot02_frame_" })
    .fill("Jo shows us a safe repair.");
  const reel = director.getByRole("region", { name: "Play full storyboard" });
  const preview = reel.locator('[data-subtitle-draft="true"]');
  await expect(preview).toContainText("First, we check the tire.");
  await expect(downloadButton).toBeEnabled();

  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  await expect(preview).toContainText("Jo shows us a safe repair.");
  const navigate = reel.getByRole("navigation", { name: "Storyboard scene markers" });
  await navigate.getByRole("button", {
    name: "Jump to shot 2: shot01_frame_ at 3.00 seconds",
  }).click();
  await expect(preview).toContainText("First, we check the tire.");
  await expect(reel.locator("[data-reel-clock]")).toContainText("3.00 / 5.00 seconds");

  const requested = page.waitForEvent("download");
  await downloadButton.click();
  const download = await requested;
  expect(download.suggestedFilename()).toBe("chiptoons-storyboard-subtitle-draft.srt");
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toBe(
    "1\n00:00:00,000 --> 00:00:03,000\nJo shows us a safe repair.\n\n" +
    "2\n00:00:03,000 --> 00:00:05,000\nFirst, we check the tire.\n",
  );
  await expect(picker.getByRole("button", { name: "Create multi-shot cartoon" }))
    .toBeEnabled();
  await expect(page.locator(".editor")).toHaveCount(0);
});

test("Empty narration creates no subtitle cue and clearing files removes stale preview", async ({ page }) => {
  const { picker, director } = await prepare(page);
  await director.getByRole("textbox", { name: "Written narration for shot01_frame_" })
    .fill("Check first.");
  const reel = director.getByRole("region", { name: "Play full storyboard" });
  const preview = reel.locator('[data-subtitle-draft="true"]');
  const nav = reel.getByRole("navigation", { name: "Storyboard scene markers" });
  await nav.getByRole("button", { name: "Jump to shot 2: shot02_frame_ at 2.00 seconds" }).click();
  await expect(preview).toContainText("No written narration for this shot.");
  const requested = page.waitForEvent("download");
  await director.getByRole("button", { name: "Download subtitle draft (.srt)" }).click();
  const result = await requested;
  const draft = await readFile((await result.path())!, "utf8");
  expect(draft).toContain("00:00:00,000 --> 00:00:02,000");
  expect(draft).not.toContain("00:00:02,000 --> 00:00:04,000");

  await picker.getByLabel("Choose numbered PNG files").setInputFiles([]);
  await expect(reel).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "Download subtitle draft (.srt)" }))
    .toHaveCount(0);
  await expect(page.locator(".editor")).toHaveCount(0);
});
