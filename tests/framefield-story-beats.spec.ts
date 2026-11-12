import { test, expect } from "@playwright/test";
import { backup } from "./production-helpers";

const source = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;
const png = (name: string, color: number) => ({
  name, mimeType: "image/png", buffer: Buffer.from(source[color], "base64"),
});
async function selector(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–8 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("shot02_frame_0002.png", 3),
    png("shot01_frame_0002.png", 1),
    png("shot02_frame_0001.png", 2),
    png("shot01_frame_0001.png", 0),
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  return picker;
}

test("Written story beats follow original shots into a new editable portable cartoon", async ({ page }) => {
  const picker = await selector(page);
  const director = picker.getByRole("region", { name: "Shot Director" });
  const firstTitle = director.getByRole("textbox", { name: "Scene title for shot01_frame_" });
  const secondTitle = director.getByRole("textbox", { name: "Scene title for shot02_frame_" });
  await firstTitle.fill("Scout checks the tire");
  await director.getByRole("textbox", { name: "Scene action for shot01_frame_" })
    .fill("Scout stops and checks the bicycle before riding.");
  await director.getByRole("textbox", { name: "Written narration for shot01_frame_" })
    .fill("A safe adventure starts with checking our bicycle.");
  await secondTitle.fill("Jo shows a safe repair");
  await director.getByRole("textbox", { name: "Scene action for shot02_frame_" })
    .fill("Helper Jo explains when to ask a grown-up.");
  await director.getByRole("textbox", { name: "Written narration for shot02_frame_" })
    .fill("If you need help, always ask a trusted grown-up.");

  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  await expect(director.getByRole("list", { name: "Shot playback order" })
    .locator("li").first()).toContainText("shot02_frame_");
  await expect(firstTitle).toHaveValue("Scout checks the tire");
  await expect(secondTitle).toHaveValue("Jo shows a safe repair");
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });

  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data } = await backup(page);
    expect(data.scenes.map(scene => scene.title)).toEqual([
      "Jo shows a safe repair", "Scout checks the tire",
    ]);
    expect(data.scenes.map(scene => scene.action)).toEqual([
      "Helper Jo explains when to ask a grown-up.",
      "Scout stops and checks the bicycle before riding.",
    ]);
    expect(data.scenes.map(scene => scene.narration)).toEqual([
      "If you need help, always ask a trusted grown-up.",
      "A safe adventure starts with checking our bicycle.",
    ]);
    expect(data.scenes.map(scene => scene.duration)).toEqual([3, 2]);
    expect(data.scenes.every(scene => scene.audioRefs.length === 0)).toBe(true);
    expect(data.scenes.map(scene => scene.elements[0].frameSequence?.assetIds))
      .toEqual([
        data.assets.slice(0, 2).map(a => a.id),
        data.assets.slice(2).map(a => a.id),
      ]);
    expect(data.assets.map(a => a.name)).toEqual([
      "shot02_frame_0001.png", "shot02_frame_0002.png",
      "shot01_frame_0001.png", "shot01_frame_0002.png",
    ]);
  }
});

test("New local file selection clears stale notes without touching saved cartoons", async ({ page }) => {
  const picker = await selector(page);
  const director = picker.getByRole("region", { name: "Shot Director" });
  const field = director.getByRole("textbox", { name: "Scene title for shot01_frame_" });
  await field.fill("This belongs to the old file selection");
  await director.getByRole("textbox", { name: "Written narration for shot02_frame_" })
    .fill("This must not be carried to a new shot.");
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([]);
  await expect(director).toHaveCount(0);
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("shot02_frame_0002.png", 3), png("shot02_frame_0001.png", 2),
    png("shot01_frame_0002.png", 1), png("shot01_frame_0001.png", 0),
  ]);
  const newDirector = picker.getByRole("region", { name: "Shot Director" });
  await expect(newDirector.getByRole("textbox", { name: "Scene title for shot01_frame_" }))
    .toHaveValue("");
  await expect(newDirector.getByRole("textbox", { name: "Written narration for shot02_frame_" }))
    .toHaveValue("");
  await expect(page.locator(".editor")).toHaveCount(0);
});
