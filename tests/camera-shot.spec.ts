import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { cameraShotDemo } from "../src/camera-shot-demo";
import { builtInSound } from "../src/sounds";
import { newAudioClip } from "../src/production";
import { SHOT_TITLE, shotCueTime } from "../src/camera-shots";
import { shotAnchorKey } from "../src/shot-director";
import { backup, number, restore, saved } from "./production-helpers";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: SHOT_TITLE });

async function open(page: Page) {
  await expect(page.locator(".editor")).toBeVisible();
  const tab = button(page, "Edit scene");
  if (await tab.isVisible()) await tab.click();
  await button(page, SHOT_TITLE).click();
  return dialog(page);
}
async function apply(page: Page) {
  await dialog(page).getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog(page)).toBeHidden();
}

test("reviews the existing camera, applies and undoes a shot, and reopens it with the original tracks", async ({ page }, info) => {
  test.setTimeout(85_000);
  const project = cameraShotDemo();
  const scene = project.scenes[0];
  project.scenes = project.scenes.map(item => ({ ...item, cameraShots: undefined }));
  await restore(page, project);
  if (info.project.name === "phone") await button(page, "Switch to dark theme").click();
  let form = await open(page);
  await form.getByRole("combobox", { name: "Shot style" }).selectOption("pair");
  await number(page, "Shot start (seconds)", "1.20");
  const review = form.getByRole("button", { name: "Preview Shot", exact: true });
  await review.press("Enter");
  const preview = form.getByRole("region", { name: "Proposed scene preview" });
  const proposed = preview.locator("g[data-camera-transform]");
  await expect(proposed).toHaveAttribute("data-camera-zoom", "1.6");
  await expect(preview.locator("[data-shot-guides]")).toBeVisible();
  // PR #83: the live camera preview scrubs actual animation frames without applying.
  const scrub=preview.getByRole("slider",{name:"Camera motion scrubber"});
  await expect(scrub).toBeVisible();
  const liveMeter=preview.getByRole("group",{name:"Live camera framing meter"});
  await expect(liveMeter).toBeVisible();
  await expect(liveMeter).toContainText("Live camera zoom:");
  await expect(liveMeter).toContainText("1.60×");
  await scrub.focus();
  await scrub.press("Home");
  await expect(preview.getByRole("spinbutton",{name:"Preview time (seconds)"})).toHaveValue("1.2");
  await scrub.press("End");
  expect(Number(await preview.getByRole("spinbutton",{name:"Preview time (seconds)"}).inputValue()))
    .toBeGreaterThan(3.15);
  await expect(liveMeter).toContainText("Live camera zoom:");
  await form.getByRole("checkbox", {
    name: "Show beginning, middle and end frames",
  }).check();
  const contact = form.getByRole("region", { name: "Camera motion contact sheet" });
  await expect(contact.getByRole("figure")).toHaveCount(3);
  await expect(contact.getByRole("figure", { name: "Beginning frame" })
    .locator("[data-camera-transform]")).toHaveAttribute("data-camera-zoom", "1.6");
  // PR #81: the quality check samples actual Stage camera geometry.
  // It is advisory and does not interfere with manual editing/review.
  await expect(contact.getByRole("status")).toContainText("Artwork-edge check:");
  const moveScan=contact.getByRole("region",{name:"Full camera move safety scan"});
  await expect(moveScan).toContainText("Full-move scan:");
  await expect(moveScan).toContainText("21 sampled moments");
  await expect(preview.getByRole("group",{name:"Camera motion scrubber controls"}))
    .toBeVisible();
  await expect(contact.getByText(/canvas-boundary scan, not a pixel-level test/))
    .toBeVisible();
  await expect(form.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
  const compare = form.getByRole("checkbox", { name: "Compare with the saved camera" });
  await compare.check();
  await expect(proposed).not.toHaveAttribute("data-camera-shot", /.+/);
  await compare.uncheck();
  await expect(proposed).toHaveAttribute("data-camera-shot", /.+/);
  const size = await form.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
  expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await form.getByRole("checkbox", { name: "Use this shot over the camera track during its time" }).check();
  await preview.scrollIntoViewIfNeeded();
  const screenshot = info.outputPath("camera-shot-review.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await info.attach("reviewed two-character shot", { path: screenshot, contentType: "image/png" });
  await apply(page);

  const result = (await backup(page)).data;
  expect(result.scenes[0].cameraAnimation).toEqual(scene.cameraAnimation);
  expect(result.scenes[0].elements).toEqual(scene.elements);
  expect(result.audioClips).toEqual(project.audioClips);
  expect(result.captions).toEqual(project.captions);
  expect(result.scenes[0].cameraShots?.[0]).toMatchObject({ style: "pair", start: 1.2, end: 3.2, overlays: true });
  await button(page, "Undo edit").click();
  expect((await backup(page)).data.scenes[0].cameraShots).toBeUndefined();
  await button(page, "Redo edit").click();
  await saved(page);
  await page.reload();
  await button(page, `Continue ${project.title}`).click();
  await expect(page.locator(".editor")).toBeVisible();
  const stageTab = button(page, "Preview");
  if (await stageTab.isVisible()) await stageTab.click();
  await page.getByRole("button", { name: /Edit camera shot: Two-Character Shot/ }).click();
  form = dialog(page);
  await expect(form.getByRole("combobox", { name: "Shot style" })).toHaveValue("pair");
  await expect(form.getByRole("spinbutton", { name: "Shot start (seconds)" })).toHaveValue("1.2");
});

test("previews an event-linked detail, rejects overlap, moves and duplicates shots, and cancels edits", async ({ page }) => {
  test.setTimeout(80_000);
  const project = cameraShotDemo();
  const [scene] = project.scenes;
  const wagon = scene.elements.find(item => item.prop === "toy-wagon")!;
  const event = scene.participation![0];
  const [wide] = scene.cameraShots!;
  scene.cameraShots = [wide];
  await restore(page, project);
  const form = await open(page);
  await form.getByRole("combobox", { name: "Shot style" }).selectOption("detail");
  await form.getByRole("combobox", { name: "Featured subject" }).selectOption(wagon.id);
  await form.getByRole("checkbox", { name: "Follow the subject during the shot" }).check();
  await number(page, "Shot start (seconds)", "0.50");
  await expect(form.getByText(/Camera shots cannot overlap/)).toBeVisible();
  await expect(form.getByRole("button", { name: "Preview Shot", exact: true })).toBeDisabled();
  await form.getByText("Connect to a script line or learning moment", { exact: true }).click();
  const anchor = { kind: "participation", id: event.id, moment: "reveal" } as const;
  await form.getByRole("combobox", { name: "Learning or animation event" }).selectOption(shotAnchorKey(anchor));
  await form.getByRole("button", { name: "Use this event’s start time" }).click();
  await expect(form.getByRole("spinbutton", { name: "Shot start (seconds)" })).toHaveValue("7.65");
  await form.getByRole("button", { name: "Move Shot Earlier", exact: true }).press("Enter");
  await expect(form.getByRole("spinbutton", { name: "Shot start (seconds)" })).toHaveValue("7.4");
  await form.getByRole("button", { name: "Move Shot Later", exact: true }).press("Enter");
  await form.getByRole("checkbox", { name: "Use this shot over the camera track during its time" }).check();
  await form.getByRole("button", { name: "Preview Full Sequence", exact: true }).press("Enter");
  const preview = form.getByRole("region", { name: "Proposed scene preview" });
  await preview.getByRole("spinbutton", { name: "Preview time (seconds)" }).fill("8.5");
  await expect(preview.locator(`[data-element-id="${wagon.id}"]`)).toHaveAttribute("data-held-by", /.+/);
  await apply(page);
  const savedShot = (await backup(page)).data.scenes[0].cameraShots?.[1];
  expect(savedShot).toMatchObject({ style: "detail", targets: [wagon.id], follow: true, start: 7.65,
    cue: { anchor, reviewedAt: shotCueTime(scene, anchor) } });

  await open(page);
  await form.getByRole("button", { name: /2\. Detail Shot/ }).click();
  await form.getByRole("button", { name: "Duplicate Shot", exact: true }).click();
  await form.getByRole("button", { name: "Preview Shot", exact: true }).click();
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await backup(page)).data.scenes[0].cameraShots).toEqual([wide, savedShot]);
});


test("jumps from camera coverage findings to the unsaved full-sequence preview without editing the scene", async ({ page }) => {
  test.setTimeout(80_000);
  const project = cameraShotDemo();
  const scene = project.scenes[0];
  // Two existing, creator-authored shots with a real default-camera gap.
  scene.cameraShots = [scene.cameraShots![0], scene.cameraShots![4]];
  const source = builtInSound("melody");
  project.audioAssets.push(source);
  const voice = newAudioClip(project, source, "dialogue", 0, 2.2);
  project.audioClips.push({ ...voice, duration: 1, volume: 1 });
  await restore(page, project);
  const original = (await backup(page)).data;
  const form = await open(page);
  await form.getByRole("button", { name: /1\. Wide Shot/ }).click();
  const coverage = form.getByRole("group", { name: "Camera coverage review" });
  await coverage.locator("summary").click();
  await expect(coverage).toContainText("Default camera 1.20–3.50s");
  await expect(coverage).toContainText("Voice 1 (dialogue) at 2.20s");
  await coverage.getByRole("button", {
    name: "Inspect default camera interval 1 at 2.35 seconds",
  }).click();
  let preview = form.getByRole("region", { name: "Proposed scene preview" });
  await expect(preview.getByRole("spinbutton", { name: "Preview time (seconds)" }))
    .toHaveValue("2.35");
  await expect(coverage.getByRole("status")).toContainText("2.35s");
  await coverage.getByRole("button", {
    name: "Inspect recorded voice 1 at 2.20 seconds",
  }).click();
  preview = form.getByRole("region", { name: "Proposed scene preview" });
  await expect(preview.getByRole("spinbutton", { name: "Preview time (seconds)" }))
    .toHaveValue("2.2");
  await expect(coverage.getByRole("status")).toContainText("2.20s");
  expect((await backup(page)).data).toEqual(original);
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await backup(page)).data).toEqual(original);
});
