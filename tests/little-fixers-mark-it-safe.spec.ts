import { expect, test } from "@playwright/test";
import { planSegments } from "../src/segments";
import { lineStatus } from "../src/script";
import { sceneFramesAt } from "../src/timeline";
import { littleFixersVoiceReadiness } from "../src/little-fixers-voice-readiness";
import { backup, saved } from "./production-helpers";

const TITLE = "Little Fixers Club — Mark It Safe (2:30 original cartoon; later dialogue unrecorded)";
const OPEN = "Watch Scout mark it safe (2:30)";

test("original Scout and Jo safely mark the chair out of use with a real puppet-held sign", async ({ page }) => {
  test.setTimeout(145_000);
  await page.goto("./");
  await page.getByRole("button", { name: OPEN, exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 60_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.characters.map(c => c.name)).toHaveLength(2);
  expect(data.scenes.map(s => s.duration)).toEqual([34, 26, 30, 30, 30]);
  expect(planSegments(data, 60).segments.map(s => s.duration)).toEqual([60, 60, 30]);
  expect(planSegments(data, 120).segments.map(s => s.duration)).toEqual([120, 30]);
  const [opening, , , joScene, newScene] = data.scenes;
  expect(opening.elements.find(e => e.characterId === data.characters[0].id)?.voiceMouth).toHaveLength(3);
  for (const line of opening.script!.lines) expect(lineStatus(data, line)).toBe("Approved");
  expect(joScene.interactions![0].kind).toBe("give");
  expect(newScene.script!.lines).toHaveLength(2);
  expect(newScene.script!.lines.every(line => lineStatus(data, line) === "Not recorded")).toBe(true);
  expect(data.captions.every(item => item.sceneId === opening.id)).toBe(true);

  const scout = newScene.elements.find(e => e.characterId === data.characters[0].id)!;
  const jo = newScene.elements.find(e => e.characterId === data.characters[1].id)!;
  const chair = newScene.elements.find(e => e.prop === "chair")!;
  const sign = newScene.elements.find(e => e.prop === "sign")!;
  expect(scout.animation?.keyframes.length).toBeGreaterThan(9);
  expect(jo.animation?.keyframes.length).toBeGreaterThan(12);
  expect(newScene.interactions?.map(i => i.kind)).toEqual(["put"]);
  expect(newScene.interactions![0].actorId).toBe(jo.id);
  expect(newScene.interactions![0].objectId).toBe(sign.id);
  expect(newScene.interactions!.every(i => i.objectId !== chair.id && i.actorId !== scout.id)).toBe(true);
  expect(newScene.focusGraphics?.map(item => item.text)).toEqual([
    "1. NOTICE a problem", "2. STOP using it",
    "3. MARK it: OUT OF USE", "4. PLAN with a grown-up",
  ]);
  expect(newScene.cameraShots).toHaveLength(3);

  const before = sceneFramesAt(data, newScene, 2);
  const reach = sceneFramesAt(data, newScene, 8);
  const attached = sceneFramesAt(data, newScene, 12);
  const released = sceneFramesAt(data, newScene, 24);
  expect(attached.get(sign.id)?.heldBy).toBe(jo.id);
  expect(released.get(sign.id)?.heldBy).toBeUndefined();
  expect(Math.abs(released.get(sign.id)!.x - attached.get(sign.id)!.x)).toBeGreaterThan(12);
  expect(released.get(sign.id)?.x).toBeGreaterThan(620);
  expect(reach.get(jo.id)!.x).toBeGreaterThan(before.get(jo.id)!.x);
  expect(released.get(chair.id)?.x).toBe(before.get(chair.id)?.x);
  expect(released.get(chair.id)?.rotation).toBe(before.get(chair.id)?.rotation);
  expect(scout.id).not.toBe(jo.id);

  const voice = littleFixersVoiceReadiness(data);
  expect(voice.total).toBe(11);
  expect(voice.approved).toBe(3);
  expect(voice.unrecorded).toBe(8);
  expect(voice.complete).toBe(false);
  await page.getByRole("button", { name: "Finish the Little Fixers voices", exact: true }).click();
  const board = page.getByRole("dialog", { name: "Little Fixers · Finish the Voices" });
  await expect(board).toBeVisible();
  await expect(board.getByText("3 of 11 script lines approved")).toBeVisible();
  await expect(board.getByRole("button", { name: /^Record scene/ })).toHaveCount(8);
  await board.getByRole("button", { name: "Return to my cartoon" }).click();

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", { name: `Continue ${TITLE}`, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  const reopened = (await backup(page)).data;
  expect(reopened.scenes).toEqual(data.scenes);
  expect(reopened.characters).toEqual(data.characters);
  expect(reopened.audioClips).toEqual(data.audioClips);
});
