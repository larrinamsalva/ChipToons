import { expect, test } from "@playwright/test";
import { planSegments } from "../src/segments";
import { lineStatus } from "../src/script";
import { sceneFramesAt } from "../src/timeline";
import { objectAppearanceAt } from "../src/transform-motion";
import { littleFixersVoiceReadiness } from "../src/little-fixers-voice-readiness";
import { backup, saved } from "./production-helpers";

const TITLE = "Little Fixers Club — Fix the Little Wagon (3:30 original cartoon; new voices pending)";
const BUTTON = "Watch Scout fix a toy wagon wheel (3:30)";

test("Scout watches Jo fix a toy wheel and both test the visibly restored rolling wagon", async ({ page }) => {
  test.setTimeout(155_000);
  await page.goto("./");
  await page.getByRole("button", { name: BUTTON, exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible({ timeout: 55_000 });
  await saved(page);
  const { data } = await backup(page);

  expect(data.scenes.map(scene => scene.duration)).toEqual([34, 26, 30, 30, 30, 30, 30]);
  expect(planSegments(data, 60).segments.map(s => s.duration)).toEqual([60, 60, 60, 30]);
  expect(planSegments(data, 120).segments.map(s => s.duration)).toEqual([120, 90]);
  expect(data.assets).toHaveLength(0);
  expect(data.characters).toHaveLength(2);
  const [opening, , chair, handoff, marked, repair, testWagon] = data.scenes;
  for (const line of opening.script!.lines) expect(lineStatus(data, line)).toBe("Approved");
  expect(opening.elements.find(e => e.characterId)?.voiceMouth).toHaveLength(3);
  expect(handoff.interactions?.map(i => i.kind)).toEqual(["give"]);
  expect(marked.interactions?.map(i => i.kind)).toEqual(["put"]);
  expect(chair.elements.find(e => e.prop === "chair")).toBeTruthy();
  expect(marked.elements.find(e => e.prop === "chair")?.name).toContain("Wobbly");
  expect(repair.elements.some(e => e.prop === "chair")).toBe(false);

  const scout = repair.elements.find(e => e.characterId === data.characters[0].id)!;
  const jo = repair.elements.find(e => e.characterId === data.characters[1].id)!;
  const toy = repair.elements.find(e => e.prop === "toy-wagon")!;
  const repaired = testWagon.elements.find(e => e.prop === "toy-wagon")!;
  expect(scout.animation?.keyframes.length).toBeGreaterThanOrEqual(10);
  expect(jo.animation?.keyframes.length).toBeGreaterThanOrEqual(10);
  expect(repair.objectTracks).toHaveLength(1);
  const wheel = repair.objectTracks![0];
  expect(wheel.objectId).toBe(toy.id);
  const at = (t: number) => objectAppearanceAt(repair, wheel, t).state?.art;
  expect(at(4)).toEqual({ kind: "prop", appearance: "loose-wheel" });
  expect(at(14.5)).toEqual({ kind: "prop", appearance: "loose-wheel" });
  expect(at(17.2)).toEqual({ kind: "prop", appearance: "fixed-wheel" });
  expect(wheel.changes).toHaveLength(1);
  expect(wheel.changes[0].cue?.moment).toBe("Finish");
  expect(repair.interactions?.map(i => i.actorId)).toEqual([jo.id]);
  expect(repair.interactions?.[0].kind).toBe("point");
  expect(repair.interactions?.[0].objectId).toBe(toy.id);
  expect(repair.learningSteps?.some(x => x.cue?.kind === "change")).toBe(true);
  expect(repair.cameraShots).toHaveLength(3);
  expect(repair.focusGraphics).toHaveLength(4);
  expect(repair.script!.lines.every(line => lineStatus(data, line) === "Not recorded")).toBe(true);
  expect(testWagon.script!.lines.every(line => lineStatus(data, line) === "Not recorded")).toBe(true);

  expect(repaired.propAppearance).toBe("fixed-wheel");
  expect(testWagon.objectTracks ?? []).toHaveLength(0);
  expect(sceneFramesAt(data, testWagon, 1).get(repaired.id)?.x).toBeLessThan(430);
  expect(sceneFramesAt(data, testWagon, 19).get(repaired.id)?.x).toBeGreaterThan(620);
  expect(testWagon.cameraShots).toHaveLength(3);
  expect(testWagon.focusGraphics).toHaveLength(4);
  const readiness = littleFixersVoiceReadiness(data);
  expect(readiness.total).toBe(15);
  expect(readiness.approved).toBe(3);
  expect(readiness.unrecorded).toBe(12);
  expect(readiness.complete).toBe(false);

  await page.getByRole("button", { name: "Finish the Little Fixers voices", exact: true }).click();
  const board = page.getByRole("dialog", { name: "Little Fixers · Finish the Voices" });
  await expect(board).toBeVisible();
  await expect(board.getByText("3 of 15 script lines approved")).toBeVisible();
  await expect(board.getByRole("button", { name: /^Record scene/ })).toHaveCount(12);
  await board.getByRole("button", { name: "Return to my cartoon" }).click();

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", { name: `Continue ${TITLE}`, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  const restored = (await backup(page)).data;
  expect(restored.scenes).toEqual(data.scenes);
  expect(restored.characters).toEqual(data.characters);
  expect(restored.audioClips).toEqual(data.audioClips);
  expect(restored.captions).toEqual(data.captions);
});
