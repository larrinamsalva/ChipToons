import { expect, test } from "@playwright/test";
import { planSegments } from "../src/segments";
import { lineStatus } from "../src/script";
import { sceneFramesAt } from "../src/timeline";
import { littleFixersVoiceReadiness } from "../src/little-fixers-voice-readiness";
import { backup, saved } from "./production-helpers";

const TITLE = "Little Fixers Club — Tidy Up Together (4:30 original cartoon; newer voices unrecorded)";
const OPEN = "Watch Scout and Jo tidy up (4:30)";

test("Scout stores only the paper plan, Jo stores adult tools, then the fixed wagon parks with real movement", async ({ page }) => {
  test.setTimeout(165_000);
  await page.goto("./");
  await page.getByRole("button", { name: OPEN, exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible({ timeout: 60_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.characters).toHaveLength(2);
  expect(data.scenes.map(s => s.duration)).toEqual([34, 26, 30, 30, 30, 30, 30, 30, 30]);
  expect(planSegments(data, 60).segments.map(s => s.duration)).toEqual([60, 60, 60, 60, 30]);
  expect(planSegments(data, 120).segments.map(s => s.duration)).toEqual([120, 120, 30]);
  const intro = data.scenes[0];
  for (const line of intro.script!.lines) expect(lineStatus(data, line)).toBe("Approved");
  expect(intro.elements.find(e => e.characterId)?.voiceMouth).toHaveLength(3);
  expect(data.scenes[3].interactions?.map(i => i.kind)).toEqual(["give"]);
  expect(data.scenes[4].interactions?.map(i => i.kind)).toEqual(["put"]);
  expect(data.scenes[5].objectTracks?.[0].changes).toHaveLength(1);
  expect(data.scenes[6].elements.find(e => e.prop === "toy-wagon")?.propAppearance).toBe("fixed-wheel");

  const tidy = data.scenes[7], parking = data.scenes[8];
  const scout = tidy.elements.find(e => e.characterId === data.characters[0].id)!;
  const jo = tidy.elements.find(e => e.characterId === data.characters[1].id)!;
  const plan = tidy.elements.find(e => e.prop === "book")!;
  const toolbox = tidy.elements.find(e => e.prop === "toolbox")!;
  const table = tidy.elements.find(e => e.prop === "table")!;
  const shelf = tidy.elements.find(e => e.prop === "shelf")!;
  expect(plan.sceneryDepth).toBeUndefined();
  expect(toolbox.sceneryDepth).toBeUndefined();
  expect(table.sceneryDepth).toBe("behind");
  expect(shelf.sceneryDepth).toBe("behind");
  expect(tidy.interactions?.map(i => i.kind)).toEqual(["put", "put"]);
  expect(tidy.interactions?.map(i => i.objectId)).toEqual([plan.id, toolbox.id]);
  expect(tidy.interactions?.map(i => i.actorId)).toEqual([scout.id, jo.id]);
  expect(tidy.interactions?.every(i => i.objectId !== tidy.elements.find(e => e.prop === "toy-wagon")?.id)).toBe(true);

  const heldPlan = sceneFramesAt(data, tidy, 10);
  expect(heldPlan.get(plan.id)?.heldBy).toBe(scout.id);
  expect(heldPlan.get(toolbox.id)?.heldBy).toBe(jo.id);
  const planAway = sceneFramesAt(data, tidy, 18);
  expect(planAway.get(plan.id)?.heldBy).toBeUndefined();
  expect(planAway.get(toolbox.id)?.heldBy).toBe(jo.id);
  const stored = sceneFramesAt(data, tidy, 26);
  expect(stored.get(plan.id)?.x).toBeGreaterThan(490);
  expect(stored.get(toolbox.id)?.x).toBeGreaterThan(680);
  expect(stored.get(toolbox.id)?.heldBy).toBeUndefined();
  expect(sceneFramesAt(data, tidy, 4).get(scout.id)!.x)
    .toBeLessThan(sceneFramesAt(data, tidy, 15.5).get(scout.id)!.x - 110);
  expect(tidy.focusGraphics).toHaveLength(4);
  expect(tidy.cameraShots).toHaveLength(3);
  expect(tidy.learningSteps?.length).toBe(4);
  expect(tidy.script?.lines.every(line => lineStatus(data, line) === "Not recorded")).toBe(true);

  const wagon = parking.elements.find(e => e.prop === "toy-wagon")!;
  const walker = parking.elements.find(e => e.characterId === data.characters[0].id)!;
  const adult = parking.elements.find(e => e.characterId === data.characters[1].id)!;
  expect(wagon.propAppearance).toBe("fixed-wheel");
  expect(sceneFramesAt(data, parking, 2).get(wagon.id)!.x).toBeLessThan(270);
  expect(sceneFramesAt(data, parking, 25).get(wagon.id)!.x).toBeGreaterThan(610);
  expect(sceneFramesAt(data, parking, 3).get(walker.id)!.x)
    .toBeLessThan(sceneFramesAt(data, parking, 20).get(walker.id)!.x - 100);
  expect(sceneFramesAt(data, parking, 3).get(adult.id)!.x)
    .toBeLessThan(sceneFramesAt(data, parking, 20).get(adult.id)!.x - 100);
  expect(parking.cameraShots).toHaveLength(3);
  expect(parking.focusGraphics).toHaveLength(4);
  expect(parking.elements.some(e => e.prop === "chair")).toBe(false);
  expect(parking.script?.lines.every(line => lineStatus(data, line) === "Not recorded")).toBe(true);

  const voice = littleFixersVoiceReadiness(data);
  expect(voice.total).toBe(19);
  expect(voice.approved).toBe(3);
  expect(voice.unrecorded).toBe(16);
  expect(voice.complete).toBe(false);
  await page.getByRole("button", { name: "Finish the Little Fixers voices", exact: true }).click();
  const board = page.getByRole("dialog", { name: "Little Fixers · Finish the Voices" });
  await expect(board).toBeVisible();
  await expect(board.getByText("3 of 19 script lines approved")).toBeVisible();
  await expect(board.getByRole("button", { name: /^Record scene/ })).toHaveCount(16);
  await board.getByRole("button", { name: "Return to my cartoon" }).click();

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", { name: `Continue ${TITLE}`, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  const reopened = (await backup(page)).data;
  expect(reopened.scenes).toEqual(data.scenes);
  expect(reopened.characters).toEqual(data.characters);
  expect(reopened.audioClips).toEqual(data.audioClips);
  expect(reopened.captions).toEqual(data.captions);
});
