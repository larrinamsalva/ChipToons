import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { planSegments } from "../src/segments";
import { lineStatus } from "../src/script";
import { sceneFramesAt } from "../src/timeline";
import { backup, saved } from "./production-helpers";

const TITLE = "Little Fixers Club — Scout Plans a Fix (60-second acting cartoon; second scene voice pending)";

async function openActing(page: Page) {
  await page.goto("./");
  await page.getByRole("button", {
    name: "Watch Scout pick up a checklist (1:00)", exact: true,
  }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 55_000 });
}

test("Scout picks up a checklist with a real puppet-hand attachment then puts it down", async ({ page }) => {
  test.setTimeout(120_000);
  await openActing(page);
  await saved(page);
  const { data } = await backup(page);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.scenes.map(scene => scene.duration)).toEqual([34, 26]);
  expect(planSegments(data, 60).segments.map(segment => segment.duration)).toEqual([60]);
  expect(planSegments(data, 60).oversized).toEqual([]);
  expect(data.characters[0].puppet?.costume).toBe("workshop");
  expect(data.audioAssets).toHaveLength(8); // Original speech + SFX, only paper/placement added
  expect(new Set(data.audioAssets.map(asset => asset.id)).size).toBe(8);

  const first = data.scenes[0];
  const second = data.scenes[1];
  expect(first.script?.lines).toHaveLength(3);
  for (const line of first.script!.lines) expect(lineStatus(data, line)).toBe("Approved");
  expect(first.elements.find(element => element.characterId)?.voiceMouth).toHaveLength(3);
  expect(data.captions.filter(cue => cue.sceneId === first.id).length).toBeGreaterThanOrEqual(3);

  expect(second.script?.lines).toHaveLength(2);
  for (const line of second.script!.lines) expect(lineStatus(data, line)).toBe("Not recorded");
  expect(data.captions.filter(cue => cue.sceneId === second.id)).toHaveLength(0);
  expect(second.cameraShots).toHaveLength(3);
  expect(second.focusGraphics).toHaveLength(4);
  expect(second.interactions?.map(action => action.kind)).toEqual(["put", "point"]);

  const host = second.elements.find(element => element.characterId === data.characters[0].id)!;
  const checklist = second.elements.find(element => element.prop === "book")!;
  expect(host.voiceMouth).toBeUndefined();
  expect(host.animation?.keyframes.length).toBeGreaterThanOrEqual(12);
  const start = sceneFramesAt(data, second, 1);
  const walk = sceneFramesAt(data, second, 3.3);
  const carried = sceneFramesAt(data, second, 9);
  const released = sceneFramesAt(data, second, 17);
  const pointing = sceneFramesAt(data, second, 21);
  const final = sceneFramesAt(data, second, 25);

  expect(walk.get(host.id)!.x - start.get(host.id)!.x).toBeGreaterThan(35);
  expect(walk.get(host.id)!.joints?.leftLeg?.angle).not.toBe(walk.get(host.id)!.joints?.rightLeg?.angle);
  expect(carried.get(checklist.id)!.heldBy).toBe(host.id);
  expect(start.get(checklist.id)?.heldBy).toBeUndefined();
  expect(Math.abs(carried.get(checklist.id)!.y - start.get(checklist.id)!.y)).toBeGreaterThan(20);
  expect(released.get(checklist.id)?.heldBy).toBeUndefined();
  expect(released.get(checklist.id)!.x).toBeCloseTo(532, 0);
  expect(released.get(checklist.id)!.y).toBeCloseTo(317, 0);
  expect(pointing.get(checklist.id)!.pointing).toBeGreaterThan(0.5);
  expect(final.get(checklist.id)?.heldBy).toBeUndefined();
  expect(final.get(checklist.id)!.x).toBeCloseTo(532, 0);
  expect(second.elements.some(item => item.id === checklist.id && !item.sceneryDepth)).toBe(true);
  expect(data.audioClips.filter(clip => clip.sceneId === second.id)).toHaveLength(4);
});

test("Scout's one-minute acting cartoon can be saved and reopened without changing the approved performance", async ({ page }) => {
  test.setTimeout(120_000);
  await openActing(page);
  await saved(page);
  const original = (await backup(page)).data;
  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", { name: `Continue ${TITLE}`, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 35_000 });
  const reopened = (await backup(page)).data;
  expect(reopened.scenes).toEqual(original.scenes);
  expect(reopened.audioClips).toEqual(original.audioClips);
  expect(reopened.captions).toEqual(original.captions);
  expect(reopened.characters).toEqual(original.characters);
});
