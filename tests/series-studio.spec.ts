import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { backup, saved } from "./production-helpers";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const label = (page: Page, name: string) => dialog(page).getByRole("textbox", { name, exact: true })
  .or(dialog(page).getByRole("combobox", { name, exact: true }));
const save = async (page: Page) => {
  await button(page, "Save series").click();
  await expect(dialog(page).getByRole("status").filter({ hasText: "Series saved on this device." })).toBeVisible();
};

async function openSeries(page: Page) {
  await button(page, "My Cartoon Series").click();
  await expect(dialog(page)).toBeVisible();
  await expect(button(page, "New series")).toBeEnabled();
}

async function selectCrew(page: Page) {
  await openSeries(page);
  await button(page, "Open The Kind Hearts Crew").click();
  await expect(dialog(page).getByRole("heading", { name: "The Kind Hearts Crew", exact: true })).toBeVisible();
}

async function addCrew(page: Page) {
  await openSeries(page);
  await button(page, "Add The Kind Hearts Crew").click();
  await expect(dialog(page).getByText("30 planned of 30 target · 0 started · 0 marked completed")).toBeVisible();
}

async function prepareEpisode(page: Page, title: string) {
  await button(page, "Create This Episode").click();
  await expect(label(page, "Cartoon name")).toHaveValue(title);
  await button(page, "Next").click();
  await expect(label(page, "Recurring cast for character 1")).not.toHaveValue("");
  await button(page, "Next").click();
  await button(page, "Suggest scenes").click();
  await button(page, "Review actions and camera").click();
}

async function audit(page: Page) {
  expect(await dialog(page).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}

test("series dashboard, archive, keyboard episode ordering and plan backup round trip", async ({ page }) => {
  await page.goto("./");
  await openSeries(page);
  await button(page, "New series").click();
  await label(page, "Series name").fill("Little Learning Stories");
  await label(page, "Educational themes").fill("Caring for nature");
  await button(page, "Series Bible").press("Enter");
  await label(page, "Continuity notes").fill("The neighborhood always has a quiet garden.");
  await button(page, "Overview").click();
  await button(page, "Use 30-episode template").click();
  await save(page);
  await button(page, "Episode Plans").click();
  const board = dialog(page).getByRole("list", { name: "Episode planning board" });
  await expect(board.getByRole("button")).toHaveCount(30);
  await button(page, "Move later").press("Enter");
  await expect(board.getByRole("button").first()).toContainText("The Quiet Corner");
  await save(page);
  await button(page, "Overview").click();
  await button(page, "Archive series").click();
  await save(page);
  const pending = page.waitForEvent("download");
  await button(page, "Download series plan").click();
  const downloaded = await pending;
  const json = JSON.parse(await readFile((await downloaded.path())!, "utf8"));
  expect(json.series.bible.notes).toContain("quiet garden");
  expect(json.series.episodes[0].title).toBe("The Quiet Corner");
  await page.reload();
  await openSeries(page);
  await label(page, "Saved series").selectOption({ label: "Little Learning Stories (archived)" });
  await button(page, "Restore archived series").click();
  await save(page);
  const chooser = page.waitForEvent("filechooser");
  await button(page, "Restore series-plan backup").click();
  await (await chooser).setFiles(await downloaded.path() as string);
  await expect(dialog(page).getByRole("status").filter({ hasText: "Series plan restored as a new series" })).toBeVisible();
  await expect(label(page, "Saved series").getByRole("option", { name: "Little Learning Stories", exact: true })).toHaveCount(2);
  await button(page, "Episode Plans").click();
  await expect(board.getByRole("button").first()).toContainText("The Quiet Corner");
});

test("recurring puppets with the same name, accessible layouts, independent episodes and link management", async ({ page }, info) => {
  await page.goto("./");
  await addCrew(page);
  await audit(page);
  await info.attach("series-dashboard", { body: await dialog(page).screenshot(), contentType: "image/png" });
  await button(page, "Close dialog").click();
  await button(page, "Switch to dark theme").click();
  await selectCrew(page);
  await button(page, "Recurring Cast").click();
  await expect(dialog(page).getByText("Standing, Waving, Thinking")).toBeVisible();
  await audit(page);
  if (info.project.name === "phone")
    await label(page, "Cast member to edit").evaluate(node => node.scrollIntoView({ block: "start" }));
  await info.attach("recurring-cast", { body: await dialog(page).screenshot(), contentType: "image/png" });
  await label(page, "Character name").fill("Sunny");
  await label(page, "Cast member to edit").selectOption({ index: 1 });
  await label(page, "Character name").fill("Sunny");
  await button(page, "Add cast member").click();
  await label(page, "Character name").fill("Jun");
  await label(page, "Artwork or puppet from your library").selectOption({ index: 3 });
  await label(page, "Role").fill("Garden helper");
  await save(page);
  await button(page, "Episode Plans").click();
  await prepareEpisode(page, "A Hello Heart");
  await button(page, "Create animated first draft").dblclick();
  await expect(page.locator(".editor")).toBeVisible();
  await saved(page);
  const first = (await backup(page)).data;
  expect(first.characters.map(character => character.name)).toEqual(["Sunny", "Sunny"]);
  const ids = first.characters.map(character => character.seriesCastId);
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(2);
  expect(first.characters.every(character => character.puppet?.poses.length === 3)).toBe(true);
  expect(first.scenes.at(-1)?.question).toBe("How does a friendly hello feel?");
  await button(page, "Save and return to my cartoons").click();
  await selectCrew(page);
  await button(page, "Episode Plans").click();
  await expect(dialog(page).getByText(/1 started/)).toBeVisible();
  await button(page, "Open linked cartoon").click();
  await expect(page.locator(".editor")).toBeVisible();
  expect((await backup(page)).data.id).toBe(first.id);
  await button(page, "Save and return to my cartoons").click();
  await selectCrew(page);
  await button(page, "Episode Plans").click();
  await label(page, "Linked cartoon").selectOption("");
  await save(page);
  await expect(button(page, "Create This Episode")).toBeEnabled();
  await label(page, "Linked cartoon").selectOption(first.id);
  await save(page);
  await expect(button(page, "Open linked cartoon")).toBeEnabled();
  await dialog(page).getByRole("button", { name: /^2\. The Quiet Corner/ }).click();
  await prepareEpisode(page, "The Quiet Corner");
  await button(page, "Create animated first draft").click();
  await expect(page.locator(".editor")).toBeVisible();
  await saved(page);
  const second = (await backup(page)).data;
  expect(second.id).not.toBe(first.id);
  expect(second.characters[0].seriesCastId).toBe(ids[1]);
  expect(second.characters[0].id).not.toBe(first.characters[1].id);
  await button(page, "Save and return to my cartoons").click();
  await expect(button(page, "Continue A Hello Heart")).toHaveCount(1);
  await button(page, "Delete A Hello Heart").click();
  await button(page, "Delete cartoon").click();
  await expect(button(page, "Continue A Hello Heart")).toHaveCount(0);
  await selectCrew(page);
  await button(page, "Episode Plans").click();
  await expect(dialog(page).getByText(/The linked cartoon is unavailable/)).toBeVisible();
  await expect(button(page, "Open linked cartoon")).toHaveCount(0);
});

test("two tabs protect series edits and create only one cartoon from two reviewed drafts", async ({ page, context }) => {
  await page.goto("./");
  await addCrew(page);
  const other = await context.newPage();
  await other.goto("./");
  await selectCrew(other);
  await label(page, "Description").fill("The first tab saved this description.");
  await save(page);
  await label(other, "Description").fill("The second tab still has this draft.");
  await button(other, "Save series").click();
  await expect(dialog(other).getByRole("alert")).toContainText("Another tab saved this series");
  await expect(label(other, "Description")).toHaveValue("The second tab still has this draft.");
  await expect(button(other, "Download series plan")).toBeEnabled();
  await button(other, "Discard edits and reload saved series").click();
  await expect(label(other, "Description")).toHaveValue("The first tab saved this description.");
  await Promise.all([page, other].map(async tab => {
    await button(tab, "Episode Plans").click();
    await prepareEpisode(tab, "A Hello Heart");
  }));
  await Promise.all([page, other].map(tab => button(tab, "Create animated first draft").click()));
  await Promise.all([page, other].map(tab => expect(tab.getByRole("heading", { name: "A Hello Heart", exact: true })).toBeVisible()));
  const fresh = await context.newPage();
  await fresh.goto("./");
  await expect(button(fresh, "Continue A Hello Heart")).toHaveCount(1);
  await selectCrew(fresh);
  await button(fresh, "Episode Plans").click();
  await expect(dialog(fresh).getByText(/1 started/)).toBeVisible();
  await expect(button(fresh, "Open linked cartoon")).toBeVisible();
});
