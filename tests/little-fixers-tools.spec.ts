import { expect, test } from "@playwright/test";
import { lineStatus } from "../src/script";
import { planSegments } from "../src/segments";
import { sceneFramesAt } from "../src/timeline";
import { backup, saved } from "./production-helpers";

// Keep the title literal here: importing a starter module directly from
// Playwright's Node process would evaluate Vite-only import.meta.glob.
const TITLE = "Little Fixers Club — Episode 1: Meet the Tools (4-minute motion preview; voices pending)";

async function poster(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Turn My Picture Into a Cartoon", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Turn My Picture Into a Cartoon" });
  await dialog.getByRole("button", { name: "Use the Little Fixers Club poster", exact: true }).click();
  return dialog;
}

test("Tools lesson carries original voiced opening, safety animation and real new motion", async ({ page }) => {
  test.setTimeout(120_000);
  const dialog = await poster(page);
  await dialog.getByRole("button", {
    name: "Open animated Meet the Tools (4:00; new voices to record)", exact: true,
  }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible({ timeout: 50_000 });
  await saved(page);
  const { data } = await backup(page);
  // Add only the paper cue after Safety First; keep the media graph valid.
  expect(data.audioAssets).toHaveLength(23);
  expect(new Set(data.audioAssets.map(asset => asset.name)).size).toBe(data.audioAssets.length);
  expect(data.scenes.map(scene => scene.duration)).toEqual([15, 15, 15, 15, 8, 17, 18, 16, 31, 30, 30, 30]);
  expect(data.scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBe(240);
  expect(planSegments(data, 60).oversized).toEqual([]);
  expect(planSegments(data, 120).segments.map(segment => segment.duration)).toEqual([119, 91, 30]);
  expect(data.scenes.slice(0, 8).flatMap(scene => scene.script?.lines ?? [])
    .every(line => lineStatus(data, line) === "Approved")).toBe(true);
  const newScenes = data.scenes.slice(10);
  expect(newScenes).toHaveLength(2);
  expect(newScenes.flatMap(scene => scene.script?.lines ?? [])).toHaveLength(4);
  for (const line of newScenes.flatMap(scene => scene.script?.lines ?? [])) {
    expect(lineStatus(data, line)).toBe("Not recorded");
  }
  expect(newScenes.flatMap(scene => data.captions.filter(cue => cue.sceneId === scene.id))).toHaveLength(0);
  expect(newScenes.flatMap(scene => scene.cameraShots ?? [])).toHaveLength(3);
  expect(newScenes.flatMap(scene => scene.focusGraphics ?? []).length).toBeGreaterThanOrEqual(6);
  const book = newScenes[0].elements.find(element => element.prop === "book")!;
  expect(book.animation?.keyframes.length).toBeGreaterThan(4);
  const first = sceneFramesAt(data, newScenes[0], 4).get(book.id)!;
  const raised = sceneFramesAt(data, newScenes[0], 21).get(book.id)!;
  expect(raised.y).toBeLessThan(first.y - 60);
  expect(raised.x).toBeGreaterThan(first.x + 50);
  const host = newScenes[0].elements.find(element => element.characterId)!;
  expect(host.animation?.keyframes.length).toBeGreaterThan(4);
  const effects = data.audioClips.filter(clip => newScenes.some(scene => scene.id === clip.sceneId));
  expect(effects).toHaveLength(6);
  expect(effects.some(clip => clip.loop)).toBe(true);
});

test("20-minute draft advances its animated portion through Meet the Tools without faking voices", async ({ page }) => {
  test.setTimeout(120_000);
  const dialog = await poster(page);
  await dialog.getByRole("button", {
    name: "Open full 20-minute script draft (unfinished animation)", exact: true,
  }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 50_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBe(1200);
  expect(data.scenes).toHaveLength(28);
  expect(data.scenes[10].title).toContain("Meet the Tools");
  expect(data.scenes[11].title).toContain("Meet the Tools");
  expect(data.scenes[10].elements.some(element => !!element.animation?.keyframes.length)).toBe(true);
  expect(data.scenes[12].title).toMatch(/^Script draft/);
  expect(data.scenes[12].script?.lines[0].takes).toHaveLength(0);
});
