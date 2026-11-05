import { expect, test } from "@playwright/test";
import { planSegments } from "../src/segments";
import { lineStatus } from "../src/script";
import { sceneFramesAt } from "../src/timeline";
import { backup, saved } from "./production-helpers";

// Playwright runs outside Vite; don't import a starter with import.meta.glob.
const TITLE = "Little Fixers Club — Scout Walks and Talks (34-second voiced cartoon)";

test("Scout walks, speaks three approved lines and opens mouth from real recording waveforms", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Watch Scout walk and talk", exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 55_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.title).toBe(TITLE);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.characters[0].puppet?.costume).toBe("workshop");
  expect(data.scenes).toHaveLength(1);
  expect(data.scenes[0].duration).toBe(34);
  expect(planSegments(data, 60).oversized).toEqual([]);
  expect(data.audioAssets).toHaveLength(6); // 3 real sound FX sources + 3 original speech recordings
  expect(new Set(data.audioAssets.map(asset => asset.id)).size).toBe(6);
  const scene = data.scenes[0];
  const host = scene.elements.find(element => element.characterId === data.characters[0].id)!;
  expect(host.animation?.keyframes.length).toBeGreaterThan(10);
  expect(host.voiceMouth).toHaveLength(3);
  expect(scene.script?.lines).toHaveLength(3);
  expect(data.audioClips.filter(c => c.category === "dialogue")).toHaveLength(3);
  expect(data.captions.length).toBeGreaterThanOrEqual(3);
  for (const line of scene.script!.lines) {
    expect(lineStatus(data, line)).toBe("Approved");
    const clip = data.audioClips.find(c => c.id === line.clipId)!;
    expect(clip).toBeTruthy();
    expect(clip.category).toBe("dialogue");
    expect(clip.sceneId).toBe(scene.id);
    expect(clip.characterId).toBe(data.characters[0].id);
    expect(host.voiceMouth?.some(track => track.clipId === clip.id && track.levels.length > 30))
      .toBe(true);
    expect(data.captions.some(c => c.sceneId === scene.id &&
      Math.abs(c.start - clip.start) < 0.2)).toBe(true);
  }
  const speaking = Array.from({ length: 45 }, (_, i) => 0.95 + i * 0.065)
    .some(at => (sceneFramesAt(data, scene, at).get(host.id)?.voiceOpening ?? 0) > 0.17);
  expect(speaking).toBe(true);
  const early = sceneFramesAt(data, scene, 2).get(host.id)!;
  const walking = sceneFramesAt(data, scene, 9).get(host.id)!;
  expect(walking.x - early.x).toBeGreaterThan(110);
  expect(walking.joints?.leftLeg?.angle).not.toBe(walking.joints?.rightLeg?.angle);
  // The original silent 34-second pilot is still available separately.
  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await expect(page.getByRole("button", { name: "Try the full-body cartoon workshop", exact: true }))
    .toBeVisible();
});
