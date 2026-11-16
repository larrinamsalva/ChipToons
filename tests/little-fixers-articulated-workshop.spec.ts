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
  // Both new performers use genuine vector knee and shin joints, not
  // image overlays; the mobile Stage test stays in the unit suite to
  // avoid selecting hidden responsive thumbnails.
  for (const character of data.characters) {
    const parts = character.puppet!.parts;
    for (const side of ["left", "right"] as const) {
      const leg = parts.find(part => part.role === `${side}Leg`)!;
      const shin = parts.find(part => part.role === `${side}Shin`)!;
      const foot = parts.find(part => part.role === `${side}Foot`)!;
      expect(shin.parentId).toBe(leg.id);
      expect(foot.parentId).toBe(shin.id);
      expect(shin.y + foot.y).toBe(38);
    }
  }
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


test("workshop hairstyles can be edited, saved, undone and restored without changing animations", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByRole("button", {
    name: "Watch Scout & Jo bend their elbows (0:30)", exact: true,
  }).click();
  await saved(page);
  const original = (await backup(page)).data;
  const scout = original.characters.find(character => character.name.startsWith("Scout"))!;
  const jo = original.characters.find(character => character.name.startsWith("Helper Jo"))!;
  expect(scout.puppet?.headStyle).toBe("short-side-part");
  expect(jo.puppet?.headStyle).toBe("soft-waves");

  // Choose the actual puppet track; the first scene element happens to
  // be background scenery, not the performer whose hair is editable.
  // The timeline has TWO Scout labels: the main character track and
  // its separate face/pose subtrack. Select the main track by its exact
  // accessible name on desktop, phone and tablet (strict Playwright).
  await page.getByRole("button", {
    name: "Select Scout — Little Fixers Workshop Guide track",
    exact: true,
  }).click();
  const mobilePanels = page.getByRole("navigation", { name: "Editor panels" });
  if (await mobilePanels.isVisible())
    await mobilePanels.getByRole("button", { name: "Edit scene" }).click();
  const hairstyles = page.getByRole("combobox", { name: "Workshop hairstyle" });
  await expect(hairstyles).toBeVisible();
  await expect(hairstyles).toHaveValue("short-side-part");

  await hairstyles.selectOption("soft-waves");
  await saved(page);
  const changed = (await backup(page)).data;
  expect(changed.characters.find(character => character.id === scout.id)?.puppet?.headStyle)
    .toBe("soft-waves");
  expect(changed.characters.find(character => character.id === jo.id)?.puppet)
    .toEqual(jo.puppet);
  expect(changed.scenes).toEqual(original.scenes);
  expect(changed.audioClips).toEqual(original.audioClips);

  await page.getByRole("button", { name: "Undo edit" }).click();
  await saved(page);
  expect((await backup(page)).data.characters
    .find(character => character.id === scout.id)?.puppet?.headStyle)
    .toBe("short-side-part");

  await page.getByRole("button", { name: "Redo edit" }).click();
  await saved(page);
  expect((await backup(page)).data.characters
    .find(character => character.id === scout.id)?.puppet?.headStyle)
    .toBe("soft-waves");
  await page.reload();
  await page.getByRole("button", {
    name: `Continue ${ARTICULATED_WORKSHOP_TITLE}`, exact: true,
  }).click();
  await saved(page);
  expect((await backup(page)).data.characters
    .find(character => character.id === scout.id)?.puppet?.headStyle)
    .toBe("soft-waves");
});
