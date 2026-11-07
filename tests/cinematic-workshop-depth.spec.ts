import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { backup, number, saved } from "./production-helpers";
import { workshopGroundShadows, workshopLayerTransform } from "../src/cinematic-workshop";
import { elementAt, sceneFramesAt, stageCameraAt } from "../src/timeline";
import { handAt } from "../src/interaction-motion";

const TITLE = "Little Fixers Club — Tidy Up Together (4:30 original cartoon; newer voices unrecorded)";

test("actual Scout and Jo workshop gains optional camera depth and grounded feet without changing the cartoon", async ({ page }, info) => {
  test.setTimeout(160_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Watch Scout and Jo tidy up (4:30)", exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible({ timeout: 60_000 });
  await saved(page);
  const original = (await backup(page)).data;
  expect(original.scenes.reduce((sum, s) => sum + s.duration, 0)).toBe(270);
  const scene = original.scenes[4];
  await page.getByRole("button", { name: `Go to scene 5: ${scene.title}`, exact: true }).click();
  await number(page, "Scene time (seconds)", "24.8");
  const stage = page.locator(".live-stage > svg");
  await expect(stage).toHaveAttribute("data-visual-style", "classic");
  await expect(stage.locator("[data-workshop-depth], [data-ground-shadow]")).toHaveCount(0);
  await info.attach("Classic workshop · same scene at 24.8 seconds", {
    body: await stage.screenshot({ path: info.outputPath("classic-workshop.png") }), contentType: "image/png",
  });
  const toggle = page.getByRole("checkbox", { name: "Cinematic Storybook look", exact: true });
  await toggle.check();
  await saved(page);
  const cinematic = (await backup(page)).data;
  expect(cinematic.visualStyle).toBe("storybook-cinematic");
  for (const key of ["scenes", "characters", "assets", "audioAssets", "audioClips", "captions"] as const)
    expect(cinematic[key]).toEqual(original[key]);
  await expect(stage.locator("[data-workshop-depth]")).toHaveCount(3);
  await info.attach("Cinematic workshop · same scene at 24.8 seconds", {
    body: await stage.screenshot({ path: info.outputPath("cinematic-workshop.png") }), contentType: "image/png",
  });
  await number(page, "Scene time (seconds)", "7.9");
  const camera = stageCameraAt(cinematic, scene, 7.9);
  for (const depth of ["behind", "alongside", "front"] as const) {
    await expect(stage.locator(`[data-workshop-depth="${depth}"]`))
      .toHaveAttribute("transform", workshopLayerTransform(depth, camera, false));
    await expect(stage.locator(`[data-workshop-depth="${depth}"]`)).toHaveAttribute("aria-hidden", "true");
  }
  const frames = sceneFramesAt(cinematic, scene, 7.9);
  for (const character of cinematic.characters) {
    const actor = scene.elements.find(e => e.characterId === character.id)!;
    const frame = frames.get(actor.id)!;
    const ground = elementAt(actor, 7.9, scene.duration, true);
    const shadows = workshopGroundShadows(actor, frame, ground, character);
    expect(shadows).toHaveLength(3);
    for (const shadow of shadows) {
      const ellipse = stage.locator(`[data-ground-shadow="${actor.id}"] [data-shadow-contact="${shadow.id}"]`);
      await expect.poll(async () => Number(await ellipse.getAttribute("cx"))).toBeCloseTo(shadow.x, 6);
      await expect.poll(async () => Number(await ellipse.getAttribute("cy"))).toBeCloseTo(shadow.y, 6);
      await expect(ellipse).not.toHaveAttribute("transform");
    }
  }
  const beforeCamera = await stage.locator('[data-workshop-depth="behind"]').getAttribute("transform");
  await number(page, "Scene time (seconds)", "12.1");
  await expect(stage.locator('[data-workshop-depth="behind"]')).not.toHaveAttribute("transform", beforeCamera!);
  const holding = sceneFramesAt(cinematic, scene, 12.1);
  const action = scene.interactions![0];
  const jo = scene.elements.find(e => e.id === action.actorId)!;
  const sign = holding.get(action.objectId)!;
  const hand = handAt(cinematic.characters.find(c => c.id === jo.characterId), jo, holding.get(jo.id)!, action.grip);
  expect(sign.heldBy).toBe(jo.id);
  expect(sign.x).toBeCloseTo(hand.x, 6);
  expect(sign.y).toBeCloseTo(hand.y, 6);
  const renderedSign = stage.locator(`[data-element-id="${action.objectId}"]`);
  const translation = (await renderedSign.getAttribute("transform"))!.match(/translate\(([^ ]+) ([^)]+)\)/)!;
  expect(Number(translation[1])).toBeCloseTo(hand.x, 6);
  expect(Number(translation[2])).toBeCloseTo(hand.y, 6);
  await expect(stage.locator(`[data-ground-shadow="${action.objectId}"]`)).toHaveCount(0);
  const deterministic = await stage.innerHTML();
  await number(page, "Scene time (seconds)", "24");
  const released = sceneFramesAt(cinematic, scene, 24).get(action.objectId)!;
  await expect.poll(async () => Number(await stage.locator(`[data-ground-shadow="${action.objectId}"] ellipse`)
    .getAttribute("cx"))).toBeCloseTo(released.x, 6);
  await number(page, "Scene time (seconds)", "12.1");
  expect(await stage.innerHTML()).toBe(deterministic);
  await page.getByRole("checkbox", { name: "Calmer preview", exact: true }).check();
  await expect(stage.locator('[data-workshop-depth="behind"]'))
    .toHaveAttribute("transform", workshopLayerTransform("behind", camera, true));
  await page.getByRole("checkbox", { name: "Calmer preview", exact: true }).uncheck();
  const accessibility = await new AxeBuilder({ page }).include(".live-stage").analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", { name: `Continue ${TITLE}`, exact: true }).click();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await saved(page);
  const reverted = (await backup(page)).data;
  expect(reverted.visualStyle).toBeUndefined();
  expect(reverted.scenes).toEqual(original.scenes);
  expect(reverted.audioAssets).toEqual(original.audioAssets);
  expect(reverted.audioClips).toEqual(original.audioClips);
  expect(reverted.captions).toEqual(original.captions);
  await expect(stage.locator("[data-workshop-depth], [data-ground-shadow]")).toHaveCount(0);
});
