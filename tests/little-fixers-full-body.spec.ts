import { expect, test } from "@playwright/test";
import { sceneFramesAt } from "../src/timeline";
import { planSegments } from "../src/segments";
import { backup, saved } from "./production-helpers";

// Deliberately avoid directly importing the app's Vite-only startup modules.
const TITLE = "Little Fixers Club — Full-Body Cartoon Workshop (34-second acting pilot; no narration)";

test("opens an original full-body cartoon with walk-cycle joints and a layered workshop, no poster", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Try the full-body cartoon workshop", exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible({ timeout: 35_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.scenes).toHaveLength(1);
  expect(data.scenes[0].duration).toBe(34);
  expect(data.scenes[0].gentleDepth).toBe(true);
  expect(data.scenes[0].backgroundAnimation?.style).toBe("parallax");
  expect(planSegments(data, 60).oversized).toEqual([]);
  const rig = data.characters[0].puppet!;
  expect(rig.costume).toBe("workshop");
  for (const role of ["torso", "head", "leftArm", "rightArm", "leftLeg", "rightLeg", "leftFoot", "rightFoot", "accessory"]) {
    expect(rig.parts.some(part => part.role === role)).toBe(true);
  }
  const scene = data.scenes[0];
  expect(scene.cameraShots).toHaveLength(3);
  expect(scene.focusGraphics).toHaveLength(3);
  expect(scene.elements.filter(element => element.sceneryDepth === "behind").length).toBeGreaterThan(1);
  expect(scene.elements.filter(element => element.sceneryDepth === "front").length).toBeGreaterThan(1);
  const host = scene.elements.find(element => element.characterId === data.characters[0].id)!;
  const before = sceneFramesAt(data, scene, 1).get(host.id)!;
  const walking = sceneFramesAt(data, scene, 7).get(host.id)!;
  const stopped = sceneFramesAt(data, scene, 13).get(host.id)!;
  expect(walking.x - before.x).toBeGreaterThan(80);
  expect(stopped.x - walking.x).toBeGreaterThan(40);
  expect(walking.joints?.leftLeg?.angle).not.toBe(walking.joints?.rightLeg?.angle);
  expect(host.animation?.keyframes.length).toBeGreaterThan(10);
  expect(host.animation?.blink).toBe(true);
  expect(scene.script?.lines).toHaveLength(2);
  expect(scene.script?.lines.every(line => line.takes.length === 0)).toBe(true);
  expect(data.captions).toHaveLength(0);
  expect(data.audioAssets).toHaveLength(3);
  expect(data.audioClips).toHaveLength(3);
  expect(data.audioClips.some(clip => clip.loop)).toBe(true);
});
