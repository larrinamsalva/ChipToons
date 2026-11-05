import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { backup, restore, saved } from "./production-helpers";

const poster = fileURLToPath(new URL("../public/examples/little-fixers.png", import.meta.url));
const button = (scope: Page | Locator, name: string) => scope.getByRole("button", { name, exact: true });

async function pictureTools(page: Page, name = "Turn My Picture Into a Cartoon") {
  await button(page, name).click();
  const dialog = page.getByRole("dialog", { name: "Turn My Picture Into a Cartoon" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function outline(dialog: Locator, points: [number, number][]) {
  for (const [x, y] of points) {
    await button(dialog, "Add outline point").press("Enter");
    await dialog.getByRole("spinbutton", { name: "Point X (%)", exact: true }).fill(String(x));
    await dialog.getByRole("spinbutton", { name: "Point Y (%)", exact: true }).fill(String(y));
  }
  await button(dialog, "Close outline").press("Enter");
}

test("saves one original, a 20-minute storyboard, and editable panel metadata across backup and restore", async ({ page }, info) => {
  test.setTimeout(65_000);
  await page.goto("./");
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  const dialog = await pictureTools(page);
  await dialog.getByLabel("Original picture file", { exact: true }).setInputFiles({
    name: "wrong.png", mimeType: "image/png", buffer: Buffer.from("this is not PNG"),
  });
  await expect(dialog.getByRole("alert")).toContainText("does not contain the image type");
  await button(dialog, "Use the Little Fixers Club poster").click();
  const original = dialog.getByRole("img", { name: "Original picture and selection" });
  await expect(original).toBeVisible();
  const originalBytes = await readFile(poster);
  const download = page.waitForEvent("download");
  await button(dialog, "Download original picture").click();
  expect(await readFile((await (await download).path())!)).toEqual(originalBytes);

  await dialog.getByLabel("Suggested poster panels").selectOption({ label: "Chair repair" });
  await dialog.getByRole("textbox", { name: "Panel name" }).fill("Loose joint reference");
  await dialog.getByRole("spinbutton", { name: "Rotation in degrees" }).fill("7");
  await dialog.getByRole("spinbutton", { name: "Panel width (%)" }).press("ArrowDown");
  await dialog.getByRole("checkbox", { name: "Show panel as a scene background" }).check();
  const { scrollWidth, clientWidth } = await dialog.evaluate(element => ({
    scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await original.scrollIntoViewIfNeeded();
  const screenshot = info.outputPath("picture-studio.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await info.attach("Picture panel editor", { path: screenshot, contentType: "image/png" });

  await button(dialog, "Open the editable 20-minute plan").press("Enter");
  await expect(dialog).toBeHidden();
  await saved(page);
  const { data } = await backup(page);
  expect(data.scenes.reduce((total, scene) => total + scene.duration, 0)).toBe(1200);
  expect(data.scenes[0].picturePanel).toMatchObject({ name: "Loose joint reference", rotation: 7 });
  expect(data.scenes[0].elements[0]).toMatchObject({
    backdrop: true, assetId: data.pictureSourceId, rotation: 7, crop: data.scenes[0].picturePanel?.crop,
  });
  expect(data.assets).toHaveLength(1);
  expect(Buffer.from(data.assets[0].dataUrl.split(",")[1], "base64")).toEqual(originalBytes);

  await restore(page, { ...data, id: "restored-picture-proof" });
  const restored = await pictureTools(page, "Picture & cutouts");
  await expect(restored.getByRole("textbox", { name: "Panel name" })).toHaveValue("Loose joint reference");
  await restored.getByRole("checkbox", { name: "Show panel as a scene background" }).uncheck();
  await button(restored, "Save panel to scene").click();
  const reference = (await backup(page)).data;
  expect(reference.scenes[0].elements).toHaveLength(0);
  expect(reference.scenes[0].picturePanel).toEqual(data.scenes[0].picturePanel);

  const reopened = await pictureTools(page, "Picture & cutouts");
  await reopened.getByRole("combobox", { name: "Storyboard scene" }).selectOption("1");
  await reopened.getByRole("textbox", { name: "Panel name" }).fill("Second panel");
  await button(reopened, "Save panel to scene").click();
  const copy = (await backup(page)).data;
  expect(copy.scenes[1].picturePanel?.name).toBe("Second panel");
  expect(copy.assets).toHaveLength(1);
});

test("corrects transparent masks with a keyboard and hands the parts to the existing Puppet Maker", async ({ page }) => {
  test.setTimeout(80_000);
  await page.goto("./");
  const start = await pictureTools(page);
  await start.getByLabel("Original picture file", { exact: true }).setInputFiles(poster);
  await button(start, "Create storyboard scene").click();
  await expect(start).toBeHidden();
  const dialog = await pictureTools(page, "Picture & cutouts");
  await button(dialog, "Make This Character Move").click();
  await dialog.getByRole("textbox", { name: "Character or prop name" }).fill("Workshop puppet");
  await outline(dialog, [[10, 28], [30, 28], [30, 58], [10, 58]]);
  await dialog.getByRole("combobox", { name: "Outline operation" }).selectOption("remove");
  await outline(dialog, [[17, 35], [23, 35], [23, 50], [17, 50]]);
  await button(dialog, "Undo picture edit").press("Enter");
  await button(dialog, "Redo picture edit").press("Enter");
  await button(dialog, "Preview transparent cutout").click();
  const preview = dialog.getByRole("img", { name: "Transparent cutout preview" });
  await expect(preview).toBeVisible();
  const alpha = () => preview.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return [context.getImageData(20, 20, 1, 1).data[3], context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3]];
  });
  expect(await alpha()).toEqual([255, 0]);
  await dialog.getByRole("combobox", { name: "Outline operation" }).selectOption("add");
  await outline(dialog, [[18, 41], [22, 41], [22, 45], [18, 45]]);
  await button(dialog, "Preview transparent cutout").click();
  expect(await alpha()).toEqual([255, 255]);
  await button(dialog, "Save cutout as a prop").click();
  await expect(dialog.getByRole("status").filter({ hasText: "Saved Workshop puppet to the Art Library." })).toBeVisible();
  await button(dialog, "Keep this body part").click();
  await expect(button(dialog, "Remove Body")).toBeVisible();
  await dialog.getByRole("combobox", { name: "Outline operation" }).selectOption("add");
  await dialog.getByRole("combobox", { name: "Prepare as a body part" }).selectOption("head");
  await outline(dialog, [[16, 2], [31, 2], [31, 31], [16, 31]]);
  await button(dialog, "Preview transparent cutout").click();
  await button(dialog, "Keep this body part").click();
  await expect(button(dialog, "Remove Head")).toBeVisible();
  await button(dialog, "Continue in Puppet Maker").click();
  const maker = page.getByRole("dialog", { name: "Create a Puppet Character", exact: true });
  await expect(maker).toBeVisible();
  await expect(maker.getByRole("textbox", { name: "Character name", exact: true })).toHaveValue("Workshop puppet");
  await expect(maker.locator("[data-puppet-part=torso]").first()).toBeVisible();
  await expect(maker.locator("[data-puppet-part=head]").first()).toBeVisible();
  await button(maker, "Next").click();
  await button(maker, "Preview").click();
  await button(maker, "Add to Cartoon").click();
  await expect(maker).toBeHidden();
  await saved(page);
  const first = (await backup(page)).data;
  const puppet = first.characters.find(character => character.name === "Workshop puppet")!;
  expect(puppet.puppet?.parts.map(part => part.role)).toEqual(["torso", "head"]);
  expect(first.scenes[0].elements.some(element => element.characterId === puppet.id)).toBe(true);

  const panels = page.getByRole("navigation", { name: "Editor panels" });
  if (await panels.isVisible()) await button(panels, "Scenes").click();
  await button(page, "Add a scene").click();
  await page.locator(".editor-toolbar").getByRole("button", { name: "Art library", exact: true }).click();
  const card = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "Workshop puppet", exact: true }) });
  await button(card, "Add to scene").click();
  await button(page, "Back to my story").click();
  await saved(page);
  await button(page, "Save and return to my cartoons").click();
  await page.reload();
  await button(page, "Continue My Picture Cartoon").click();
  await saved(page);
  const reused = (await backup(page)).data;
  const added = reused.scenes[1].elements.find(element => element.name === "Workshop puppet" && element.sourceLibraryId);
  expect(added?.characterId).toBe(puppet.id);
  expect(reused.assets).toEqual(first.assets);
});
