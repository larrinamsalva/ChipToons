import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { starterProject } from "../src/demo-starter";
import { backup, restore, saved } from "./production-helpers";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const card = (page: Page, name: string) => page.locator(".library-card").filter({
  has: page.getByRole("heading", { name, exact: true }),
});
async function world(page: Page) {
  const tab = button(page, "Edit scene");
  if (await tab.isVisible()) await tab.click();
  await button(page, "Build My Cartoon World").click();
}
async function useLocation(page: Page, name: string) {
  await button(page, "Browse reusable locations").click();
  await card(page, name).getByRole("button", { name: "Use this location", exact: true }).click();
  await button(page, "Replace scene scenery").click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(`Placed ${name}`);
  await button(page, "Close dialog").click();
}

test("build, save and reuse editable scenery in a separate episode", async ({ page }, info) => {
  test.setTimeout(80_000);
  await restore(page, starterProject());
  await saved(page);
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  const before = (await backup(page)).data;
  await world(page);
  await useLocation(page, "Kind Hearts Playground");
  const objects = page.getByLabel("Selected scene object");
  await objects.selectOption({ label: "Slide" });
  await page.getByLabel("Scenery placement").selectOption("front");
  await button(page, "Undo edit").click();
  await button(page, "Redo edit").click();
  await page.getByLabel("Gentle depth during camera pans").check();
  await page.getByLabel("Gentle scenery animation", { exact: true }).check();
  await expect(page.locator(".world-fields")).toBeVisible();
  expect((await new AxeBuilder({ page }).include(".world-fields")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  const controls = info.outputPath("world-controls.png");
  await page.locator(".world-fields").screenshot({ path: controls });
  await info.attach("world-controls", { path: controls, contentType: "image/png" });

  await button(page, "Save as reusable location").click();
  await page.getByLabel("Location name", { exact: true }).fill("My Kind Hearts Park");
  await page.getByLabel("Location description").fill("A sunny place to learn about friendship.");
  await button(page, "Save to library").click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Saved My Kind Hearts Park");
  await expect(card(page, "My Kind Hearts Park")).toContainText("A sunny place");
  const gallery = info.outputPath("saved-location-gallery.png");
  await card(page, "My Kind Hearts Park").screenshot({ path: gallery });
  await info.attach("saved-location-gallery", { path: gallery, contentType: "image/png" });
  await button(page, "Close dialog").click();
  const edited = (await backup(page)).data;
  expect(edited.scenes[0].elements.at(-1)).toMatchObject({ prop: "slide", sceneryDepth: "front" });
  expect(edited.scenes[0].narration).toBe(before.scenes[0].narration);
  expect(edited.audioClips).toEqual(before.audioClips);
  expect(edited.scenes[1]).toEqual(before.scenes[1]);

  const another = starterProject();
  another.title = "Another episode in the same park";
  await restore(page, another);
  await world(page);
  await useLocation(page, "My Kind Hearts Park");
  const reused = (await backup(page)).data;
  expect(reused.scenes[0].elements.at(-1)).toMatchObject({ prop: "slide", sceneryDepth: "front" });
  expect(reused.scenes[0].elements.at(-1)!.id).not.toBe(edited.scenes[0].elements.at(-1)!.id);
  expect(reused.scenes[0].gentleDepth).toBe(true);
  expect(reused.scenes[0].backgroundAnimation?.style).toBe("drift");

  await button(page, "Browse reusable locations").click();
  await button(page, "Duplicate My Kind Hearts Park").click();
  await page.getByLabel("Location name", { exact: true }).fill("Friendship Park copy");
  await button(page, "Save to library").click();
  await expect(card(page, "Friendship Park copy")).toContainText("A sunny place");
  await button(page, "Delete library My Kind Hearts Park").click();
  await expect(page.getByRole("heading", { name: "Remove this saved location?" })).toBeVisible();
  await button(page, "Delete library entry").click();
  await expect(card(page, "My Kind Hearts Park")).toHaveCount(0);
  await button(page, "Close dialog").click();
  expect((await backup(page)).data.scenes[0].elements).toEqual(reused.scenes[0].elements);
});
