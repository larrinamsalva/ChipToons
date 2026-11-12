import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const samples = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;
const image = (name: string, i: number) => ({
  name, mimeType: "image/png", buffer: Buffer.from(samples[i], "base64"),
});
async function prepared(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–8 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    image("shot02_frame_0002.png", 3), image("shot01_frame_0001.png", 0),
    image("shot02_frame_0001.png", 2), image("shot01_frame_0002.png", 1),
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  return { picker, director: picker.getByRole("region", { name: "Shot Director" }) };
}

test("Download actual ordered local recording cues with shot times and non-blocking pace warnings", async ({ page }) => {
  const { picker, director } = await prepared(page);
  const first = director.getByRole("textbox", {
    name: "Written narration for shot01_frame_",
  });
  const second = director.getByRole("textbox", {
    name: "Written narration for shot02_frame_",
  });
  await director.getByRole("textbox", { name: "Scene title for shot01_frame_" })
    .fill("Scout checks the bike");
  await first.fill("Help me, Jo.");
  await director.getByRole("textbox", { name: "Scene title for shot02_frame_" })
    .fill("Jo helps with the repair");
  await director.getByRole("textbox", { name: "Scene action for shot02_frame_" })
    .fill("Jo looks at the tire and shows the safe next step.");
  await second.fill("We can always ask a trusted adult for help with this tricky bicycle repair.");
  await expect(director.locator('[data-narration-timing="shot02_frame_"]'))
    .toContainText("may run past this scene");
  await expect(director.locator('[data-narration-timing="shot01_frame_"]'))
    .toContainText("Rehearse your narration");

  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  await expect(first).toHaveValue("Help me, Jo.");
  await expect(second).toHaveValue(
    "We can always ask a trusted adult for help with this tricky bicycle repair.");
  const control = director.getByRole("button", { name: "Download voice cue sheet (.txt)" });
  await expect(control).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await control.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("chiptoons-storyboard-voice-cues.txt");
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("LOCAL SCRIPT ONLY");
  expect(text).toContain("Shots: 2 | Total storyboard: 5.00s | PNG rate: 2 fps");
  expect(text).toContain("SHOT 1 — Jo helps with the repair\nTime: 0.00s to 3.00s (3.00s)");
  expect(text).toContain("SHOT 2 — Scout checks the bike\nTime: 3.00s to 5.00s (2.00s)");
  expect(text).toContain("Action / lesson: Jo looks at the tire and shows the safe next step.");
  expect(text).toContain("Written narration: Help me, Jo.");
  expect(text).toContain("TIMING NOTE: Narration may be too long");
  expect(text).toContain("record it separately");
  expect(await page.locator(".editor").count()).toBe(0);
  await expect(picker.getByRole("button", { name: "Create multi-shot cartoon" }))
    .toBeEnabled();
});

test("Voice cue sheet goes away with stale PNG selection, but written notes stay editable on reorder", async ({ page }) => {
  const { picker, director } = await prepared(page);
  await director.getByRole("textbox", { name: "Written narration for shot01_frame_" })
    .fill("First, we check the bike.");
  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await expect(director.getByRole("textbox", { name: "Written narration for shot01_frame_" }))
    .toHaveValue("First, we check the bike.");
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([]);
  await expect(picker.getByRole("button", { name: "Download voice cue sheet (.txt)" }))
    .toHaveCount(0);
  await expect(page.locator(".editor")).toHaveCount(0);
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    image("shot02_frame_0002.png", 3), image("shot02_frame_0001.png", 2),
    image("shot01_frame_0002.png", 1), image("shot01_frame_0001.png", 0),
  ]);
  const newDirector = picker.getByRole("region", { name: "Shot Director" });
  await expect(newDirector.getByRole("textbox", { name: "Written narration for shot01_frame_" }))
    .toHaveValue("");
});
