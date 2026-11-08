import { test, expect } from "@playwright/test";

const image = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
];
function file(name: string, color: number) {
  return { name, mimeType: "image/png", buffer: Buffer.from(image[color], "base64") };
}
async function preparedReel(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–3 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    file("shot02_frame_0002.png", 3), file("shot01_frame_0002.png", 1),
    file("shot02_frame_0001.png", 2), file("shot01_frame_0001.png", 0),
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  const director = picker.getByRole("region", { name: "Shot Director" });
  const reel = director.getByRole("region", { name: "Play full storyboard" });
  const markers = reel.getByRole("navigation", { name: "Storyboard scene markers" });
  return { picker, director, reel, markers };
}

test("Scene markers jump to the exact original PNG cut and pause local playback", async ({ page }) => {
  const { picker, reel, markers } = await preparedReel(page);
  const first = markers.getByRole("button", { name: "Jump to shot 1: shot01_frame_ at 0.00 seconds" });
  const second = markers.getByRole("button", { name: "Jump to shot 2: shot02_frame_ at 2.00 seconds" });
  await expect(markers.getByRole("button")).toHaveCount(2);
  await expect(first).toHaveAttribute("aria-current", "step");
  await expect(second).not.toHaveAttribute("aria-current");
  await expect(markers).toContainText("0.00–2.00s");
  await expect(markers).toContainText("2.00–4.00s");
  await reel.getByRole("button", { name: "Play storyboard" }).click();
  await expect(reel.getByRole("button", { name: "Pause storyboard" })).toBeVisible();
  await second.click();
  await expect(reel.getByRole("button", { name: "Play storyboard" })).toBeVisible();
  await expect(second).toHaveAttribute("aria-current", "step");
  await expect(first).not.toHaveAttribute("aria-current");
  await expect(reel.locator(".studio-reel-screen").getByRole("img")).toHaveAttribute("alt", /shot02_frame_0001\.png/);
  await expect(reel.locator("[data-reel-clock]")).toContainText("2.00 / 4.00 seconds");
  await first.click();
  await expect(first).toHaveAttribute("aria-current", "step");
  await expect(reel.locator(".studio-reel-screen").getByRole("img")).toHaveAttribute("alt", /shot01_frame_0001\.png/);
  await expect(reel.locator("[data-reel-clock]")).toContainText("0.00 / 4.00 seconds");
  await expect(page.locator(".editor")).toHaveCount(0);
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([]);
  await expect(markers).toHaveCount(0);
});

test("Reordered shots and holds get correct scene markers and exact jump positions", async ({ page }) => {
  const { director, reel, markers } = await preparedReel(page);
  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  const first = markers.getByRole("button", { name: "Jump to shot 1: shot02_frame_ at 0.00 seconds" });
  const second = markers.getByRole("button", { name: "Jump to shot 2: shot01_frame_ at 3.00 seconds" });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect(markers).toContainText("0.00–3.00s");
  await expect(markers).toContainText("3.00–5.00s");
  await expect(markers).toContainText("+1s final-frame hold");
  await first.click();
  await reel.getByRole("slider", { name: "Seek full storyboard" }).focus();
  await reel.getByRole("slider", { name: "Seek full storyboard" }).press("End");
  await expect(second).toHaveAttribute("aria-current", "step");
  await expect(reel.locator(".studio-reel-screen").getByRole("img")).toHaveAttribute("alt", /shot01_frame_0002\.png/);
  await first.click();
  await expect(reel.locator(".studio-reel-screen").getByRole("img")).toHaveAttribute("alt", /shot02_frame_0001\.png/);
  await second.click();
  await expect(reel.locator(".studio-reel-screen").getByRole("img")).toHaveAttribute("alt", /shot01_frame_0001\.png/);
  await expect(reel.locator("[data-reel-clock]")).toContainText("3.00 / 5.00 seconds");
});
