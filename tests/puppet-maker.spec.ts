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
  await waveToRise.click();
  await expect(page.getByLabel("Before pose", { exact: true })).toHaveValue("wave");
  await expect(page.getByLabel("After pose", { exact: true })).toHaveValue("rise");
  await riseToStand.click();
  await expect(page.getByLabel("Before pose", { exact: true })).toHaveValue("rise");
  await expect(page.getByLabel("After pose", { exact: true })).toHaveValue("standing");
  await expect(page.getByRole("group", { name: "Before pose preview" }))
    .toContainText("rising at 8.50 seconds");
  await sitToWave.click();
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
