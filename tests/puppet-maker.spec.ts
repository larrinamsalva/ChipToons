import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { backup, saved } from "./production-helpers";
import { SUNNY_NAME } from "../src/puppet-project";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const card = (page: Page, name: string) =>
  dialog(page)
    .locator(".library-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
async function shot(page: Page, info: TestInfo, title: string) {
  if (info.project.name === "tablet") return;
  await info.attach(`puppet-${title}-${info.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
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
const rigOf = (project: Awaited<ReturnType<typeof backup>>["data"]) =>
  project.characters.find((c) => c.name === SUNNY_NAME)!.puppet!;

test("makes a puppet, edits a joint and pose, animates, undoes and restores its saved project", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.goto("./");
  if (info.project.name === "desktop")
    await button(page, "Switch to dark theme").click();
  await button(page, "Create a Puppet Character").click();
  await audit(page);
  await shot(page, info, "start");
  await button(page, "Build a Character").click();
  await expect(dialog(page).locator("[data-puppet-part]")).toHaveCount(6);
  await dialog(page).getByLabel("Body-part hierarchy").selectOption("rightArm");
  await dialog(page).getByLabel("Pivot X", { exact: true }).fill("5");
  const marker = dialog(page).getByRole("button", {
    name: "Move joint",
    exact: true,
  });
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog(page).getByLabel("Joint X", { exact: true })).toHaveValue(
    "47",
  );
  if (info.project.use.hasTouch) {
    await marker.scrollIntoViewIfNeeded();
    const box = (await marker.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 18, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
    await expect
      .poll(async () =>
        Number(
          await dialog(page)
            .getByLabel("Joint X", { exact: true })
            .inputValue(),
        ),
      )
      .toBeGreaterThan(47);
  }
  await audit(page);
  await shot(page, info, "pivot");
  await button(page, "Next").click();
  await dialog(page).getByLabel("Try a Pose").selectOption("waving");
  await button(page, "Duplicate Pose").click();
  await dialog(page).getByLabel("Pose name").fill("Friendly wave");
  await dialog(page).getByLabel("Pose rotation (degrees)").fill("-112");
  await dialog(page)
    .getByLabel("Expression", { exact: true })
    .selectOption("sad");
  await button(page, "Save Pose").click();
  await expect(
    dialog(page).getByLabel("Try a Pose").locator("option:checked"),
  ).toHaveText("Friendly wave");
  await shot(page, info, "poses");
  await button(page, "Preview").click();
  await button(page, "Save Character").click();
  await expect(
    dialog(page)
      .getByRole("status")
      .filter({ hasText: "in your character library" }),
  ).toBeVisible();
  await button(page, "Add to Cartoon").click();
  await saved(page);
  await button(page, "Production step: Preview").click();
  await button(page, `Select ${SUNNY_NAME} track`).click();
  await page.getByLabel("Animation action").selectOption("wave");
  await button(page, "Preview action").click();
  await button(page, "Back to timeline").click();
  await button(page, "Apply action").click();
  await page.getByLabel("Choose keyframe").selectOption({ index: 2 });
  await page.getByLabel("Joint to animate").selectOption("rightArm");
  await page
    .getByLabel("Copy a saved pose into this keyframe")
    .selectOption({ label: "Friendly wave" });
  await saved(page);
  const project = (await backup(page)).data;
  const original = project.scenes[0].elements.at(-1)!;
  expect(rigOf(project).parts.find((p) => p.id === "rightArm")?.pivotX).toBe(5);
  expect(original.animation?.keyframes[2].joints?.rightArm.angle).toBe(-112);
  expect(original.animation?.keyframes[2].emotion).toBe("sad");
  await page.getByLabel("Joint rotation (degrees)").scrollIntoViewIfNeeded();
  await shot(page, info, "timeline");
  await button(page, "Undo edit").click();
  await saved(page);
  expect(
    (await backup(page)).data.scenes[0].elements.at(-1)?.animation?.keyframes[2]
      .joints?.rightArm.angle,
  ).not.toBe(-112);
  await button(page, "Redo edit").click();
  await saved(page);
  await page.reload();
  await button(page, `Continue ${project.title}`).click();
  await saved(page);
  expect((await backup(page)).data.scenes).toEqual(project.scenes);
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "sunny.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Backup restored as a separate project" }),
  ).toBeVisible();
  await saved(page);
  const restored = (await backup(page)).data;
  expect(restored.id).not.toBe(project.id);
  expect(rigOf(restored)).toEqual(rigOf(project));
});

test("drawn objects and uploaded artwork are portable and library changes stay separate", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("./");
  await button(page, "Open art library").click();
  await button(page, "Drawings").click();
  await button(page, "Draw artwork").click();
  await button(page, "Star").click();
  await button(page, "Insert shape").click();
  await page
    .getByRole("textbox", { name: "Character name", exact: true })
    .fill("A drawn star");
  await button(page, "Continue to save artwork").click();
  await button(page, "Save to library").click();
  await expect(card(page, "A drawn star")).toBeVisible();
  await dialog(page)
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await button(page, "Create a Puppet Character").click();
  await button(page, "Use My Drawing").click();
  await dialog(page)
    .getByLabel("Saved drawing")
    .selectOption({ label: "A drawn star" });
  await dialog(page)
    .getByRole("checkbox", { name: /^1\. star/ })
    .check();
  await button(page, "Assign selected objects").click();
  await expect(
    dialog(page).getByText(/Part artwork: head from drawing/),
  ).toBeVisible();
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=";
  await dialog(page).getByLabel("Body-part hierarchy").selectOption("leftArm");
  await dialog(page).getByLabel("Artwork source").selectOption("upload");
  await dialog(page)
    .getByLabel("Upload artwork for selected part")
    .setInputFiles({
      name: "original-arm.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(
    dialog(page).getByText(/Part artwork: original-arm/),
  ).toBeVisible();
  await button(page, "Next").click();
  await button(page, "Preview").click();
  await button(page, "Add to Cartoon").click();
  await saved(page);
  const first = (await backup(page)).data;
  expect(first.assets.some((a) => a.dataUrl.endsWith(png))).toBe(true);
  expect(first.assets.some((a) => a.drawing?.objects[0].kind === "star")).toBe(
    true,
  );
  await button(page, "Save and return to my cartoons").click();
  await button(page, "Open art library").click();
  await card(page, SUNNY_NAME)
    .getByRole("button", { name: "Edit puppet / rename" })
    .click();
  await dialog(page).getByLabel("Pivot X", { exact: true }).fill("11");
  await button(page, "Next").click();
  await button(page, "Preview").click();
  await button(page, "Save Character").click();
  await expect(
    dialog(page)
      .getByRole("status")
      .filter({ hasText: "in your character library" }),
  ).toBeVisible();
  await button(page, "Cancel").click();
  await card(page, SUNNY_NAME)
    .getByRole("button", { name: "Start cartoon with this" })
    .click();
  await saved(page);
  const second = (await backup(page)).data;
  expect(rigOf(second).parts.find((p) => p.id === "head")?.pivotX).toBe(11);
  await button(page, "Save and return to my cartoons").click();
  await button(page, `Continue ${first.title}`).click();
  await saved(page);
  expect(rigOf((await backup(page)).data)).toEqual(rigOf(first));
});
