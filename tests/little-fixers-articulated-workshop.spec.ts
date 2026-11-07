import { expect, test } from "@playwright/test";
import { handAt } from "../src/interaction-motion";
import { sceneFramesAt } from "../src/timeline";
import { backup, saved } from "./production-helpers";
import { ARTICULATED_WORKSHOP_TITLE } from "../src/little-fixers-articulated-workshop";

test("Scout and Helper Jo's real articulated workshop opens from the home screen and restores as an editable cartoon", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByRole("button", {
    name: "Watch Scout & Jo bend their elbows (0:30)", exact: true,
  }).click();
  await expect(page.getByRole("heading", {
    name: ARTICULATED_WORKSHOP_TITLE, exact: true,
  })).toBeVisible({ timeout: 60_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.visualStyle).toBe("storybook-cinematic");
  expect(data.scenes.map(scene => scene.duration)).toEqual([30]);
  expect(data.characters).toHaveLength(2);
  expect(data.assets).toHaveLength(0);
  expect(data.scenes[0].interactions?.map(action => action.kind)).toEqual(["give"]);
  const scene = data.scenes[0], handoff = scene.interactions![0];
  const frames = sceneFramesAt(data, scene, 9.5);
  expect(frames.get(handoff.actorId)?.joints?.rightForearm).toBeDefined();
  expect(frames.get(handoff.transfer!.actorId)?.joints?.leftForearm).toBeDefined();
  const after = sceneFramesAt(data, scene, 10.3);
  const recipient = scene.elements.find(item => item.id === handoff.transfer!.actorId)!;
  const held = after.get(handoff.objectId)!;
  const attached = handAt(data.characters[1], recipient,
    after.get(recipient.id)!, handoff.transfer!.grip);
  expect(held.heldBy).toBe(recipient.id);
  expect(held.x).toBeCloseTo(attached.x, 6);
  expect(held.y).toBeCloseTo(attached.y, 6);
  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", {
    name: `Continue ${ARTICULATED_WORKSHOP_TITLE}`, exact: true,
  }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  const reopened = (await backup(page)).data;
  expect(reopened.scenes).toEqual(data.scenes);
  expect(reopened.characters).toEqual(data.characters);
});
