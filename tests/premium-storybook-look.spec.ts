import { expect, test } from "@playwright/test";
import { backup, saved } from "./production-helpers";

const TITLE = "Little Fixers Club — The Wobbly Chair (90-second original cartoon; later scenes need voices)";

test("Cinematic Storybook is an opt-in, saved cartoon look shared by preview and video export", async ({ page }) => {
  test.setTimeout(140_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Watch Scout and the wobbly chair (1:30)", exact: true }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 55_000 });
  const toggle = page.getByRole("checkbox", { name: "Cinematic Storybook look", exact: true });
  await expect(toggle).not.toBeChecked();
  await saved(page);
  const { data: before } = await backup(page);
  expect(before.visualStyle).toBeUndefined();
  expect(before.scenes[0].elements.find(e => e.characterId)?.voiceMouth).toHaveLength(3);
  await toggle.check();
  await expect(toggle).toBeChecked();
  await saved(page);
  const premium = (await backup(page)).data;
  expect(premium.visualStyle).toBe("storybook-cinematic");
  expect(premium.scenes).toEqual(before.scenes);
  expect(premium.characters).toEqual(before.characters);
  expect(premium.audioClips).toEqual(before.audioClips);
  expect(premium.captions).toEqual(before.captions);
  const stage = page.locator("svg[data-visual-style='storybook-cinematic']").first();
  await expect(stage).toBeVisible();
  await expect(page.locator("svg[data-visual-style='storybook-cinematic'] [data-cinematic-workshop-lighting='true']").first()).toBeAttached();
  await expect(page.locator("svg[data-visual-style='storybook-cinematic'] [data-eye-highlight='premium']").first()).toBeAttached();
  // Real layered vector surfaces, not a CSS-only editor preview filter.
  for (const surface of ["workshop-shirt", "cargo-fabric", "work-boot", "hair-sheen"]) {
    await expect(page.locator(`svg[data-visual-style='storybook-cinematic'] [data-material-depth="${surface}"]`).first()).toBeAttached();
  }
  await expect(page.locator("svg[data-visual-style='storybook-cinematic'] [data-facial-detail='nose']").first()).toBeAttached();

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.getByRole("button", { name: `Continue ${TITLE}`, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("checkbox", { name: "Cinematic Storybook look" })).toBeChecked();
  expect((await backup(page)).data.visualStyle).toBe("storybook-cinematic");
  await page.getByRole("checkbox", { name: "Cinematic Storybook look" }).uncheck();
  await saved(page);
  expect((await backup(page)).data.visualStyle).toBeUndefined();
  await expect(page.locator("svg[data-visual-style='classic']").first()).toBeVisible();
  await expect(page.locator("svg[data-visual-style='classic'] [data-material-depth]")).toHaveCount(0);
  await expect(page.locator("svg[data-visual-style='classic'] [data-facial-detail]")).toHaveCount(0);
});
