import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { starterProject } from "../src/planner";
import { STORY_CARD_STUDIO } from "../src/story-card-model";
import { backup, number, restore, saved } from "./production-helpers";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const form = (page: Page) => page.getByRole("dialog", { name: STORY_CARD_STUDIO });
async function open(page: Page) {
  await expect(page.locator(".editor")).toBeVisible();
  await button(page, STORY_CARD_STUDIO).click();
  return form(page);
}
async function pick(page: Page, kind: string) {
  const edit = form(page).getByRole("combobox", { name: "Edit a saved story card" });
  if (await edit.isVisible()) await edit.selectOption("");
  await form(page).getByRole("combobox", { name: "What would you like to add?" }).selectOption(kind);
}
async function review(page: Page) {
  await button(page, "Preview Card").press("Enter");
  return form(page).getByRole("region", { name: "Proposed scene preview" });
}
async function apply(page: Page) {
  await button(page, "Apply Card").click();
  await expect(form(page)).toBeHidden();
}

test("reviews, plays, edits and saves opening, chapter, recap and credit scenes", async ({ page }, info) => {
  test.setTimeout(125_000);
  const fixture = starterProject();
  fixture.scenes[1].learningSteps = [{ id: "first-kind-step", text: "Give a new friend time to answer.", at: 1 }];
  await restore(page, fixture);
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  const studio = await open(page);
  await studio.getByRole("textbox", { name: "Card title", exact: true }).fill("Kindness Corner");
  await number(page, "Display time (seconds)", "5");
  await studio.getByRole("checkbox", { name: "Welcome with my characters" }).check();
  await studio.getByRole("combobox", { name: "Add an original sound" }).selectOption("melody");
  const preview = await review(page);
  await expect(preview.locator("[data-story-card=opening]")).toContainText("Kindness Corner");
  await preview.getByRole("checkbox", { name: "Sound in preview" }).check();
  await preview.getByRole("button", { name: "Preview this scene", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Pause preview", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Pause preview", exact: true }).click();
  await preview.getByRole("spinbutton", { name: "Preview time (seconds)" }).fill("1.4");
  await expect(studio.getByLabel("Running time review")).toContainText("Add 5 seconds");
  const size = await studio.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
  expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await preview.scrollIntoViewIfNeeded();
  const screenshot = info.outputPath("story-card-review.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await info.attach("opening preview and runtime", { path: screenshot, contentType: "image/png" });
  await apply(page);
  const initial = (await backup(page)).data;
  expect(initial.scenes[0].storyCard?.kind).toBe("opening");
  expect(initial.audioClips[0].sceneId).toBe(initial.scenes[0].id);
  expect(initial.scenes.slice(1)).toEqual(fixture.scenes);
  await button(page, "Undo edit").click();
  expect((await backup(page)).data.scenes[0].storyCard).toBeUndefined();
  await button(page, "Redo edit").click();

  await open(page);
  await pick(page, "episode");
  await studio.getByRole("textbox", { name: "Card title", exact: true }).fill("Room for a friend");
  await review(page);
  await apply(page);
  await open(page);
  await studio.getByRole("textbox", { name: "Card title", exact: true }).fill("A little room for a friend");
  await review(page);
  await apply(page);
  await open(page);
  await pick(page, "chapter");
  await studio.getByRole("combobox", { name: "Place card" }).selectOption("2");
  await studio.getByRole("combobox", { name: "Story chapter" }).selectOption("resolution");
  await button(page, "Use chapter name").click();
  await review(page);
  await apply(page);
  await open(page);
  await pick(page, "recap");
  await button(page, "Add learning point").click();
  await studio.getByRole("combobox", { name: "Suggest words for point 1" }).selectOption("first-kind-step");
  await expect(studio.getByRole("textbox", { name: "Learning point 1" })).toHaveValue("Give a new friend time to answer.");
  await review(page);
  await apply(page);
  await open(page);
  await pick(page, "credits");
  await button(page, "Add credit").click();
  await studio.getByRole("textbox", { name: "Name or source to publish · 1" }).fill("Example Artist");
  await studio.getByRole("checkbox", { name: "Scroll the credits slowly" }).check();
  await number(page, "Display time (seconds)", "10");
  const credits = await review(page);
  await expect(credits.locator("[data-story-card=credits]")).toContainText("Example Artist");
  await apply(page);
  await saved(page);
  const result = (await backup(page)).data;
  expect(result.scenes.filter(scene => scene.storyCard).map(scene => scene.storyCard?.kind)).toEqual(["opening", "episode", "chapter", "recap", "credits"]);
  expect(result.scenes[1].storyCard?.title).toBe("A little room for a friend");
  expect(result.scenes[3].chapter).toBe("resolution");
  expect(result.scenes.at(-1)?.storyCard?.credits[0]).toEqual({ role: "", name: "Example Artist", license: "", url: "" });
  expect(result.captions).toEqual([]);
  await page.reload();
  await button(page, `Continue ${fixture.title}`).click();
  await open(page);
  await studio.getByRole("combobox", { name: "Edit a saved story card" }).selectOption(result.scenes.at(-1)!.id);
  await expect(studio.getByRole("textbox", { name: "Name or source to publish · 1" })).toHaveValue("Example Artist");
  await studio.getByRole("textbox", { name: "Name or source to publish · 1" }).fill("Unpublished edit");
  await button(page, "Cancel").click();
  expect((await backup(page)).data.scenes.at(-1)?.storyCard?.credits[0].name).toBe("Example Artist");
});

test("proposes saved series defaults only after a creator chooses them", async ({ page }) => {
  test.setTimeout(85_000);
  const fixture = starterProject();
  await restore(page, fixture);
  const project = (await backup(page)).data;
  await button(page, "Save and return to my cartoons").click();
  await button(page, "My Cartoon Series").click();
  await button(page, "Add The Kind Hearts Crew").click();
  const series = page.getByRole("dialog", { name: "My Cartoon Series" });
  await series.getByText("Opening and ending defaults", { exact: true }).click();
  await button(page, "Set opening and ending defaults").click();
  await series.getByRole("combobox", { name: "Title animation" }).selectOption("heart");
  await series.getByRole("combobox", { name: "Suggested opening sound" }).selectOption("transition");
  await button(page, "Save series").click();
  await expect(series.getByRole("status").filter({ hasText: "Series saved on this device." })).toBeVisible();
  await button(page, "Episode Plans").click();
  await series.getByRole("combobox", { name: "Linked cartoon" }).selectOption(project.id);
  await button(page, "Save series").click();
  await button(page, "Open linked cartoon").click();
  const studio = await open(page);
  await expect(studio.getByRole("combobox", { name: "Add an original sound" })).toHaveValue("");
  await button(page, "Review series card defaults").click();
  await expect(studio.getByRole("textbox", { name: "Card title", exact: true })).toHaveValue("The Kind Hearts Crew");
  await expect(studio.getByRole("combobox", { name: "Add an original sound" })).toHaveValue("transition");
  await review(page);
  await apply(page);
  const result = (await backup(page)).data;
  expect(result.scenes[0].storyCard).toMatchObject({ title: "The Kind Hearts Crew", style: { motion: "heart" } });
  expect(result.audioClips).toHaveLength(1);
});
