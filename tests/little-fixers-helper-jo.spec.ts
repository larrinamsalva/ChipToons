import { expect, test } from "@playwright/test";
import { planSegments } from "../src/segments";
import { lineStatus } from "../src/script";
import { sceneFramesAt } from "../src/timeline";
import { littleFixersVoiceReadiness } from "../src/little-fixers-voice-readiness";
import { backup, saved } from "./production-helpers";

const TITLE = "Little Fixers Club — Scout Asks Helper Jo (2-minute original cartoon; new voices pending)";
const OPEN = "Watch Scout meet Helper Jo (2:00)";

test("Helper Jo is an original grown-up puppet who really walks in and receives Scout's checklist", async ({ page }) => {
  test.setTimeout(145_000);
  await page.goto("./");
  await page.getByRole("button", { name: OPEN, exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 60_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.characters).toHaveLength(2);
  expect(data.characters[1].name).toContain("Helper Jo");
  expect(data.characters[1].puppet?.costume).toBe("workshop");
  expect(data.scenes.map(scene => scene.duration)).toEqual([34, 26, 30, 30]);
  expect(planSegments(data, 60).segments.map(segment => segment.duration)).toEqual([60, 60]);
  expect(planSegments(data, 120).segments.map(segment => segment.duration)).toEqual([120]);
  expect(planSegments(data, 120).oversized).toEqual([]);

  const [intro, checklistScene, chairScene, joScene] = data.scenes;
  expect(intro.elements.find(e => e.characterId === data.characters[0].id)?.voiceMouth)
    .toHaveLength(3);
  for (const line of intro.script!.lines) expect(lineStatus(data, line)).toBe("Approved");
  const oldPending = [...checklistScene.script!.lines, ...chairScene.script!.lines];
  expect(oldPending.every(line => lineStatus(data, line) === "Not recorded")).toBe(true);
  expect(joScene.script?.lines).toHaveLength(2);
  expect(joScene.script!.lines.every(line => lineStatus(data, line) === "Not recorded")).toBe(true);
  expect(data.captions.every(item => item.sceneId === intro.id)).toBe(true);
  const voice = littleFixersVoiceReadiness(data);
  expect(voice.total).toBe(9);
  expect(voice.approved).toBe(3);
  expect(voice.unrecorded).toBe(6);
  expect(voice.complete).toBe(false);

  const scout = joScene.elements.find(e => e.characterId === data.characters[0].id)!;
  const jo = joScene.elements.find(e => e.characterId === data.characters[1].id)!;
  const chair = joScene.elements.find(e => e.prop === "chair")!;
  const book = joScene.elements.find(e => e.prop === "book")!;
  expect(scout.id).not.toBe(jo.id);
  expect(jo.scale).toBeGreaterThan(scout.scale);
  expect(scout.animation?.keyframes.length).toBeGreaterThanOrEqual(10);
  expect(jo.animation?.keyframes.length).toBeGreaterThanOrEqual(14);
  expect(scout.voiceMouth).toBeUndefined();
  expect(jo.voiceMouth).toBeUndefined();
  expect(joScene.interactions?.map(x => x.kind)).toEqual(["give"]);
  expect(joScene.interactions![0].transfer?.actorId).toBe(jo.id);
  expect(joScene.cameraShots).toHaveLength(3);
  expect(joScene.focusGraphics).toHaveLength(4);

  const arriving = sceneFramesAt(data, joScene, 1);
  const ready = sceneFramesAt(data, joScene, 9);
  const scoutHolding = sceneFramesAt(data, joScene, 13);
  const adultHolding = sceneFramesAt(data, joScene, 17);
  const final = sceneFramesAt(data, joScene, 24);
  expect(arriving.get(jo.id)!.x - ready.get(jo.id)!.x).toBeGreaterThan(200);
  expect(ready.get(jo.id)!.joints?.leftLeg?.angle).not
    .toBe(arriving.get(jo.id)!.joints?.leftLeg?.angle);
  expect(scoutHolding.get(book.id)?.heldBy).toBe(scout.id);
  expect(adultHolding.get(book.id)?.heldBy).toBe(jo.id);
  expect(final.get(book.id)?.heldBy).toBeUndefined();
  // Nobody touches or tests the unstable chair; it remains fixed in place.
  expect(joScene.interactions?.every(i => i.objectId !== chair.id)).toBe(true);
  expect(arriving.get(chair.id)?.x).toBe(final.get(chair.id)?.x);
  expect(joScene.action).toContain("No repair or chair testing");

  await page.getByRole("button", { name: "Finish the Little Fixers voices", exact: true }).click();
  const board = page.getByRole("dialog", { name: "Little Fixers · Finish the Voices" });
  await expect(board).toBeVisible();
  await expect(board.getByText("3 of 9 script lines approved")).toBeVisible();
  await expect(board.getByRole("button", { name: /^Record scene/ })).toHaveCount(6);
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
