import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { lineStatus } from "../src/script";
import { planSegments } from "../src/segments";
import { sceneFramesAt } from "../src/timeline";
import { backup, saved } from "./production-helpers";

// Do not import a Vite-only starter module into Playwright's Node process:
const TITLE = "Little Fixers Club — Episode 1: Look for Clues (5-minute motion preview; new voices pending)";

async function poster(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Turn My Picture Into a Cartoon", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Turn My Picture Into a Cartoon" });
  await dialog.getByRole("button", { name: "Use the Little Fixers Club poster", exact: true }).click();
  return dialog;
}

test("Look for Clues preserves earlier animation, uses real chair and host motion, and keeps voices honest", async ({ page }) => {
  test.setTimeout(120_000);
  const dialog = await poster(page);
  await dialog.getByRole("button", { name: "Open animated Look for Clues (5:00; voices to record)", exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 50_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.audioAssets).toHaveLength(23);
  expect(new Set(data.audioAssets.map(asset => asset.name)).size).toBe(23);
  expect(data.scenes.map(s => s.duration))
    .toEqual([15, 15, 15, 15, 8, 17, 18, 16, 31, 30, 30, 30, 30, 30]);
  expect(data.scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBe(300);
  expect(planSegments(data, 60).oversized).toEqual([]);
  expect(planSegments(data, 120).segments.map(s => s.duration)).toEqual([119, 91, 90]);

  const original = data.scenes.slice(0, 8).flatMap(scene => scene.script?.lines ?? []);
  expect(original).toHaveLength(17);
  expect(original.every(line => lineStatus(data, line) === "Approved")).toBe(true);
  const [observe, gap] = data.scenes.slice(12);
  expect(observe.title).toContain("Look for Clues");
  expect(gap.title).toContain("Look for Clues");
  expect(observe.script?.lines).toHaveLength(2);
  expect(gap.script?.lines).toHaveLength(2);
  expect([...observe.script!.lines, ...gap.script!.lines].every(line =>
    lineStatus(data, line) === "Not recorded")).toBe(true);
  expect(data.captions.filter(cue => cue.sceneId === observe.id || cue.sceneId === gap.id)).toHaveLength(0);
  expect(observe.cameraShots).toHaveLength(1);
  expect(gap.cameraShots).toHaveLength(2);
  expect(observe.focusGraphics).toHaveLength(3);
  expect(gap.focusGraphics).toHaveLength(3);

  const chair = observe.elements.find(item => !!item.assetId)!;
  const host = observe.elements.find(item => !!item.characterId)!;
  expect(chair.animation?.keyframes.length).toBeGreaterThan(4);
  expect(host.animation?.keyframes.length).toBeGreaterThan(4);
  const still = sceneFramesAt(data, observe, 9).get(chair.id)!;
  const wobble = sceneFramesAt(data, observe, 12).get(chair.id)!;
  expect(Math.abs(still.x - wobble.x)).toBeGreaterThan(3);
  expect(Math.abs(still.rotation - wobble.rotation)).toBeGreaterThan(1);
  const marked = gap.focusGraphics?.find(item => item.kind === "circle");
  expect(marked?.target.kind).toBe("object");
  expect(data.audioClips.filter(clip => [observe.id, gap.id].includes(clip.sceneId ?? "")))
    .toHaveLength(5);
});

test("full 20-minute script retains 5 minutes of motion and leaves the next 15 minutes clearly unfinished", async ({ page }) => {
  test.setTimeout(120_000);
  const dialog = await poster(page);
  await dialog.getByRole("button", {
    name: "Open full 20-minute script draft (unfinished animation)", exact: true,
  }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 50_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBe(1200);
  expect(data.scenes).toHaveLength(29);
  expect(data.scenes[12].title).toContain("Look for Clues");
  expect(data.scenes[13].title).toContain("Look for Clues");
  expect(data.scenes[12].elements.some(element => !!element.animation?.keyframes.length)).toBe(true);
  expect(data.scenes.slice(14).every(scene => scene.title.startsWith("Script draft"))).toBe(true);
  expect(data.scenes[14].script?.lines[0].takes).toHaveLength(0);
});
