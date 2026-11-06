import { expect, test } from "@playwright/test";
import { planSegments } from "../src/segments";
import { lineStatus } from "../src/script";
import { sceneFramesAt } from "../src/timeline";
import { backup, saved } from "./production-helpers";

const TITLE = "Little Fixers Club — The Wobbly Chair (90-second original cartoon; later scenes need voices)";

test("original full-body Scout notices a truly wobbly chair, steps back and asks for adult help", async ({ page }) => {
  test.setTimeout(130_000);
  await page.goto("./");
  await page.getByRole("button", {
    name: "Watch Scout and the wobbly chair (1:30)", exact: true,
  }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 55_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.title).toBe(TITLE);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.characters).toHaveLength(1);
  expect(data.characters[0].puppet?.costume).toBe("workshop");
  expect(data.scenes.map(scene => scene.duration)).toEqual([34, 26, 30]);
  expect(planSegments(data, 60).segments.map(segment => segment.duration)).toEqual([60, 30]);
  expect(planSegments(data, 120).segments.map(segment => segment.duration)).toEqual([90]);

  const [first, second, third] = data.scenes;
  expect(first.elements.find(e => e.characterId)?.voiceMouth).toHaveLength(3);
  for (const line of first.script!.lines) expect(lineStatus(data, line)).toBe("Approved");
  expect(second.script?.lines).toHaveLength(2);
  expect(third.script?.lines).toHaveLength(2);
  expect([...second.script!.lines, ...third.script!.lines]
    .every(line => lineStatus(data, line) === "Not recorded")).toBe(true);
  expect(data.captions.every(caption => caption.sceneId === first.id)).toBe(true);

  const scout = third.elements.find(e => e.characterId === data.characters[0].id)!;
  const chair = third.elements.find(e => e.prop === "chair")!;
  expect(scout.voiceMouth).toBeUndefined();
  expect(scout.animation?.keyframes.length).toBe(17);
  expect(chair.animation?.keyframes.length).toBe(9);
  expect(third.cameraShots).toHaveLength(4);
  expect(third.focusGraphics).toHaveLength(4);
  // Chair is visually unstable but Scout never physically interacts with it.
  expect(third.interactions ?? []).toHaveLength(0);

  const start = sceneFramesAt(data, third, 1);
  const walked = sceneFramesAt(data, third, 6);
  const chairLeft = sceneFramesAt(data, third, 7.25);
  const chairRight = sceneFramesAt(data, third, 7.65);
  const backingAway = sceneFramesAt(data, third, 13.8);
  const calm = sceneFramesAt(data, third, 17);
  expect(walked.get(scout.id)!.x - start.get(scout.id)!.x).toBeGreaterThan(100);
  expect(chairLeft.get(chair.id)!.rotation).toBeLessThan(-1);
  expect(chairRight.get(chair.id)!.rotation).toBeGreaterThan(1);
  expect(backingAway.get(scout.id)!.x).toBeLessThan(walked.get(scout.id)!.x);
  expect(calm.get(scout.id)!.emotion).toBe("calm");
  expect(third.elements.find(e => e.prop === "chair")?.name).toContain("do not use");

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", { name: `Continue ${TITLE}`, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const reopened = (await backup(page)).data;
  expect(reopened.scenes).toEqual(data.scenes);
  expect(reopened.audioClips).toEqual(data.audioClips);
});
