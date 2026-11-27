import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { backup, restore, saved } from "./production-helpers";
import { SUNNY_NAME } from "../src/puppet-project";
import { paintedFootCartoon } from "./custom-foot-fixture";

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

test("marks and mirrors a painted shoe sole, then preserves it in a restored cartoon", async ({ page }) => {
  await page.goto("./");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 24; canvas.height = 24;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ef29db"; context.fillRect(0, 0, 24, 24);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await button(page, "Create a Puppet Character").click();
  await button(page, "Build a Character").click();
  await dialog(page).getByLabel("Another body part").selectOption("leftFoot");
  await button(page, "Add selected part").click();
  await dialog(page).getByLabel("Artwork source").selectOption("upload");
  await dialog(page).getByLabel("Upload artwork for selected part").setInputFiles({
    name: "painted-shoe.png", mimeType: "image/png", buffer: Buffer.from(png, "base64"),
  });
  const marker = dialog(page).locator('g[aria-label="Painted foot sole point"]');
  await expect(marker).toBeVisible();
  const original = await marker.getAttribute("transform");
  const move = async (name: string, value: string) => {
    await dialog(page).getByRole("slider", { name }).evaluate((node, next) => {
      const input = node as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
        .call(input, next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };
  await move("Sole across picture", "75");
  await move("Sole down picture", "80");
  await expect(dialog(page).getByRole("slider", { name: "Sole across picture" })).toHaveValue("75");
  await expect(marker).not.toHaveAttribute("transform", original!);
  await button(page, "Mirror artwork to right Foot").click();
  await expect(dialog(page).getByRole("slider", { name: "Sole across picture" })).toHaveValue("25");
  await button(page, "Next").click();
  await button(page, "Preview").click();
  await button(page, "Add to Cartoon").click();
  await saved(page);
  const project = (await backup(page)).data;
  const left = rigOf(project).parts.find(part => part.role === "leftFoot")!;
  const right = rigOf(project).parts.find(part => part.role === "rightFoot")!;
  expect([left.soleX, left.soleY, right.soleX, right.soleY]).toEqual([0.75, 0.8, 0.25, 0.8]);
  expect(left.assetId).toBe(right.assetId);
  await restore(page, { ...project, id: "restored-painted-shoe-marker" });
  expect(rigOf((await backup(page)).data).parts.find(part => part.role === "rightFoot"))
    .toEqual(right);
});

test("reviews picture-foot travel in an ordinary scene and seeks its real Stage frame", async ({ page }) => {
  await page.goto("./");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 24; canvas.height = 24;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ef29db"; context.fillRect(0, 0, 24, 24);
    return canvas.toDataURL("image/png");
  });
  await restore(page, paintedFootCartoon(png));
  const navigation = page.getByRole("navigation", { name: "Editor panels" });
  if (await navigation.isVisible())
    await navigation.getByRole("button", { name: "Edit scene" }).click();
  const review = page.getByLabel("Character foot travel review");
  await review.getByRole("button", { name: "Review Character Feet" }).click();
  await expect(review.getByLabel("Character foot summary"))
    .toContainText("Right foot: 73 Stage samples");
  await expect(review.getByText(/bottom center of the part's image box/)).toBeVisible();
  const left = review.getByRole("combobox", { name: "Character foot to review" });
  await left.selectOption("left");
  await expect(review.getByLabel("Character foot summary")).toContainText("Left foot");
  await left.selectOption("right");
  const finding = review.getByRole("button", { name: /Show Foot Frame/ }).first();
  await expect(finding).toBeVisible();
  await finding.click();
  if (await navigation.isVisible())
    await navigation.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".stage-panel .live-stage [data-puppet-part=rightFoot] image"))
    .toBeVisible();
  const savedProject = (await backup(page)).data;
  expect(savedProject.scenes[0].elements[0].animation)
    .toEqual(paintedFootCartoon(png).scenes[0].elements[0].animation);
});

test("reconnects a painted part without shifting its still picture and saves the new hierarchy", async ({ page }) => {
  await page.goto("./");
  await button(page, "Create a Puppet Character").click();
  await button(page, "Build a Character").click();
  await dialog(page).getByLabel("Another body part").selectOption("leftHand");
  await button(page, "Add selected part").click();
  const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=";
  await dialog(page).getByLabel("Artwork source").selectOption("upload");
  await dialog(page).getByLabel("Upload artwork for selected part").setInputFiles({
    name: "original-hand.png", mimeType: "image/png", buffer: Buffer.from(image, "base64"),
  });
  await expect(dialog(page).getByText(/Part artwork: original-hand/)).toBeVisible();
  const parent = dialog(page).getByLabel("Attach selected part to");
  await parent.selectOption("torso");
  // The preview contains a single hand group. Compare measured stage-space
  // joint coordinates, allowing insignificant floating-point differences.
  const handId = await dialog(page).getByLabel("Body-part hierarchy").inputValue();
  const group = dialog(page).locator(`[data-puppet-part="${handId}"]`);
  const before = await group.getAttribute("transform");
  expect(before).toMatch(/^translate\(/);
  await parent.selectOption("leftArm");
  await expect(parent).toHaveValue("leftArm");
  const after = await group.getAttribute("transform");
  const coords = (transform: string | null) => transform!.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!.slice(1).map(Number);
  expect(coords(after)[0]).toBeCloseTo(coords(before)[0]);
  expect(coords(after)[1]).toBeCloseTo(coords(before)[1]);
  await button(page, "Make It Wave").click();
  await expect(dialog(page).locator('[data-preview-action="wave"]')).toBeVisible();
  await button(page, "Show still puppet").click();
  await button(page, "Next").click();
  await button(page, "Preview").click();
  await button(page, "Add to Cartoon").click();
  await saved(page);
  const data = (await backup(page)).data;
  const savedHand = rigOf(data).parts.find(part => part.role === "leftHand")!;
  expect(savedHand.parentId).toBe("leftArm");
  expect(data.assets.some(asset => asset.id === savedHand.assetId)).toBe(true);
  await restore(page, { ...data, id: "restored-parented-hand" });
  expect(rigOf((await backup(page)).data).parts.find(part => part.role === "leftHand"))
    .toEqual(savedHand);
});

test("mirrors one uploaded arm cutout into a separate editable joint and restores it", async ({ page }) => {
  await page.goto("./");
  const source = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 20;
    canvas.height = 48;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#f42635";
    context.fillRect(0, 0, 10, 48);
    context.fillStyle = "#2462ee";
    context.fillRect(10, 0, 10, 48);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await button(page, "Create a Puppet Character").click();
  await button(page, "Build a Character").click();
  await dialog(page).getByLabel("Body-part hierarchy").selectOption("leftArm");
  await dialog(page).getByLabel("Artwork source").selectOption("upload");
  await dialog(page).getByLabel("Upload artwork for selected part").setInputFiles({
    name: "painted-left-arm.png", mimeType: "image/png", buffer: Buffer.from(source, "base64"),
  });
  await expect(button(page, "Mirror artwork to right Arm")).toBeEnabled();
  await button(page, "Mirror artwork to right Arm").click();
  await expect(dialog(page).getByLabel("Body-part hierarchy").locator("option:checked"))
    .toContainText("right Arm");
  await expect(dialog(page).getByLabel("Flip this part artwork horizontally")).toBeChecked();
  const images = dialog(page).locator('[data-puppet-part="leftArm"] image, [data-puppet-part="rightArm"] image');
  await expect(images).toHaveCount(2);
  expect(await images.evaluateAll(elements => elements.map(element => ({
    source: element.getAttribute("href"), transform: element.getAttribute("transform"),
  })))).toEqual([
    { source: expect.stringContaining("data:image/png;base64,"), transform: null },
    { source: expect.stringContaining("data:image/png;base64,"), transform: "scale(-1 1)" },
  ]);
  await dialog(page).getByLabel("Joint X", { exact: true }).fill("58");
  await button(page, "Make It Wave").click();
  await expect(dialog(page).locator('[data-preview-action="wave"]')).toBeVisible();
  await button(page, "Show still puppet").click();
  await button(page, "Next").click();
  await button(page, "Preview").click();
  await button(page, "Add to Cartoon").click();
  await saved(page);
  const data = (await backup(page)).data;
  const rig = rigOf(data);
  const left = rig.parts.find(part => part.role === "leftArm")!;
  const right = rig.parts.find(part => part.role === "rightArm")!;
  expect(right).toMatchObject({ assetId: left.assetId, flipX: true, x: 58 });
  expect(data.assets.filter(asset => asset.id === left.assetId)).toHaveLength(1);
  await restore(page, { ...data, id: "restored-mirrored-cutout" });
  await expect(page.getByRole("button", { name: `Select ${SUNNY_NAME}`, exact: true })
    .locator('[data-puppet-part="rightArm"] image[transform="scale(-1 1)"]'))
    .toBeAttached();
  expect(rigOf((await backup(page)).data).parts.find(part => part.role === "rightArm"))
    .toEqual(right);
});

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


test("creates and saves a new fully jointed original workshop hero with editable colors and hair", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto("./");
  await button(page, "Create a Puppet Character").click();
  await dialog(page).getByRole("button", {
    name: "Start with an Articulated Workshop Character", exact: true,
  }).click();
  await expect(dialog(page).locator('[data-puppet-part]')).toHaveCount(15);
  await expect(dialog(page).locator('[data-puppet-finish="cinematic"]')).toHaveCount(1);
  await expect(dialog(page).locator('[data-workshop-hairstyle="short-side-part"]'))
    .toHaveCount(1);

  // The actual 15-part character now previews its own authored walk and
  // reach; these quick 3-second previews do not save any new keyframes.
  await dialog(page).getByRole("button", {
    name: "Preview Knee-Bending Walk", exact: true,
  }).click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "walk-in-place");
  await dialog(page).getByRole("button", {
    name: "Preview Walk Across Stage", exact: true,
  }).click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "walk");
  await dialog(page).getByRole("button", {
    name: "Preview Jump & Gentle Landing", exact: true,
  }).click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "jump");
  await dialog(page).getByRole("button", {
    name: "Preview Victory Celebration", exact: true,
  }).click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "celebrate");
  await dialog(page).getByRole("button", {
    name: "Preview Full-Body Dance", exact: true,
  }).click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "dance");
  await dialog(page).getByRole("button", {
    name: "Preview Sit Down", exact: true,
  }).click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "sit");
  await dialog(page).getByRole("button", {
    name: "Preview Stand Up", exact: true,
  }).click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "stand");
  await dialog(page).getByRole("button", {
    name: "Preview Elbow-Bending Reach", exact: true,
  }).click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "point");
  await button(page, "Show still puppet").click();
  await expect(dialog(page).locator('svg[aria-label="Puppet preview"]'))
    .toHaveAttribute("data-preview-action", "still");
  await expect(dialog(page).locator('[data-puppet-part]')).toHaveCount(15);

  await dialog(page).getByLabel("Character name").fill("Nova Workshop Hero");
  await dialog(page).getByLabel("Workshop skin color").fill("#ac785b");
  await dialog(page).getByLabel("Workshop hair color").fill("#453260");
  const hairstyle = dialog(page).getByRole("combobox", { name: "Workshop hairstyle" });
  await hairstyle.selectOption("soft-waves");
  await expect(dialog(page).locator('[data-workshop-hairstyle="soft-waves"]'))
    .toHaveCount(1);
  await audit(page);

  await button(page, "Next").click();
  await button(page, "Preview").click();
  await button(page, "Add to Cartoon").click();
  await saved(page);
  const project = (await backup(page)).data;
  const hero = project.characters.find(character => character.name === "Nova Workshop Hero")!;
  expect(hero).toBeTruthy();
  expect(hero.puppet?.costume).toBe("workshop");
  expect(hero.puppet?.parts).toHaveLength(15);
  expect(hero.puppet?.headStyle).toBe("soft-waves");
  expect(hero.skin).toBe("#ac785b");
  expect(hero.hair).toBe("#453260");
  expect(project.scenes.some(scene =>
    scene.elements.some(element => element.characterId === hero.id))).toBe(true);

  // #155: Use the actual Editor to add a seat, align the rig's seated
  // pelvis to it and save the generated real keyframes, then Undo.
  const actor = project.scenes[0].elements.find(element => element.characterId === hero.id)!;
  expect(actor).toBeTruthy();
  const editSceneTab = button(page, "Edit scene");
  if (await editSceneTab.isVisible()) await editSceneTab.click();
  await page.getByLabel("Edit character").selectOption(actor.id);
  // A 10-second scene demonstrates sit 3s, wave 3s, seated rest 1s,
  // and real stand-up motion in the final 3 seconds.
  await page.getByLabel("Duration (seconds)").fill("10");
  await page.getByLabel("Duration (seconds)").blur();
  await saved(page);
  expect((await backup(page)).data.scenes[0].duration).toBe(10);
  await button(page, "Add Workshop Chair").click();
  await saved(page);
  const originalChairScene = (await backup(page)).data.scenes[0];
  const addedChair = originalChairScene.elements.find(item => item.prop === "chair")!;
  expect(addedChair).toBeTruthy();
  await button(page, "Add Workshop Bench").click();
  await saved(page);
  const furnished = (await backup(page)).data.scenes[0];
  const addedBench = furnished.elements.find(item => item.prop === "bench")!;
  expect(addedBench).toBeTruthy();
  expect(addedBench.sceneryDepth).toBe("behind");
  expect(addedBench.id).not.toBe(addedChair.id);
  // The newly added seat is selected, but creators can choose either.
  await expect(page.getByLabel("Seat in this scene")).toHaveValue(addedBench.id);
  await page.getByLabel("Seat in this scene").selectOption(addedChair.id);
  await button(page, "Align and Sit on Seat").click();
  await saved(page);
  const seatedProject = (await backup(page)).data;
  const seatedScene = seatedProject.scenes[0];
  const chair = seatedScene.elements.find(element => element.prop === "chair")!;
  const seatedActor = seatedScene.elements.find(element => element.id === actor.id)!;
  expect(chair).toBeTruthy();
  expect(chair.sceneryDepth).toBe("behind");
  expect(seatedActor.animation?.keyframes).toHaveLength(13);
  expect(seatedActor.animation!.keyframes.at(-1)?.pose).toBe("sitting");
  expect(seatedActor.animation!.keyframes.at(-1)?.joints?.leftShin?.angle).toBeGreaterThan(50);
  await shot(page, info, "chair-seated");

  // #156 continues the already saved seated track without touching its
  // original keyframe IDs or the furniture. Verify Undo returns to sitting.
  await button(page, "Add Stand Up After Sitting").click();
  await saved(page);
  const standingScene = (await backup(page)).data.scenes[0];
  const standingActor = standingScene.elements.find(element => element.id === actor.id)!;
  expect(standingActor.animation?.keyframes).toHaveLength(26);
  expect(standingActor.animation!.keyframes.slice(0, 13))
    .toEqual(seatedActor.animation!.keyframes);
  // Stand-up begins in the final three seconds, so the seated hold
  // depends on this project's scene duration (which need not be 8s).
  const riseStart = Math.round((standingScene.duration - 3) * 1000) / 1000;
  const seatHold = standingActor.animation!.keyframes.find(frame =>
    Math.abs(frame.time - riseStart) < .001);
  expect(seatHold?.pose).toBe("sitting");
  expect(standingActor.animation!.keyframes.at(-1)?.pose).toBe("standing");
  expect(standingScene.elements.find(element => element.id === chair.id)).toEqual(chair);
  await shot(page, info, "chair-standup");

  await button(page, "Undo edit").click();
  await saved(page);
  const backToSit = (await backup(page)).data.scenes[0];
  expect(backToSit.elements.find(element => element.id === actor.id)?.animation?.keyframes)
    .toEqual(seatedActor.animation!.keyframes);

  await button(page, "Undo edit").click();
  await saved(page);
  const reverted = (await backup(page)).data.scenes[0];
  expect(reverted.elements.find(element => element.id === actor.id)?.animation).toBeUndefined();
  expect(reverted.elements.find(element => element.id === addedBench.id)).toBeTruthy();

  // A second scene-local pass can choose the bench without moving or
  // overwriting the existing chair. The selected seat stays as the prop.
  await page.getByLabel("Seat in this scene").selectOption(addedBench.id);
  await button(page, "Align and Sit on Seat").click();
  await saved(page);
  const onBench = (await backup(page)).data.scenes[0];
  expect(onBench.elements.find(item => item.id === actor.id)?.animation?.keyframes)
    .toHaveLength(13);
  expect(onBench.elements.find(item => item.id === addedChair.id)).toEqual(addedChair);
  await shot(page, info, "bench-seated");

  // #158: wave using actual shoulder, elbow and wrist keys while
  // staying seated; the original 13 sitting keys survive untouched.
  await button(page, "Wave Hello While Seated").click();
  await saved(page);
  const wavingScene = (await backup(page)).data.scenes[0];
  const wavingActor = wavingScene.elements.find(item => item.id === actor.id)!;
  const onBenchActor = onBench.elements.find(item => item.id === actor.id)!;
  expect(wavingActor.animation?.keyframes).toHaveLength(25);
  expect(wavingActor.animation!.keyframes.slice(0, 13))
    .toEqual(onBenchActor.animation!.keyframes);
  const greeting = wavingActor.animation!.keyframes.find(key => key.time === 4.5)!;
  expect(greeting.pose).toBe("sitting");
  expect(greeting.joints!.rightArm!.angle).toBeLessThan(-70);
  expect(greeting.joints!.leftShin).toEqual(onBenchActor.animation!.keyframes.at(-1)!.joints!.leftShin);
  expect(wavingScene.elements.find(item => item.id === addedBench.id)).toEqual(addedBench);
  await shot(page, info, "bench-wave-hello");

  // #159: append the natural final stand without losing any of the
  // 25 sitting + waving keys, and preserve the selected bench.
  await button(page, "Stand Up After Wave").click();
  await saved(page);
  const greetingAndStand = (await backup(page)).data.scenes[0];
  const standingAfterHello = greetingAndStand.elements.find(item => item.id === actor.id)!;
  expect(standingAfterHello.animation?.keyframes).toHaveLength(38);
  expect(standingAfterHello.animation!.keyframes.slice(0, 25))
    .toEqual(wavingActor.animation!.keyframes);
  const seatedPause = standingAfterHello.animation!.keyframes.find(key => key.time === 7)!;
  expect(seatedPause.pose).toBe("sitting");
  expect(seatedPause.joints).toEqual(wavingActor.animation!.keyframes.at(-1)!.joints);
  const upright = standingAfterHello.animation!.keyframes.at(-1)!;
  expect(upright.time).toBe(10);
  expect(upright.pose).toBe("standing");
  // Neutral joints are intentionally omitted from sparse saved keyframes.
  // A missing shin is zero rotation, not an animation or serialization bug.
  expect(Math.abs(upright.joints?.leftShin?.angle ?? 0)).toBeLessThan(.001);
  expect(Object.values(upright.joints ?? {}).every(joint =>
    Math.abs(joint.angle) < .001)).toBe(true);
  expect(greetingAndStand.elements.find(item => item.id === addedBench.id)).toEqual(addedBench);
  expect(greetingAndStand.elements.find(item => item.id === addedChair.id)).toEqual(addedChair);
  await shot(page, info, "bench-wave-then-stand");

  // #160: review actual stored Stage poses without editing the cartoon.
  // Review shortcuts share the same seek clock as the timeline.
  const reviewSteps = [
    ["Review sitting", "3.00s"],
    ["Review wave", "4.50s"],
    ["Review rising", "8.50s"],
    ["Review standing", "10.00s"],
  ] as const;
  for (const [label, expectedTime] of reviewSteps) {
    if (await editSceneTab.isVisible()) await editSceneTab.click();
    await button(page, label).click();
    await expect(page.getByLabel("Scene current time")).toContainText(expectedTime);
  }
  expect((await backup(page)).data.scenes[0].elements.find(item => item.id === actor.id)?.animation?.keyframes)
    .toEqual(standingAfterHello.animation!.keyframes);

  // #161: Compare real two saved Stage frames side by side on all devices.
  // This review never writes to the project or moves the main playhead.
  if (await editSceneTab.isVisible()) await editSceneTab.click();
  await button(page, "Compare Two Poses Side by Side").click();
  await expect(page.getByRole("group", { name: "Before pose preview" }).locator("svg"))
    .toHaveCount(1);
  await expect(page.getByRole("group", { name: "After pose preview" }).locator("svg"))
    .toHaveCount(1);
  await expect(page.getByLabel("Before pose", { exact: true })).toHaveValue("seated");
  await expect(page.getByLabel("After pose", { exact: true })).toHaveValue("standing");
  await page.getByLabel("After pose", { exact: true }).selectOption("wave");
  await expect(page.getByRole("group", { name: "After pose preview" }))
    .toContainText("wave at 4.50 seconds");

  // #164: jump through actual consecutive saved Workshop transition
  // checkpoints without moving the main clock or editing timeline keys.
  await button(page, "Review Motion Steps").click();
  const stepReview = page.getByLabel("Recorded motion step review");
  const sitToWave = stepReview.getByRole("button", { name: /Compare sitting to wave/ });
  const waveToRise = stepReview.getByRole("button", { name: /Compare wave to rising/ });
  const riseToStand = stepReview.getByRole("button", { name: /Compare rising to standing/ });
  await expect(stepReview.getByRole("button", { name: /^Compare / })).toHaveCount(3);
  await sitToWave.click();
  await expect(page.getByLabel("Before pose", { exact: true })).toHaveValue("seated");
  await expect(page.getByLabel("After pose", { exact: true })).toHaveValue("wave");
  await expect(sitToWave).toHaveAttribute("aria-pressed", "true");

  // #165: all three genuine Stage frames must reflect saved motion, including
  // the timeline's real half-step pose, not a fabricated saved keyframe.
  await button(page, "Review Three-Frame Filmstrip").click();
  const filmstrip = page.getByLabel("Three-frame motion filmstrip");
  const firstFrame = filmstrip.getByRole("figure", { name: "Start motion filmstrip frame" });
  const middleFrame = filmstrip.getByRole("figure", { name: "Middle motion filmstrip frame" });
  const lastFrame = filmstrip.getByRole("figure", { name: "End motion filmstrip frame" });
  await expect(filmstrip.locator("svg")).toHaveCount(3);
  await expect(firstFrame).toContainText("3.00s");
  await expect(middleFrame).toContainText("3.75s");
  await expect(lastFrame).toContainText("4.50s");

  // #166: the user can scrub the actual interpolated Stage between
  // existing saved poses; the filmstrip and the main clock stay intact.
  const scrubber = page.getByLabel("Motion frame scrubber");
  const scrubControl = scrubber.getByRole("slider", {
    name: "Scrub motion within selected step",
  });
  const chooseScrub = (percent: number) =>
    scrubControl.evaluate((node, value) => {
      const input = node as HTMLInputElement;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, "value",
      )!.set!;
      setValue.call(input, String(value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, percent);
  await expect(scrubControl).toHaveValue("50");
  await expect(scrubber).toContainText("50% — 3.75s");
  await expect(scrubber.getByLabel("Scrubbed real Stage frame").locator("svg"))
    .toHaveCount(1);
  await chooseScrub(25);
  await expect(scrubber).toContainText("25% — 3.38s");
  await expect(scrubber).toContainText("Original Stage interpolation (not a new keyframe)");
  await chooseScrub(75);
  await expect(scrubber).toContainText("75% — 4.13s");

  // #167: play original interpolated Stage movement in a private loop.
  // The 20-minute export and main playhead remain independently verified.
  await button(page, "Review Motion Loop").click();
  const motionLoop = page.getByLabel("Selected motion loop");
  const loopReadout = motionLoop.getByLabel("Motion loop frame readout");
  await expect(loopReadout).toContainText("Paused · 0% · 3.00s");
  await expect(motionLoop.getByLabel("Playing original Stage movement").locator("svg"))
    .toHaveCount(1);
  await button(page, "Play Motion Loop").click();
  await expect(button(page, "Pause Motion Loop")).toBeVisible();
  // #169 reliability: an early first requestAnimationFrame callback must
  // not revert the Play button. Verify it survives multiple animation frames.
  await expect(loopReadout).not.toContainText("Playing · 0% · 3.00s");
  await expect(button(page, "Pause Motion Loop")).toBeVisible();
  await button(page, "Pause Motion Loop").click();
  await expect(loopReadout).toContainText("Paused");
  await motionLoop.getByLabel("Motion loop speed").selectOption("0.5");
  await button(page, "Restart Motion Loop").click();
  await expect(loopReadout).toContainText("Paused · 0% · 3.00s");
  await button(page, "Play Motion Loop").click();
  await expect(button(page, "Pause Motion Loop")).toBeVisible();
  await button(page, "Close Motion Loop").click();
  await expect(motionLoop.getByLabel("Playing original Stage movement"))
    .toHaveCount(0);

  // #168: inspect the true Stage at 24-fps spacing, with no new keyframes,
  // playhead seeks or changes to the animation / saved 20-minute episode.
  await button(page, "Review Frame by Frame").click();
  const frameInspector = page.getByLabel("Motion frame-by-frame inspector");
  const frameStatus = frameInspector.getByLabel("Frame-by-frame inspection status");
  await expect(frameStatus).toContainText("Frame 1 of 37 · 3.000s");
  await expect(button(page, "Previous Frame")).toBeDisabled();
  await expect(frameInspector.getByLabel("Inspected original Stage frame").locator("svg"))
    .toHaveCount(1);
  await button(page, "Next Frame").click();
  await expect(frameStatus).toContainText("Frame 2 of 37 · 3.042s");
  await expect(frameStatus).toContainText("Real interpolated Stage sample");
  await button(page, "Next Frame").click();
  await expect(frameStatus).toContainText("Frame 3 of 37 · 3.083s");
  await button(page, "Previous Frame").click();
  await expect(frameStatus).toContainText("Frame 2 of 37 · 3.042s");
  await button(page, "Last Frame").click();
  await expect(frameStatus).toContainText("Frame 37 of 37 · 4.500s");
  await expect(frameStatus).toContainText("Original saved keyframe");
  await expect(button(page, "Next Frame")).toBeDisabled();
  await button(page, "First Frame").click();
  await expect(frameStatus).toContainText("Frame 1 of 37 · 3.000s");

  // #169: compare real neighboring Stage samples, not generated keyframes
  // or a quality score, and keep the original inspector available.
  await button(page, "Compare Adjacent Frames").click();
  const adjacentFrames = frameInspector.getByLabel(
    "Adjacent original Stage frames comparison",
  );
  const previousFrame = adjacentFrames.getByRole("figure", {
    name: "Before adjacent original Stage frame",
  });
  const followingFrame = adjacentFrames.getByRole("figure", {
    name: "After adjacent original Stage frame",
  });
  await expect(adjacentFrames.locator("svg")).toHaveCount(2);
  await expect(previousFrame).toContainText("Before — Frame 1");
  await expect(previousFrame).toContainText("3.000s");
  await expect(followingFrame).toContainText("After — Frame 2");
  await expect(followingFrame).toContainText("3.042s");
  await button(page, "Next Frame").click();
  await expect(previousFrame).toContainText("Before — Frame 1");
  await expect(followingFrame).toContainText("After — Frame 2");
  await button(page, "Next Frame").click();
  await expect(previousFrame).toContainText("Before — Frame 2");
  await expect(followingFrame).toContainText("After — Frame 3");

  // #170: genuine Stage-resolved local joints at neighboring 24-fps frames,
  // with no edits to source animation, main clock or 20-minute export.
  await button(page, "Inspect Adjacent Joint Changes").click();
  const adjacentJoints = frameInspector.getByLabel(
    "Adjacent frame joint movement review",
  );
  const jointChangesTable = adjacentJoints.getByRole("table", {
    name: "Adjacent frame joint changes",
  });
  await expect(adjacentJoints).toContainText("3.042s and 3.083s");
  await expect(jointChangesTable).toBeVisible();
  await expect(jointChangesTable.locator("tbody tr").first()).toBeVisible();
  const jointBody = adjacentJoints.getByLabel("Adjacent joint body filter");
  await jointBody.selectOption("arms");
  await expect(jointBody).toHaveValue("arms");
  await jointBody.selectOption("legs");
  await expect(jointBody).toHaveValue("legs");
  await jointBody.selectOption("all");
  await expect(jointChangesTable).toBeVisible();

  // #181: sample the actual parented sole across the same saved movement.
  // Changing sides and moving adjacent frames updates measurements without
  // creating timeline keys or claiming a physics-grade contact result.
  await button(page, "Review Foot Travel").click();
  const footTravel = frameInspector.getByLabel("Foot travel review");
  const footSummary = footTravel.getByLabel("Foot travel summary");
  const footPair = footTravel.getByRole("status").filter({ hasText: /sole X/ });
  await expect(footSummary).toContainText("Right foot: 37 real Stage samples");
  await expect(footPair).toContainText("Frames 2 to 3");
  await expect(footPair).toContainText("estimated floor gap");
  const rightSole = await footPair.innerText();
  await footTravel.getByRole("combobox", { name: "Foot to review" }).selectOption("left");
  await expect(footSummary).toContainText("Left foot: 37 real Stage samples");
  await expect(footPair).not.toHaveText(rightSole);
  await button(page, "Next Frame").click();
  await expect(footPair).toContainText("Frames 3 to 4");
  await button(page, "Previous Frame").click();

  // #171: graph actual Stage-sampled local joint rotation across this
  // recorded step. Switching a part or selected frames never edits keys.
  await button(page, "Review Movement Curve").click();
  const movementCurve = frameInspector.getByLabel("Joint rotation curve review");
  const curveJoint = movementCurve.getByRole("combobox", {
    name: "Movement curve joint",
  });
  const curveSummary = movementCurve.getByLabel("Joint rotation curve summary");
  await expect(curveJoint).toBeVisible();
  await expect(movementCurve.getByRole("img", {
    name: /original local rotation from 3.000 to 4.500 seconds/,
  })).toBeVisible();
  await expect(curveSummary).toContainText("37 real Stage samples");
  await expect(movementCurve.getByText(/Selected frames 2 and 3/)).toBeVisible();
  await curveJoint.selectOption({ label: "left Arm" });
  await expect(curveSummary).toContainText("Left Arm: 37 real Stage samples");

  // #172: opt-in signed local angle speed between real adjacent Stage
  // samples; a timing inspection only, not animation smoothing or edits.
  await button(page, "Review Rotation Speed").click();
  const rateReview = movementCurve.getByLabel("Local joint rotation speed review");
  const rateSummary = rateReview.getByLabel("Rotation rate summary");
  await expect(rateReview.getByRole("img", {
    name: /Left Arm signed local rotation rate across 36 Stage intervals/,
  })).toBeVisible();
  await expect(rateSummary).toContainText("36 measured intervals");
  await expect(rateReview.getByText(/Frames 2 to 3/)).toBeVisible();

  // #173: find the largest genuine changes in local angular velocity,
  // navigate directly to the original adjacent Stage frames, never edit keys.
  await button(page, "Find Largest Rotation Changes").click();
  const rateChangeFinder = movementCurve.getByLabel("Rotation speed change finder");
  await expect(rateChangeFinder.getByLabel("Rotation change findings count"))
    .toContainText("35 measured rate changes");
  const rankedChanges = rateChangeFinder.getByRole("list", {
    name: "Largest local joint rotation rate changes",
  });
  await expect(rankedChanges.locator("li")).toHaveCount(5);

  // #174: a single tap shows the real before/middle/after Stage frames
  // around a measured rotation-rate change without writing keyframes.
  await rankedChanges.getByRole("button", {
    name: /Preview Three Frames at Frame/,
  }).first().click();
  const transition = rateChangeFinder.getByLabel("Original three-frame motion transition");
  const beforeTransition = transition.getByRole("figure", {
    name: "Before original transition frame",
  });
  const middleTransition = transition.getByRole("figure", {
    name: "Middle original transition frame",
  });
  const afterTransition = transition.getByRole("figure", {
    name: "After original transition frame",
  });
  await expect(transition.locator("figure")).toHaveCount(3);
  await expect(beforeTransition.locator("svg")).toHaveCount(1);
  await expect(middleTransition.locator("svg")).toHaveCount(1);
  await expect(afterTransition.locator("svg")).toHaveCount(1);
  await expect(beforeTransition).toContainText("Before — Frame");
  await expect(middleTransition).toContainText("Middle — Frame");
  await expect(afterTransition).toContainText("After — Frame");
  // Read the frame index from its own heading. Whole-figure textContent
  // joins "Frame 8" with the next timestamp "3.292s", yielding "Frame 83".
  const afterHeading = (await afterTransition.locator("figcaption strong").textContent()
    ?? "").trim();
  const afterMatch = afterHeading.match(/^After — Frame (\d+)$/);
  expect(afterMatch).not.toBeNull();
  if (!afterMatch) throw new Error("Missing original transition frame number");
  const afterFrameNumber = Number(afterMatch[1]);
  expect(afterFrameNumber).toBeGreaterThanOrEqual(1);
  expect(afterFrameNumber).toBeLessThanOrEqual(37);
  await button(page, "Review This Transition in Adjacent Frames").click();
  await expect(frameStatus).toContainText(`Frame ${afterFrameNumber} of 37`);
  await button(page, "Hide Three-Frame Preview").click();
  await expect(transition).toHaveCount(0);

  const jump = rankedChanges.getByRole("button", {
    name: /Review Frames/,
  }).first();
  const jumpLabel = (await jump.textContent() ?? "").replace(/\s+/g, "");
  const frames = jumpLabel.match(/ReviewFrames(\d+)–(\d+)/);
  expect(frames).not.toBeNull();
  if (!frames) throw new Error("Invalid original-frame jump label");
  await jump.click();
  await expect(frameStatus).toContainText(`Frame ${frames[2]} of 37`);
  await expect(rateReview.getByText(new RegExp(
    `Frames ${frames[1]} to ${frames[2]}`,
  ))).toBeVisible();
  await button(page, "Close Rotation Change Finder").click();
  await expect(rateChangeFinder).toHaveCount(0);
  await button(page, "Last Frame").click();
  await expect(rateReview.getByText(/Frames 36 to 37/)).toBeVisible();
  await curveJoint.selectOption({ label: "right Arm" });
  await expect(rateSummary).toContainText("Right Arm: 36 measured intervals");
  await button(page, "Close Rotation Speed").click();
  await expect(rateSummary).toHaveCount(0);
  await expect(movementCurve.getByText(/Selected frames 36 and 37/)).toBeVisible();
  await button(page, "Close Movement Curve").click();
  await expect(curveSummary).toHaveCount(0);
  await expect(adjacentJoints).toContainText("4.458s and 4.500s");
  await expect(previousFrame).toContainText("Before — Frame 36");
  await expect(followingFrame).toContainText("After — Frame 37");
  await expect(followingFrame).toContainText("4.500s");
  await button(page, "Show Single Frame").click();
  await expect(adjacentFrames).toHaveCount(0);
  await expect(frameInspector.getByLabel("Inspected original Stage frame").locator("svg"))
    .toHaveCount(1);
  await button(page, "Close Frame by Frame").click();
  await expect(frameInspector.getByLabel("Inspected original Stage frame"))
    .toHaveCount(0);
  await waveToRise.click();
  await expect(scrubber).toContainText("75% — 7.50s");
  await expect(middleFrame).toContainText("6.50s");
  await expect(page.getByLabel("Before pose", { exact: true })).toHaveValue("wave");
  await expect(page.getByLabel("After pose", { exact: true })).toHaveValue("rise");
  await riseToStand.click();
  await expect(page.getByLabel("Before pose", { exact: true })).toHaveValue("rise");
  await expect(page.getByLabel("After pose", { exact: true })).toHaveValue("standing");
  await expect(page.getByRole("group", { name: "Before pose preview" }))
    .toContainText("rising at 8.50 seconds");
  await expect(middleFrame).toContainText("9.25s");
  await expect(lastFrame).toContainText("10.00s");
  await expect(scrubber).toContainText("75% — 9.63s");
  await chooseScrub(100);
  await expect(scrubber).toContainText("100% — 10.00s");
  await expect(scrubber).toContainText("Original saved keyframe");
  await sitToWave.click();
  await expect(middleFrame).toContainText("3.75s");
  await button(page, "Close Three-Frame Filmstrip").click();
  await expect(filmstrip).toHaveCount(0);
  await button(page, "Close Motion Steps").click();

  // #162: inspect original named puppet-part angle changes without
  // modifying either saved frame or touching the main preview clock.
  await button(page, "Inspect Joint Differences").click();
  const changes = page.getByRole("table", { name: "Changed workshop joints" });
  await expect(changes).toContainText("Right Arm");
  // At the 4.50s review beat the forearm briefly matches its seated
  // angle; the inspector correctly omits unchanged joints here.
  await expect(changes).not.toContainText("Right Forearm");
  await expect(page.getByText(/articulated joints? differ/)).toBeVisible();

  // #163: filter the real joint differences by limb group and rank only
  // by absolute *rotation*, never confuse pixel offsets with degrees.
  const jointFilter = page.getByLabel("Joint body filter", { exact: true });
  const jointOrder = page.getByLabel("Joint listing order", { exact: true });
  await expect(jointFilter).toHaveValue("all");
  await jointFilter.selectOption("arms");
  await expect(changes).toContainText("Right Arm");
  await expect(changes).not.toContainText("Left Shin");
  await jointOrder.selectOption("rotation");
  await expect(changes.locator("tbody tr").first()).toContainText("Right Arm");
  await expect(changes.getByText("Largest rotation", { exact: true })).toHaveCount(1);
  await jointFilter.selectOption("legs");
  await expect(changes).toHaveCount(0);
  await expect(page.getByText("No changed joints in this body group. Choose another filter."))
    .toBeVisible();
  await jointFilter.selectOption("all");
  await expect(changes).toContainText("Right Arm");
  await page.getByLabel("After pose", { exact: true }).selectOption("seated");
  await expect(changes).toHaveCount(0);
  await expect(page.getByText("No joint angles or offsets differ beyond 0.1 between these frames."))
    .toBeVisible();
  await page.getByLabel("After pose", { exact: true }).selectOption("standing");
  await expect(changes).toContainText("Left Shin");
  await button(page, "Close Joint Differences").click();
  await shot(page, info, "chair-bench-side-by-side-compare");
  await button(page, "Close Pose Comparison").click();
  expect((await backup(page)).data.scenes[0].elements.find(item => item.id === actor.id)?.animation?.keyframes)
    .toEqual(standingAfterHello.animation!.keyframes);

  if (await editSceneTab.isVisible()) await editSceneTab.click();
  await button(page, "Undo edit").click();
  await saved(page);
  const backToWave = (await backup(page)).data.scenes[0];
  expect(backToWave.elements.find(item => item.id === actor.id)?.animation?.keyframes)
    .toEqual(wavingActor.animation!.keyframes);
  await button(page, "Undo edit").click();
  await saved(page);
  const backToBenchSit = (await backup(page)).data.scenes[0];
  expect(backToBenchSit.elements.find(item => item.id === actor.id)?.animation?.keyframes)
    .toEqual(onBenchActor.animation!.keyframes);
  await button(page, "Undo edit").click();
  await saved(page);
  expect((await backup(page)).data.scenes[0].elements
    .find(item => item.id === actor.id)?.animation).toBeUndefined();
});
