import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emptyProduction } from "../src/media-model";
import { segmentedProject } from "./creator-fixtures";
import { backup, restore, saved } from "./production-helpers";

test("prepares local publishing files with accessible controls and keeps the editable cartoon intact", async ({ page }, info) => {
  test.setTimeout(60_000);
  const outbound: string[] = [];
  page.on("request", request => {
    if (/(^|\.)(youtube\.com|google\.com)$/.test(new URL(request.url()).hostname)) outbound.push(request.url());
  });
  const project = { ...segmentedProject(), ...emptyProduction() };
  project.scenes = project.scenes.slice(0, 1);
  project.idea = "An original moving picture.";
  await restore(page, project);
  await saved(page);
  const before = (await backup(page)).data;
  if (info.project.name === "phone") await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  await page.getByRole("button", { name: "Prepare for YouTube", exact: true }).click();
  const kit = page.getByRole("dialog", { name: "Prepare for YouTube" });
  await expect(kit.getByRole("heading", { name: "Your publishing files" })).toBeFocused();
  const movie = kit.getByRole("region", { name: "Finished movie" });
  await expect(movie.getByText("Required.", { exact: true })).toBeVisible();
  await expect(kit.getByRole("button", { name: "Download YouTube WebM" })).toHaveCount(0);
  const width = info.project.name === "phone" ? 800 : 1280;
  await movie.getByRole("button", { name: "Render YouTube WebM" }).click();
  await expect(movie.getByText(new RegExp(`${width} × ${width * 9 / 16} · WebM`))).toBeVisible({ timeout: 25_000 });
  await expect(movie.getByText(/No audio track/)).toBeVisible();

  await kit.getByLabel("Video title").fill("My reviewed repair cartoon");
  await kit.getByLabel("Description draft").fill("A short original animation for our lesson.");
  await kit.getByLabel("Educational topic").fill("Repair and reuse");
  await kit.getByLabel("Episode number").fill("2");
  await kit.getByLabel("Hashtags").fill("#RepairAndReuse");
  await kit.getByLabel("Creator credits").fill("Story and artwork by the workshop team.");
  const details = kit.getByRole("button", { name: "Download video details" });
  await expect(details).toBeDisabled();
  await kit.getByRole("checkbox", { name: "I approve this title and description" }).check();
  await kit.getByLabel("Video title").fill("Our reviewed repair cartoon");
  await expect(details).toBeDisabled();
  await kit.getByRole("checkbox", { name: "I approve this title and description" }).check();
  const textDownload = page.waitForEvent("download");
  await details.click();
  const textFile = await textDownload;
  expect(textFile.suggestedFilename()).toMatch(/-video-details\.txt$/);
  expect(await readFile((await textFile.path())!, "utf8")).toBe([
    "Our reviewed repair cartoon", "A short original animation for our lesson.", "Learning topic: Repair and reuse",
    "Episode 2", "Credits\nStory and artwork by the workshop team.", "#RepairAndReuse\n",
  ].join("\n\n"));
  await kit.getByRole("checkbox", { name: /Remove private details about children/ }).check();
  const checklist = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download publishing checklist" }).click();
  const checklistFile = await checklist;
  const notes = await readFile((await checklistFile.path())!, "utf8");
  expect(notes).toContain("[x] Remove private details about children");
  expect(notes).toContain("Made for Kids");
  expect(notes).toContain("longer than 15 minutes");
  expect(outbound).toEqual([]);

  const { scrollWidth, clientWidth } = await kit.evaluate(element => ({
    scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  expect((await new AxeBuilder({ page }).include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);

  await kit.getByRole("button", { name: "Back to finishing" }).click();
  await page.getByRole("button", { name: "Back to studio" }).click();
  const after = (await backup(page)).data;
  expect(after).toEqual(before);
});
