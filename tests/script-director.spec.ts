import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { createAssistantDraft } from "../src/assistant";
import { kindHeartsCrew } from "../src/series-starter";
import { episodeBrief } from "../src/series";
import { builtInSound } from "../src/sounds";
import { backup, restore, saved } from "./production-helpers";

test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

const name = "Script director test episode";
const line = "Come sit with me under the tree.";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const words = (page: Page) => dialog(page).getByRole("textbox", { name: "Spoken words", exact: true });
const fixture = () => {
  const { plan, artwork } = kindHeartsCrew();
  const episode = plan.episodes[0];
  const project = createAssistantDraft({ ...episodeBrief(episode, 1), title: name },
    plan.cast.slice(0, 2).map((member, index) => ({
      name: "Sunny", seriesCastId: member.id, library: artwork[index], voice: { pace: "Slow and clear" },
    }))).project;
  project.scriptOptions = { pace: 120, pause: 1, seriesTitle: plan.name };
  return project;
};

async function openDirector(page: Page) {
  await button(page, "Write My Episode Script").click();
  await expect(dialog(page).getByRole("heading", { name: "Write My Episode Script" })).toBeVisible();
}

async function addLine(page: Page) {
  await button(page, "Add dialogue line").click();
  await words(page).fill(line);
  await dialog(page).getByRole("combobox", { name: "Line speaker", exact: true }).selectOption({ label: "Sunny · Recurring cast 2" });
  await dialog(page).getByRole("textbox", { name: "Delivery note" }).fill("Wave hello, then listen calmly.");
}

async function audit(page: Page) {
  expect(await dialog(page).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}

test("writes and reorders stable cast lines with undo and redo, exports a readable script and keeps saved edits", async ({ page }, info) => {
  const project = fixture();
  await restore(page, project);
  await saved(page);
  await button(page, "Save and return to my cartoons").click();
  await button(page, "Switch to dark theme").click();
  await button(page, `Continue ${name}`).click();
  await openDirector(page);
  await addLine(page);
  await button(page, "Duplicate line").press("Enter");
  await words(page).fill("This space is for you.");
  await button(page, "Move line earlier").press("Enter");
  await button(page, "Undo script edit").click();
  await button(page, "Redo script edit").click();
  await expect(words(page)).toHaveValue("This space is for you.");
  await expect(dialog(page).getByRole("combobox", { name: "Line speaker", exact: true })).toHaveValue(project.characters[1].id);
  await audit(page);
  await dialog(page).getByRole("region", { name: "Edit selected script line" })
    .evaluate(node => node.scrollIntoView({ block: "start" }));
  await info.attach("script-editor", { body: await dialog(page).screenshot(), contentType: "image/png" });
  await dialog(page).getByText("Local dialogue suggestions", { exact: true }).click();
  await button(page, "Add suggested dialogue").click();
  await expect(words(page)).toHaveValue(/neighborhood park/);
  await button(page, "Add script caption drafts").click();
  await expect(dialog(page).getByRole("status").filter({ hasText: "Caption drafts added" })).toBeVisible();
  const pending = page.waitForEvent("download");
  await button(page, "Download script").click();
  const print = await readFile((await (await pending).path())!, "utf8");
  expect(print).toContain("The Kind Hearts Crew");
  expect(print).toContain("Sunny (Wave hello, then listen calmly.): This space is for you.");
  await button(page, "Close dialog").click();
  await saved(page);
  const snapshot = (await backup(page)).data;
  const scene = snapshot.scenes[0];
  const lines = scene.script!.lines.filter(item => item.speakerId === project.characters[1].id);
  expect(lines.map(item => item.text)).toEqual(["This space is for you.", line]);
  expect(scene.dialogue).toContain(line);
  expect(scene.narration).toBe(project.scenes[0].narration);
  await button(page, "Save and return to my cartoons").click();
  await page.reload();
  await button(page, `Continue ${name}`).click();
  await openDirector(page);
  await dialog(page).getByRole("button", { name: /This space is for you/ }).click();
  await expect(words(page)).toHaveValue("This space is for you.");
});

test("guides a real microphone take, preserves both originals, reviews changed words and restores a complete backup", async ({ page }, info) => {
  test.setTimeout(60_000);
  const project = fixture();
  await restore(page, project);
  await saved(page);
  await openDirector(page);
  await addLine(page);
  await button(page, "Record This Line").click();
  await expect(dialog(page).getByRole("region", { name: "Recording script" })).toContainText(line);
  await expect(dialog(page).getByRole("region", { name: "Recording script" })).toContainText("Sunny");
  await audit(page);
  await info.attach("guided-recording", { body: await dialog(page).screenshot(), contentType: "image/png" });
  await button(page, "Start microphone recording").click();
  await expect.poll(async () => Number((await dialog(page).locator(".recording-indicator").innerText()).match(/([\d.]+)s/)?.[1])).toBeGreaterThan(0.6);
  await button(page, "Stop recording").click();
  await expect(dialog(page).getByLabel("Original audio source")).toBeVisible();
  await button(page, "Back to script").click();
  await expect(dialog(page).getByRole("alert")).toContainText("This take has not been saved");
  await button(page, "Keep working on this take").click();
  await button(page, "Save take to this line").click();
  await expect(dialog(page).getByRole("status").filter({ hasText: "Saved on this device" }).first()).toBeVisible();
  await button(page, "Back to script").click();
  await expect(dialog(page).getByRole("heading", { name: /Recording assigned/ })).toBeVisible();
  await button(page, "Record This Line").click();
  await dialog(page).getByLabel("Upload audio file").setInputFiles({
    name: "second-take.wav", mimeType: "audio/wav",
    buffer: Buffer.from(builtInSound("sparkle").dataUrl.split(",")[1], "base64"),
  });
  await button(page, "Save take to this line").click();
  await expect(dialog(page).getByRole("status").filter({ hasText: "Saved on this device" }).first()).toBeVisible();
  await button(page, "Back to script").click();
  await dialog(page).getByRole("combobox", { name: "Listen to a take" }).selectOption({ index: 1 });
  await button(page, "Use this take").click();
  await button(page, "Approve after listening").click();
  await expect(dialog(page).getByText("1 of 3 written lines approved")).toBeVisible();
  await words(page).fill("You are welcome here.");
  await expect(dialog(page).getByRole("heading", { name: /Needs review/ })).toBeVisible();
  await button(page, "Edit audio timing").click();
  await button(page, "Enable long-episode audio").click();
  await expect(dialog(page).getByRole("heading", { name: "Long-episode audio is enabled" })).toBeVisible();
  await button(page, "Back to cartoon").click();
  await button(page, "Close dialog").click();
  await saved(page);
  const pending = page.waitForEvent("download");
  await button(page, "Project backup").click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.ctepisode$/);
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "scripted.ctepisode", mimeType: "application/octet-stream",
    buffer: await readFile((await download.path())!),
  });
  await expect(page.getByRole("status").filter({ hasText: "Backup restored as a separate project" })).toBeVisible();
  await saved(page);
  await openDirector(page);
  await dialog(page).getByRole("button", { name: /You are welcome here/ }).click();
  await expect(dialog(page).getByRole("combobox", { name: "Listen to a take" }).getByRole("option")).toHaveCount(3);
  await expect(dialog(page).getByRole("heading", { name: /Needs review/ })).toBeVisible();
});

test("keeps a stale script draft in one tab without overwriting the current episode", async ({ page, context }) => {
  await restore(page, fixture());
  await openDirector(page);
  await addLine(page);
  await expect(dialog(page).getByRole("status").filter({ hasText: "Saved on this device" })).toBeVisible();
  const other = await context.newPage();
  await other.goto(page.url());
  await button(other, `Continue ${name}`).click();
  await expect(other.getByRole("status").filter({ hasText: "Open read-only" })).toBeVisible();
  await button(other, "Edit in This Tab").click();
  await button(other, "Take Over Editing").click();
  await openDirector(other);
  await dialog(other).getByRole("button", { name: /Come sit with me/ }).click();
  await words(other).fill("Newest saved words.");
  await expect(dialog(other).getByRole("status").filter({ hasText: "Saved on this device" })).toBeVisible();
  await words(page).fill("My separate unfinished words.");
  await expect(dialog(page).getByRole("alert")).toContainText("Another tab changed this cartoon");
  await expect(words(page)).toHaveValue("My separate unfinished words.");
  await button(other, "Close dialog").click();
  const latest = (await backup(other)).data;
  expect(latest.scenes[0].script?.lines.at(-1)?.text).toBe("Newest saved words.");
});
