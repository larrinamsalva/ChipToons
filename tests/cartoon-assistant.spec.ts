import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { backup, restore, saved } from "./production-helpers";
import {
  createAssistantDraft,
  applyDirections,
  PLAYGROUND_BRIEF,
} from "../src/assistant";
import { builtInSound } from "../src/sounds";

const title = PLAYGROUND_BRIEF.title;
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const review = (page: Page) => button(page, "Review animation suggestions");
const fixture = () =>
  createAssistantDraft(PLAYGROUND_BRIEF, [
    { name: "Shine" },
    { name: "Sunny" },
    { name: "Sam" },
  ]);

async function startDemo(page: Page) {
  await page.goto("./");
  await expect(button(page, "Help Me Make My Cartoon")).toBeVisible();
  await page.context().setOffline(true);
  await button(page, "Help Me Make My Cartoon").click();
  await button(page, "Try The Playground of Kind Hearts").click();
  await expect(dialog(page).getByLabel("Tell us your story idea")).toHaveValue(
    PLAYGROUND_BRIEF.idea,
  );
  await button(page, "Next").click();
  await expect(
    dialog(page).getByRole("group", { name: "Lead character" }),
  ).toBeVisible();
  await expect(dialog(page).getByLabel("Character name 1")).toHaveValue(
    "Shine",
  );
  await button(page, "Next").click();
  await expect(dialog(page).getByLabel("Story pattern")).toHaveValue(
    "friendship",
  );
  await button(page, "Suggest scenes").click();
  await expect(
    dialog(page).getByRole("region", { name: "Storyboard review" }),
  ).toBeVisible();
}
async function audit(page: Page) {
  expect(
    await dialog(page).evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("dialog")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}

test("assistant previews editable actions, saves, reopens, edits a generated keyframe and restores a backup", async ({
  page,
}, info) => {
  await startDemo(page);
  await dialog(page)
    .getByLabel("Suggested scene title")
    .fill("A sunny welcome");
  await dialog(page)
    .getByLabel("Suggested narration")
    .fill("Shine, Sunny and Sam are at the playground.");
  await audit(page);
  await button(page, "Review actions and camera").click();
  await dialog(page).getByLabel("Suggested action").selectOption("walk");
  await dialog(page).getByLabel("Camera suggestion").selectOption("follow");
  await button(page, "Preview this scene").click();
  await expect
    .poll(async () =>
      Number(
        await dialog(page).getByLabel("Preview time (seconds)").inputValue(),
      ),
    )
    .toBeGreaterThan(0.2);
  await button(page, "Pause preview").click();
  await info.attach(`assistant-${info.project.name}`, {
    body: await dialog(page).screenshot(),
    contentType: "image/png",
  });
  await dialog(page).getByLabel("Review scene").selectOption("2");
  await dialog(page).getByLabel("Include suggestions for this scene").uncheck();
  await button(page, "Create animated first draft").click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await saved(page);
  const first = (await backup(page)).data;
  expect(first.scenes[0].title).toBe("A sunny welcome");
  expect(first.scenes[0].narration).toBe(
    "Shine, Sunny and Sam are at the playground.",
  );
  expect(
    first.scenes[0].elements[0].animation?.keyframes.length,
  ).toBeGreaterThan(2);
  expect(first.scenes[0].cameraAnimation?.followId).toBe(
    first.scenes[0].elements[0].id,
  );
  expect(first.scenes[2].cameraAnimation).toBeUndefined();
  await button(page, "Save and return to my cartoons").click();
  await button(page, `Continue ${title}`).click();
  await button(page, "Production step: Preview").click();
  await button(page, "Select Shine track").click();
  await page.getByLabel("Choose keyframe").selectOption({ index: 1 });
  await page.getByLabel("Keyframe expression").selectOption("excited");
  await saved(page);
  const edited = (await backup(page)).data;
  expect(edited.scenes[0].elements[0].animation?.keyframes[1].emotion).toBe(
    "excited",
  );
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "kind-hearts.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(edited)),
  });
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Backup restored as a separate project" }),
  ).toBeVisible();
  await saved(page);
  const restored = (await backup(page)).data;
  expect(restored.id).not.toBe(edited.id);
  expect(restored.scenes).toEqual(edited.scenes);
  await button(page, "Production step: Preview").click();
  await button(page, "Play cartoon").click();
  await expect(button(page, "Pause cartoon")).toBeVisible();
  await button(page, "Pause cartoon").click();
});

test("existing suggestions preserve unapproved scenes and media, cancel cleanly, and undo together", async ({
  page,
}, info) => {
  const plan = fixture();
  const animated = applyDirections(plan.project, [plan.directions[3]]);
  const project = {
    ...animated,
    audioAssets: [builtInSound("notice")],
    captions: [
      {
        id: "assistant-caption",
        sceneId: animated.scenes[2].id,
        start: 0,
        end: 2,
        text: "Keep this caption.",
      },
    ],
  };
  await restore(page, project);
  await saved(page);
  const original = (await backup(page)).data;
  await button(page, "Switch to dark theme").click();
  await review(page).click();
  await dialog(page).getByLabel("Review scene").selectOption("2");
  await dialog(page).getByLabel("Include suggestions for this scene").check();
  await audit(page);
  await info.attach(`assistant-dark-${info.project.name}`, {
    body: await dialog(page).screenshot(),
    contentType: "image/png",
  });
  await button(page, "Cancel").click();
  expect((await backup(page)).data).toEqual(original);
  await review(page).click();
  await dialog(page).getByLabel("Review scene").selectOption("2");
  await dialog(page).getByLabel("Include suggestions for this scene").check();
  await button(page, "Apply reviewed suggestions (1 scene)").click();
  await saved(page);
  const edited = (await backup(page)).data;
  expect(edited.scenes[2].cameraAnimation).toBeTruthy();
  expect(edited.scenes[3]).toEqual(original.scenes[3]);
  expect(edited.audioAssets).toEqual(original.audioAssets);
  expect(edited.captions).toEqual(original.captions);
  await button(page, "Undo edit").click();
  await saved(page);
  expect((await backup(page)).data.scenes).toEqual(original.scenes);
});

test("another tab taking over blocks a reviewed proposal", async ({
  page,
  context,
}) => {
  await restore(page, fixture().project);
  await saved(page);
  await review(page).click();
  await dialog(page).getByLabel("Review scene").selectOption("2");
  await dialog(page).getByLabel("Include suggestions for this scene").check();
  const other = await context.newPage();
  await other.goto(page.url());
  await button(other, `Continue ${title}`).click();
  await button(other, "Edit in This Tab").click();
  await button(other, "Take Over Editing").click();
  await saved(other);
  await button(page, "Apply reviewed suggestions (1 scene)").click();
  await expect(dialog(page).getByRole("alert")).toHaveText(
    /cartoon changed while you reviewed/,
  );
  await button(page, "Cancel").click();
  expect((await backup(other)).data.scenes[2].cameraAnimation).toBeUndefined();
});
