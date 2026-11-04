import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ACTIVITIES, PARTICIPATION_TITLE } from "../src/participation-model";
import { transformExample } from "../src/transform-examples";
import { backup, number, restore, saved } from "./production-helpers";

test.use({ actionTimeout: 12_000 });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const studio = (page: Page) => page.getByRole("dialog", { name: PARTICIPATION_TITLE });
const preview = (page: Page) => studio(page).getByRole("region", { name: "Proposed scene preview" });
const time = (page: Page) => preview(page).getByRole("spinbutton", { name: "Preview time (seconds)" });
const draftPreview = (page: Page) => studio(page).getByRole("button", { name: "Preview", exact: true });
async function edit(page: Page) {
  const editTab = button(page, "Edit scene");
  if (await editTab.isVisible()) await editTab.click();
  await button(page, PARTICIPATION_TITLE).click();
  return studio(page);
}
async function apply(page: Page) {
  await studio(page).getByRole("button", { name: "Apply", exact: true }).click();
  await expect(studio(page)).toBeHidden();
}

test("adds all five activities with keyboard preview, editable choices, undo and reopening", async ({ page }, info) => {
  test.setTimeout(100_000);
  const project = transformExample("wagon");
  project.scenes[0].duration = 45;
  await restore(page, project);
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  const original = (await backup(page)).data;
  let form = await edit(page);
  await form.getByLabel("Ask the Kids a Question").fill("This draft will be cancelled");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await backup(page)).data.scenes).toEqual(original.scenes);

  for (const [i, kind] of Object.keys(ACTIVITIES).entries()) {
    form = await edit(page);
    await form.getByLabel("Learning activity").selectOption(kind);
    await form.getByLabel("Ask the Kids a Question").fill(`What should we notice? ${i + 1}`);
    await number(page, "Question starts (seconds)", String(i * 8));
    if (kind === "choose") {
      await form.getByLabel("Choice 1", { exact: true }).fill("Ask for help");
      await form.getByRole("button", { name: "Add a third choice", exact: true }).click();
      await form.getByLabel("Choice 3", { exact: true }).fill("Take turns");
      await form.getByRole("combobox", { name: "Icon for choice 3", exact: true }).selectOption("star");
      await form.getByRole("combobox", { name: "Choice shown in the reveal", exact: true }).selectOption("2");
    }
    await expect(form.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
    await draftPreview(page).press("Enter");
    await expect(preview(page).locator('[data-participation-phase="ask"]')).toHaveCount(1);
    await time(page).fill(String(i * 8 + 3));
    await expect(preview(page).locator('[data-participation-phase="think"]')).toHaveCount(1);
    await time(page).fill(String(i * 8 + 5.2));
    await expect(preview(page).locator('[data-participation-phase="reveal"]')).toHaveCount(1);
    if (kind === "choose") await expect(preview(page).getByText("3. Take turns", { exact: true })).toBeVisible();
    if (kind === "feel") await expect(preview(page).getByText("One kind possibility", { exact: true })).toBeVisible();
    await apply(page);
  }
  const exported = (await backup(page)).data;
  expect(exported.scenes[0].participation?.map(item => item.kind)).toEqual(Object.keys(ACTIVITIES));
  expect(exported.scenes[0].elements).toEqual(original.scenes[0].elements);
  expect(exported.captions).toEqual(original.captions);
  await button(page, "Undo edit").click();
  expect((await backup(page)).data.scenes[0].participation).toHaveLength(4);
  await button(page, "Redo edit").click();
  await saved(page);
  await page.reload();
  await button(page, `Continue ${project.title}`).click();
  const previewTab = button(page, "Preview");
  if (await previewTab.isVisible()) await previewTab.click();
  await page.getByRole("button", { name: /Edit participation moment: What should we notice\? 5/ }).click();
  await expect(studio(page).getByLabel("Learning activity")).toHaveValue("feel");
});

test("previews the voiced wagon with a real thinking interval, moving teaching art and readable captions", async ({ page }, info) => {
  test.setTimeout(75_000);
  await page.goto("./");
  await page.getByText("Try a Pause, Think & Try example", { exact: true }).click();
  await button(page, "The Wobbly Wagon Mystery").click();
  await expect(page.locator(".editor")).toBeVisible();
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  const form = await edit(page);
  await form.getByLabel("Participation moment").selectOption({ index: 1 });
  await expect(form.getByLabel("Who asks?").locator("option:checked")).toHaveText("Shine");
  await form.getByText("Connect voices, learning steps, and teaching graphics", { exact: true }).click();
  await expect(form.getByLabel("Question script line").locator("option:checked")).toHaveText("What is making it wobble?");
  await expect(form.getByLabel("Explanation script line").locator("option:checked")).toHaveText("The wheel is loose. Let us ask a grown-up.");
  await expect(form.getByRole("list", { name: "Timing and recording notes" })).toHaveCount(0);
  await form.getByText("Connect voices, learning steps, and teaching graphics", { exact: true }).click();
  await draftPreview(page).press("Enter");
  await preview(page).getByLabel("Sound in preview").check();
  await preview(page).getByRole("button", { name: "Preview this scene", exact: true }).click();
  await expect(preview(page).getByRole("button", { name: "Pause preview", exact: true })).toBeVisible();
  await time(page).fill("5.9");
  const art = preview(page).locator("[data-participation-phase]");
  await expect(art).toHaveAttribute("data-participation-phase", "think");
  await expect(art).toContainText("The wheel");
  await expect(art).toContainText("The handle");
  const circle = preview(page).locator('[data-focus-kind="circle"]');
  await expect(circle).toHaveCount(0);
  await form.locator(".interaction-review").scrollIntoViewIfNeeded();
  const screenshot = info.outputPath("participation-thinking.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await info.attach("thinking time and choices", { path: screenshot, contentType: "image/png" });

  await time(page).fill("8.0");
  await expect(art).toHaveAttribute("data-participation-phase", "reveal");
  await expect(art).toContainText("The wheel is loose.");
  await expect(art).not.toContainText("The handle");
  await expect(preview(page).locator(".caption-overlay")).toContainText("The wheel is loose.");
  await expect(circle).toHaveCount(1);
  const x = Number(await circle.getAttribute("data-focus-x"));
  await time(page).fill("10.15");
  expect(Math.abs(Number(await circle.getAttribute("data-focus-x")) - x)).toBeGreaterThan(1);
  const size = await form.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
  expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  const reveal = info.outputPath("participation-reveal.png");
  await page.screenshot({ path: reveal, animations: "disabled" });
  await info.attach("reveal with linked wagon focus and captions", { path: reveal, contentType: "image/png" });
});

test("dedicated scenes are only added on Apply and reuse script recording controls", async ({ page }) => {
  test.setTimeout(80_000);
  const project = transformExample("wagon");
  await restore(page, project);
  let form = await edit(page);
  await number(page, "Thinking time (seconds)", "10");
  await number(page, "Question starts (seconds)", "4");
  await expect(form.getByText(/This scene is too short/)).toBeVisible();
  await form.getByRole("button", { name: "Draft a dedicated participation scene", exact: true }).click();
  await expect(form.getByLabel("Choose a scene").locator("option:checked")).toHaveText("New participation scene (draft)");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await backup(page)).data.scenes).toHaveLength(2);

  form = await edit(page);
  await number(page, "Thinking time (seconds)", "10");
  await number(page, "Question starts (seconds)", "4");
  await form.getByRole("button", { name: "Draft a dedicated participation scene", exact: true }).click();
  await form.getByText("Connect voices, learning steps, and teaching graphics", { exact: true }).click();
  await form.getByLabel("Add missing words to Script & Voice Director when I apply").check();
  await draftPreview(page).press("Enter");
  await apply(page);
  const saved = (await backup(page)).data;
  expect(saved.scenes).toHaveLength(3);
  expect(saved.scenes[0].duration).toBe(project.scenes[0].duration);
  const added = saved.scenes[1];
  expect(added.participation?.[0].thinkFor).toBe(10);
  expect(added.script?.lines).toHaveLength(2);
  expect(added.script?.lines.every(line => line.takes.length === 0)).toBe(true);
  form = await edit(page);
  await form.getByLabel("Participation moment").selectOption({ index: 1 });
  await form.getByText("Connect voices, learning steps, and teaching graphics", { exact: true }).click();
  await form.getByRole("button", { name: "Open Script & Voice Director", exact: true }).click();
  const script = page.getByRole("dialog", { name: "Write My Episode Script" });
  await expect(script.getByText("Not recorded", { exact: true }).first()).toBeVisible();
  await expect(script.getByRole("button", { name: /Record/ }).first()).toBeVisible();
});
