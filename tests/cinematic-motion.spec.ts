import { expect, test } from "@playwright/test";
import { sceneFramesAt } from "../src/timeline";
import { handAt } from "../src/interaction-motion";
import { lineStatus } from "../src/script";
import { backup, saved } from "./production-helpers";

const TITLE = "Little Fixers Club — Mark It Safe (2:30 original cartoon; later dialogue unrecorded)";

test("Cinematic motion stays coordinated with Jo's actual held safety sign and the original approved voices", async ({ page }) => {
  test.setTimeout(155_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Watch Scout mark it safe (2:30)", exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible({ timeout: 55_000 });
  await saved(page);
  const original = (await backup(page)).data;
  expect(original.visualStyle).toBeUndefined();
  const scene = original.scenes[4];
  const jo = scene.elements.find(e => e.characterId === original.characters[1].id)!;
  const sign = scene.elements.find(e => e.prop === "sign")!;
  const interaction = scene.interactions![0];
  const oldFrame = sceneFramesAt(original, scene, 7.9).get(jo.id)!;
  for (const line of original.scenes[0].script!.lines)
    expect(lineStatus(original, line)).toBe("Approved");

  const toggle = page.getByRole("checkbox", { name: "Cinematic Storybook look", exact: true });
  await toggle.check();
  await saved(page);
  const premium = (await backup(page)).data;
  expect(premium.visualStyle).toBe("storybook-cinematic");
  expect(premium.scenes).toEqual(original.scenes);
  expect(premium.characters).toEqual(original.characters);
  expect(premium.audioClips).toEqual(original.audioClips);
  expect(premium.captions).toEqual(original.captions);
  expect(premium.scenes[0].elements.find(e => e.characterId)?.voiceMouth)
    .toEqual(original.scenes[0].elements.find(e => e.characterId)?.voiceMouth);

  // Test Jo during a whole walking beat, not just the easing-in instant:
  // the actor may barely move at an individual keyframe boundary.
  const times = [6.5, 6.9, 7.65, 7.9, 8.05, 8.25, 9.2];
  const changes = times.map(time => {
    const classic = sceneFramesAt(original, scene, time).get(jo.id)!;
    const polished = sceneFramesAt(premium, scene, time).get(jo.id)!;
    expect(polished.x).toBeCloseTo(classic.x, 6);
    return Math.abs(polished.rotation - classic.rotation) +
      Math.abs(polished.y - classic.y);
  });
  expect(Math.max(...changes)).toBeGreaterThan(0.25);
  const newFrame = sceneFramesAt(premium, scene, 7.9).get(jo.id)!;
  expect(newFrame.x).toBeCloseTo(oldFrame.x, 6);
  expect(sceneFramesAt(premium, scene, 7.9).get(jo.id)).toEqual(newFrame);

  const holding = sceneFramesAt(premium, scene, 12.1);
  expect(holding.get(sign.id)?.heldBy).toBe(jo.id);
  const hand = handAt(premium.characters[1], jo, holding.get(jo.id)!, interaction.grip);
  expect(holding.get(sign.id)!.x).toBeCloseTo(hand.x, 4);
  expect(holding.get(sign.id)!.y).toBeCloseTo(hand.y, 4);
  const after = sceneFramesAt(premium, scene, 24.0);
  expect(after.get(sign.id)?.heldBy).toBeUndefined();
  expect(after.get(sign.id)?.x).toBeGreaterThan(620);
  expect(premium.scenes[4].elements.find(e => e.prop === "chair"))
    .toEqual(original.scenes[4].elements.find(e => e.prop === "chair"));

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", { name: `Continue ${TITLE}`, exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Cinematic Storybook look" })).toBeChecked();
  await saved(page);
  expect((await backup(page)).data.visualStyle).toBe("storybook-cinematic");
  await page.getByRole("checkbox", { name: "Cinematic Storybook look" }).uncheck();
  await saved(page);
  const reverted = (await backup(page)).data;
  expect(reverted.visualStyle).toBeUndefined();
  expect(reverted.scenes).toEqual(original.scenes);
});
