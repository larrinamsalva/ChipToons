import { expect, test } from "@playwright/test";
import { backup } from "./production-helpers";

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
