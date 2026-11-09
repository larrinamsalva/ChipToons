import { expect, test } from "@playwright/test";
import { backup } from "./production-helpers";
import { builtInSound } from "../src/sounds";
import { readFile } from "node:fs/promises";

const samples = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;
const png = (name: string, color: number) => ({
  name, mimeType: "image/png", buffer: Buffer.from(samples[color], "base64"),
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
  return { picker, director: picker.getByRole("region", { name: "Shot Director" }) };
}

test("Creator explicitly imports edited storyboard captions into a new portable cartoon", async ({ page }) => {
  const { picker, director } = await prepare(page);
  const choice = director.getByRole("checkbox", {
    name: "Include drafted subtitles as editable captions in the NEW cartoon",
  });
  await expect(choice).not.toBeChecked();
  await expect(choice).toBeDisabled();
  await director.getByRole("textbox", { name: "Written narration for shot01_frame_" })
    .fill("Scout checks the wheel.");
  await director.getByRole("textbox", { name: "Written narration for shot02_frame_" })
    .fill("Original Jo narration.");
  await expect(choice).toBeEnabled();
  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  const editor = director.getByRole("group", { name: "Subtitle cues for shot02_frame_" });
  await editor.getByRole("button", { name: "Customize subtitles for shot02_frame_" }).click();
  await editor.getByRole("textbox", { name: "First subtitle for shot02_frame_" })
    .fill("Jo checks.");
  await editor.getByRole("textbox", { name: "Second subtitle for shot02_frame_" })
    .fill("Jo explains the next step.");
  const timing = editor.getByRole("slider", { name: "Second subtitle timing for shot02_frame_" });
  await timing.focus();
  await timing.press("Home");
  for (let i = 0; i < 4; i++) await timing.press("ArrowRight");
  await expect(timing).toHaveValue("40");

  await choice.check();
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/new cartoon has editable draft captions/i)).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data } = await backup(page);
    expect(data.scenes.map(scene => scene.duration)).toEqual([3, 2]);
    expect(data.scenes.map(scene => scene.narration))
      .toEqual(["Original Jo narration.", "Scout checks the wheel."]);
    expect(data.captions.map(c => [c.sceneId, c.start, c.end, c.text])).toEqual([
      [data.scenes[0].id, 0, 1.2, "Jo checks."],
      [data.scenes[0].id, 1.2, 3, "Jo explains the next step."],
      [data.scenes[1].id, 0, 2, "Scout checks the wheel."],
    ]);
    expect(data.scenes.map(scene => scene.elements[0].frameSequence?.assetIds))
      .toEqual([
        data.assets.slice(0, 2).map(a => a.id),
        data.assets.slice(2).map(a => a.id),
      ]);
    expect(data.audioClips).toHaveLength(0);
  }
  // PR #69: the new actual caption tracks are visible in the regular
  // finishing workflow, without ever mistaking written text for audio.
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  const report = page.getByRole("region", {
    name: "Storyboard caption and voice timing review",
  });
  await expect(report).toBeVisible();
  await expect(report).toContainText("0/2 scenes with an assigned audible voice clip");
  await expect(report).toContainText("3 timed captions");
  await expect(report).toContainText("3 captions with no overlapping voice clip");
  // Guide is read-only; its recorder link opens the actual existing microphone UI.
  const guide = report.getByRole("region", { name: "Guided scene voice recording" });
  await guide.getByRole("button", { name: "Start guided voice recording" }).click();
  await expect(guide).toContainText("Original Jo narration.");
  await expect(guide).toContainText("Episode time: 0.00s–3.00s");
  await guide.getByRole("button", { name: "Next scene" }).click();
  await expect(guide).toContainText("Episode time: 3.00s–5.00s");
  await expect(guide).toContainText("Scout checks the wheel.");
  await guide.getByRole("button", { name: "Previous scene" }).click();
  await guide.getByRole("button", { name: "Record or upload this scene" }).click();
  const recorder = page.getByRole("dialog");
  await expect(recorder).toContainText("Scene 1 recording prompt");
  await expect(recorder).toContainText("Original Jo narration.");
  await expect(recorder.getByRole("button", { name: "Start microphone recording" }))
    .toBeVisible();
  await recorder.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  await expect(report.getByRole("list", {
    name: "Storyboard scene audio and caption review",
  }).locator(":scope > li")).toHaveCount(2);
  await expect(report).toContainText("Written narration has no assigned audible voice clip");
  await expect(report.getByRole("list", {
    name: "Caption cue coverage for scene 1",
  })).toContainText("Jo checks.");
  const downloadStarted = page.waitForEvent("download");
  await report.getByRole("button", {
    name: "Download recording to-do sheet (.txt)",
  }).click();
  const checklist = await downloadStarted;
  expect(checklist.suggestedFilename()).toContain("-recording-checklist.txt");
  const written = await readFile((await checklist.path())!, "utf8");
  expect(written).toContain("CHIPTOONS — RECORDING & CAPTION REVIEW CHECKLIST");
  expect(written).toContain("Scenes: 2 | Scenes with assigned voice intervals: 0");
  expect(written).toContain("Captions: 3 | Captions without overlapping assigned voice: 3");
  expect(written).toContain("SCENE 1");
  expect(written).toContain("Episode time: 0.00s to 3.00s");
  expect(written).toContain("CAPTION 0.00s–1.20s: Jo checks.");
  expect(written).toContain("CAPTION 1.20s–3.00s: Jo explains the next step.");
  expect(written).toContain("Episode time: 3.00s to 5.00s");
  expect(written).toContain("CAPTION 3.00s–5.00s: Scout checks the wheel.");
  expect(written).toContain("Record or assign actual narration/dialogue");
  await expect(report).toBeVisible();
  await report.getByRole("button", {
    name: "Review captions for scene 1",
  }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // PR #72: saved original on a narration lane, playable inside the guide.
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  await report.getByRole("button", { name: "Review voices for scene 1" }).click();
  const voice = page.getByRole("dialog");
  await voice.getByRole("combobox", { name: "New audio category" })
    .selectOption("narration");
  await voice.getByLabel("Upload audio file").setInputFiles({
    name: "sample-voice-lane-original.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(builtInSound("melody").dataUrl.split(",")[1], "base64"),
  });
  await voice.getByRole("button", { name: "Save audio clip" }).click();
  await expect(voice.getByRole("textbox", { name: "Audio clip name" }))
    .toHaveValue("sample-voice-lane-original");
  await voice.getByRole("button", { name: "Back to cartoon" }).click();
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  const listenGuide = page.getByRole("region", { name: "Guided scene voice recording" });
  await listenGuide.getByRole("button", { name: "Start guided voice recording" }).click();
  const source = listenGuide.getByRole("region", { name: "Recorded scene voice listen-back" });
  await expect(source).toContainText("sample-voice-lane-original");
  await expect(source).toContainText("Source trim:");
  // The first voice clip's scene interval covers both scene-one captions,
  // but leaves all of scene two's captions without time-window coverage.
  const coverageFirst = page.getByRole("list", {
    name: "Caption cue coverage for scene 1",
  });
  const coverageSecond = page.getByRole("list", {
    name: "Caption cue coverage for scene 2",
  });
  await expect(coverageFirst).toContainText("100% of cue interval overlaps voice");
  await expect(coverageSecond).toContainText("0% of cue interval overlaps voice");
  const player = source.getByLabel("Original audio source", { exact: true });
  await player.evaluate((el: HTMLAudioElement) => el.play());
  await expect.poll(() =>
    player.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.05);
  await player.evaluate((el: HTMLAudioElement) => el.pause());
});

test("Caption import remains off by default and rejects overlong text before creating a project", async ({ page }) => {
  const { picker, director } = await prepare(page);
  const first = director.getByRole("textbox", { name: "Written narration for shot01_frame_" });
  const choice = director.getByRole("checkbox", {
    name: "Include drafted subtitles as editable captions in the NEW cartoon",
  });
  await first.fill("This will stay written narration only.");
  await expect(choice).not.toBeChecked();
  await choice.check();
  await first.fill("x".repeat(281));
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(picker.getByRole("alert")).toContainText("280 characters");
  await expect(page.locator(".editor")).toHaveCount(0);
  // Opt-out still accepts the unchanged PR #64 narrative import, without
  // injecting or truncating any caption.
  await choice.uncheck();
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data } = await backup(page);
    expect(data.captions).toEqual([]);
    expect(data.scenes[0].narration).toHaveLength(281);
  }
});
