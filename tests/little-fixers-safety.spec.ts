import { expect, test } from "@playwright/test";
import { SAFETY_PREVIEW_TITLE } from "../src/little-fixers-safety";
import { lineStatus } from "../src/script";
import { planSegments } from "../src/segments";
import { sceneFramesAt } from "../src/timeline";
import { backup, saved } from "./production-helpers";

test("Little Fixers Safety First adds real, editable and phone-exportable motion without faking new voices", async ({ page }) => {
  test.setTimeout(100_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Turn My Picture Into a Cartoon", exact: true }).click();
  const picture = page.getByRole("dialog", { name: "Turn My Picture Into a Cartoon" });
  await picture.getByRole("button", { name: "Use the Little Fixers Club poster", exact: true }).click();
  await picture.getByRole("button", {
    name: "Open animated Safety First (3:00; new voice to record)",
    exact: true,
  }).click();
  await expect(page.getByRole("heading", { name: SAFETY_PREVIEW_TITLE, exact: true }))
    .toBeVisible({ timeout: 40_000 });
  await saved(page);
  const { data } = await backup(page);

  expect(data.scenes.map(scene => scene.duration))
    .toEqual([15, 15, 15, 15, 8, 17, 18, 16, 31, 30]);
  expect(planSegments(data, 60).oversized).toEqual([]);
  expect(planSegments(data, 120).segments.map(part => part.duration)).toEqual([119, 61]);

  const originalVoices = data.scenes.slice(0, 8).flatMap(scene => scene.script?.lines ?? []);
  expect(originalVoices).toHaveLength(17);
  expect(originalVoices.every(line => lineStatus(data, line) === "Approved")).toBe(true);

  const [clear, ask] = data.scenes.slice(8);
  expect(clear.script?.lines).toHaveLength(2);
  expect(ask.script?.lines).toHaveLength(2);
  for (const line of [...clear.script!.lines, ...ask.script!.lines]) {
    expect(lineStatus(data, line)).toBe("Not recorded");
  }
  expect(clear.cameraShots).toHaveLength(1);
  expect(ask.cameraShots).toHaveLength(2);
  expect(clear.focusGraphics?.length).toBeGreaterThan(1);
  expect(ask.focusGraphics?.length).toBeGreaterThan(1);

  const host = clear.elements.find(element => element.characterId)!;
  const toy = clear.elements.find(element => element.prop === "toy")!;
  expect(host.animation?.keyframes.length).toBeGreaterThan(4);
  expect(toy.animation?.keyframes.length).toBeGreaterThan(4);
  const before = sceneFramesAt(data, clear, 10).get(toy.id)!;
  const after = sceneFramesAt(data, clear, 27).get(toy.id)!;
  expect(after.x - before.x).toBeGreaterThan(170);
  expect(before.y - after.y).toBeGreaterThan(100);
  const effects = data.audioClips.filter(clip => [clear.id, ask.id].includes(clip.sceneId ?? ""));
  expect(effects).toHaveLength(5);
  expect(effects.some(clip => clip.loop)).toBe(true);
  expect(data.captions.filter(caption => [clear.id, ask.id].includes(caption.sceneId))).toHaveLength(0);
});
