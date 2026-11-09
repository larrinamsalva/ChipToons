import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const images = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;
const png = (name: string, i: number) => ({
  name, mimeType: "image/png", buffer: Buffer.from(images[i], "base64"),
});
async function prepare(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–3 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("shot02_frame_0002.png", 3), png("shot01_frame_0002.png", 1),
    png("shot02_frame_0001.png", 2), png("shot01_frame_0001.png", 0),
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  return {
    picker,
    director: picker.getByRole("region", { name: "Shot Director" }),
  };
}

test("Manually split one scene into two genuine downloadable SRT cues without altering narration", async ({ page }) => {
  const { picker, director } = await prepare(page);
  const firstNarration = director.getByRole("textbox", { name: "Written narration for shot01_frame_" });
  const secondNarration = director.getByRole("textbox", { name: "Written narration for shot02_frame_" });
  await firstNarration.fill("Scout checks the wheel.");
  await secondNarration.fill("Jo explains each step carefully.");
  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");

  const editor = director.getByRole("group", { name: "Subtitle cues for shot02_frame_" });
  await editor.getByRole("button", { name: "Customize subtitles for shot02_frame_" }).click();
  const first = editor.getByRole("textbox", { name: "First subtitle for shot02_frame_" });
  const second = editor.getByRole("textbox", { name: "Second subtitle for shot02_frame_" });
  await expect(first).toHaveValue("Jo explains each step carefully.");
  await first.fill("Jo checks.");
  await second.fill("Jo shows a safe fix.");
  await editor.getByRole("slider", { name: "Second subtitle timing for shot02_frame_" })
    .fill("40");
  await expect(editor).toContainText("1.20s into this 3.00s shot.");
  await expect(secondNarration).toHaveValue("Jo explains each step carefully.");
  const reel = director.getByRole("region", { name: "Play full storyboard" });
  const preview = reel.locator('[data-subtitle-draft="true"]');
  await expect(preview).toContainText("Jo checks.");

  const requested = page.waitForEvent("download");
  await director.getByRole("button", { name: "Download subtitle draft (.srt)" }).click();
  const downloaded = await requested;
  expect(downloaded.suggestedFilename()).toBe("chiptoons-storyboard-subtitle-draft.srt");
  const srt = await readFile((await downloaded.path())!, "utf8");
  expect(srt).toBe(
    "1\n00:00:00,000 --> 00:00:01,200\nJo checks.\n\n" +
    "2\n00:00:01,200 --> 00:00:03,000\nJo shows a safe fix.\n\n" +
    "3\n00:00:03,000 --> 00:00:05,000\nScout checks the wheel.\n",
  );
  const jump = reel.getByRole("navigation", { name: "Storyboard scene markers" });
  await jump.getByRole("button", {
    name: "Jump to shot 2: shot01_frame_ at 3.00 seconds",
  }).click();
  await expect(preview).toContainText("Scout checks the wheel.");
  await editor.getByRole("button", {
    name: "Use original narration for subtitles of shot02_frame_",
  }).click();
  await jump.getByRole("button", {
    name: "Jump to shot 1: shot02_frame_ at 0.00 seconds",
  }).click();
  await expect(preview).toContainText("Jo explains each step carefully.");
  await expect(secondNarration).toHaveValue("Jo explains each step carefully.");
  await expect(page.locator(".editor")).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "Create multi-shot cartoon" })).toBeEnabled();
});

test("New PNG selection resets optional subtitle words and split timings", async ({ page }) => {
  const { picker, director } = await prepare(page);
  await director.getByRole("textbox", { name: "Written narration for shot01_frame_" })
    .fill("Original script remains independent.");
  const editor = director.getByRole("group", { name: "Subtitle cues for shot01_frame_" });
  await editor.getByRole("button", { name: "Customize subtitles for shot01_frame_" }).click();
  await editor.getByRole("textbox", { name: "First subtitle for shot01_frame_" })
    .fill("Only in old selection.");
  await editor.getByRole("textbox", { name: "Second subtitle for shot01_frame_" })
    .fill("Old second caption.");
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([]);
  await expect(director).toHaveCount(0);
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("shot01_frame_0001.png", 0), png("shot01_frame_0002.png", 1),
    png("shot02_frame_0001.png", 2), png("shot02_frame_0002.png", 3),
  ]);
  const fresh = picker.getByRole("region", { name: "Shot Director" });
  await expect(fresh.getByRole("button", { name: "Customize subtitles for shot01_frame_" }))
    .toBeVisible();
  await expect(fresh.getByRole("textbox", { name: "Written narration for shot01_frame_" }))
    .toHaveValue("");
  await expect(fresh.getByRole("button", { name: "Download subtitle draft (.srt)" }))
    .toBeDisabled();
  await expect(page.locator(".editor")).toHaveCount(0);
});
