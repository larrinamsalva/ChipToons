import { expect, test } from "@playwright/test";
import { backup } from "./production-helpers";
import { builtInSound } from "../src/sounds";
import { readFile } from "node:fs/promises";

const samples = [
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
] as const;
const png = (name: string, color: number) => ({
  name, mimeType: "image/png", buffer: Buffer.from(samples[color], "base64"),
});
async function prepare(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByText(/More ways to create.*3D/).click();
  const picker = page.getByRole("region", { name: "Import numbered PNG animation" });
  await picker.getByRole("checkbox", {
    name: "Build a multi-shot cartoon (2–3 numbered sequences)",
  }).check();
  await picker.getByLabel("Choose numbered PNG files").setInputFiles([
    png("shot02_frame_0002.png", 3), png("shot01_frame_0002.png", 1),
    png("shot02_frame_0001.png", 2), png("shot01_frame_0001.png", 0),
  ]);
  await picker.getByLabel("Animation playback speed").selectOption("2");
  return { picker, director: picker.getByRole("region", { name: "Shot Director" }) };
}

test("Creator explicitly imports edited storyboard captions into a new portable cartoon", async ({ page }) => {
  const { picker, director } = await prepare(page);
  const choice = director.getByRole("checkbox", {
    name: "Include drafted subtitles as editable captions in the NEW cartoon",
  });
  await expect(choice).not.toBeChecked();
  await expect(choice).toBeDisabled();
  await director.getByRole("textbox", { name: "Written narration for shot01_frame_" })
    .fill("Scout checks the wheel.");
  await director.getByRole("textbox", { name: "Written narration for shot02_frame_" })
    .fill("Original Jo narration.");
  await expect(choice).toBeEnabled();
  await director.getByRole("button", { name: "Move shot01_frame_ later" }).click();
  await director.getByLabel("Hold final frame of shot02_frame_").selectOption("1");
  const editor = director.getByRole("group", { name: "Subtitle cues for shot02_frame_" });
  await editor.getByRole("button", { name: "Customize subtitles for shot02_frame_" }).click();
  await editor.getByRole("textbox", { name: "First subtitle for shot02_frame_" })
    .fill("Jo checks.");
  await editor.getByRole("textbox", { name: "Second subtitle for shot02_frame_" })
    .fill("Jo explains the next step.");
  const timing = editor.getByRole("slider", { name: "Second subtitle timing for shot02_frame_" });
  await timing.focus();
  await timing.press("Home");
  for (let i = 0; i < 4; i++) await timing.press("ArrowRight");
  await expect(timing).toHaveValue("40");

  await choice.check();
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/new cartoon has editable draft captions/i)).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data } = await backup(page);
    expect(data.scenes.map(scene => scene.duration)).toEqual([3, 2]);
    expect(data.scenes.map(scene => scene.narration))
      .toEqual(["Original Jo narration.", "Scout checks the wheel."]);
    expect(data.captions.map(c => [c.sceneId, c.start, c.end, c.text])).toEqual([
      [data.scenes[0].id, 0, 1.2, "Jo checks."],
      [data.scenes[0].id, 1.2, 3, "Jo explains the next step."],
      [data.scenes[1].id, 0, 2, "Scout checks the wheel."],
    ]);
    expect(data.scenes.map(scene => scene.elements[0].frameSequence?.assetIds))
      .toEqual([
        data.assets.slice(0, 2).map(a => a.id),
        data.assets.slice(2).map(a => a.id),
      ]);
    expect(data.audioClips).toHaveLength(0);
  }
  // PR #69: the new actual caption tracks are visible in the regular
  // finishing workflow, without ever mistaking written text for audio.
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  const report = page.getByRole("region", {
    name: "Storyboard caption and voice timing review",
  });
  await expect(report).toBeVisible();
  await expect(report).toContainText("0/2 scenes with an assigned audible voice clip");
  await expect(report).toContainText("3 timed captions");
  await expect(report).toContainText("3 captions with no overlapping voice clip");
  // Guide is read-only; its recorder link opens the actual existing microphone UI.
  const guide = report.getByRole("region", { name: "Guided scene voice recording" });
  await guide.getByRole("button", { name: "Start guided voice recording" }).click();
  await expect(guide).toContainText("Original Jo narration.");
  await expect(guide).toContainText("Episode time: 0.00s–3.00s");
  await guide.getByRole("button", { name: "Next scene" }).click();
  await expect(guide).toContainText("Episode time: 3.00s–5.00s");
  await expect(guide).toContainText("Scout checks the wheel.");
  await guide.getByRole("button", { name: "Previous scene" }).click();
  await guide.getByRole("button", { name: "Record or upload this scene" }).click();
  const recorder = page.getByRole("dialog");
  await expect(recorder).toContainText("Scene 1 recording prompt");
  await expect(recorder).toContainText("Original Jo narration.");
  await expect(recorder.getByRole("button", { name: "Start microphone recording" }))
    .toBeVisible();
  await recorder.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  await expect(report.getByRole("list", {
    name: "Storyboard scene audio and caption review",
  }).locator(":scope > li")).toHaveCount(2);
  await expect(report).toContainText("Written narration has no assigned audible voice clip");
  await expect(report.getByRole("list", {
    name: "Caption cue coverage for scene 1",
  })).toContainText("Jo checks.");
  const downloadStarted = page.waitForEvent("download");
  await report.getByRole("button", {
    name: "Download recording to-do sheet (.txt)",
  }).click();
  const checklist = await downloadStarted;
  expect(checklist.suggestedFilename()).toContain("-recording-checklist.txt");
  const written = await readFile((await checklist.path())!, "utf8");
  expect(written).toContain("CHIPTOONS — RECORDING & CAPTION REVIEW CHECKLIST");
  expect(written).toContain("Scenes: 2 | Scenes with assigned voice intervals: 0");
  expect(written).toContain("Captions: 3 | Captions without overlapping assigned voice: 3");
  expect(written).toContain("SCENE 1");
  expect(written).toContain("Episode time: 0.00s to 3.00s");
  expect(written).toContain("CAPTION 0.00s–1.20s: Jo checks.");
  expect(written).toContain("CAPTION 1.20s–3.00s: Jo explains the next step.");
  expect(written).toContain("Episode time: 3.00s to 5.00s");
  expect(written).toContain("CAPTION 3.00s–5.00s: Scout checks the wheel.");
  expect(written).toContain("Record or assign actual narration/dialogue");
  await expect(report).toBeVisible();
  await report.getByRole("button", {
    name: "Review captions for scene 1",
  }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // PR #72: saved original on a narration lane, playable inside the guide.
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  await report.getByRole("button", { name: "Review voices for scene 1" }).click();
  const voice = page.getByRole("dialog");
  await voice.getByRole("combobox", { name: "New audio category" })
    .selectOption("narration");
  await voice.getByLabel("Upload audio file").setInputFiles({
    name: "sample-voice-lane-original.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(builtInSound("melody").dataUrl.split(",")[1], "base64"),
  });
  await voice.getByRole("button", { name: "Save audio clip" }).click();
  await expect(voice.getByRole("textbox", { name: "Audio clip name" }))
    .toHaveValue("sample-voice-lane-original");
  await voice.getByRole("button", { name: "Back to cartoon" }).click();
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  const listenGuide = page.getByRole("region", { name: "Guided scene voice recording" });
  await listenGuide.getByRole("button", { name: "Start guided voice recording" }).click();
  const source = listenGuide.getByRole("region", { name: "Recorded scene voice listen-back" });
  await expect(source).toContainText("sample-voice-lane-original");
  await expect(source).toContainText("Source trim:");
  // The first voice clip's scene interval covers both scene-one captions,
  // but leaves all of scene two's captions without time-window coverage.
  const coverageFirst = page.getByRole("list", {
    name: "Caption cue coverage for scene 1",
  });
  const coverageSecond = page.getByRole("list", {
    name: "Caption cue coverage for scene 2",
  });
  await expect(coverageFirst).toContainText("100% of cue interval overlaps voice");
  await expect(coverageSecond).toContainText("0% of cue interval overlaps voice");
  const player = source.getByLabel("Original audio source", { exact: true });
  await player.evaluate((el: HTMLAudioElement) => el.play());
  await expect.poll(() =>
    player.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.05);
  await player.evaluate((el: HTMLAudioElement) => el.pause());
  // PR #74 hands off to the real scene player, with the existing timeline mix.
  // No automatic playback or microphone request occurs.
  await listenGuide.getByRole("button", {
    name: "Open this scene with picture and mixed sound",
  }).click();
  const preview = page.getByRole("region", { name: "Cartoon preview" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("combobox", { name: "Preview scope" }))
    .toHaveValue("scene");
  await expect(preview.getByRole("checkbox", { name: "Sound" })).toBeChecked();
  await expect(preview).toContainText("SCENE 1 OF 2");
  await expect(preview.getByRole("button", { name: "Play cartoon" }))
    .toBeVisible();
  // Use the real animation-and-sound player, not a fake source-only playback.
  await preview.getByRole("button", { name: "Play cartoon" }).click();
  await expect(preview).toContainText("Playing your story");
  await preview.getByRole("button", { name: "Pause cartoon" }).click();
  // PR #75: the shortcut preselects the real verified range exporter
  // for an individual PNG scene; no export starts on the navigation click.
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  const exportGuide = page.getByRole("region", {
    name: "Guided scene voice recording",
  });
  await exportGuide.getByRole("button", { name: "Start guided voice recording" }).click();
  await exportGuide.getByRole("button", { name: "Next scene" }).click();
  await exportGuide.getByRole("button", {
    name: "Prepare a real WebM clip for this scene",
  }).click();
  const segment = page.getByRole("region", { name: "Scene segment exports" });
  await expect(segment.getByRole("combobox", { name: "Export first scene" }))
    .toHaveValue("1");
  await expect(segment.getByRole("combobox", { name: "Export last scene" }))
    .toHaveValue("1");
  await expect(segment).toContainText("Selected scenes: 0:02");
  await expect(segment.getByRole("button", { name: "Export selected scene range" }))
    .toBeVisible();
  // A second selection updates the real export range rather than duplicating a renderer.
  await exportGuide.getByRole("button", { name: "Previous scene" }).click();
  await exportGuide.getByRole("button", {
    name: "Prepare a real WebM clip for this scene",
  }).click();
  await expect(segment.getByRole("combobox", { name: "Export first scene" }))
    .toHaveValue("0");
  await expect(segment.getByRole("combobox", { name: "Export last scene" }))
    .toHaveValue("0");
  // PR #76: a real editable cinematic camera push, not an artificial
  // preview-only effect, with user review before an explicit Apply.
  await exportGuide.getByRole("button", {
    name: "Give this scene a gentle cinematic push-in",
  }).click();
  const cameraDirector = page.getByRole("dialog", { name: "Direct My Cartoon Camera" });
  await expect(cameraDirector.getByRole("combobox", { name: "Shot style" }))
    .toHaveValue("move");
  await expect(cameraDirector.getByText(/camera eases from wide to 1.35×/))
    .toBeVisible();
  await expect(cameraDirector.getByRole("button", { name: "Apply" })).toBeDisabled();
  await cameraDirector.getByRole("button", { name: "Preview Shot" }).click();
  await expect(cameraDirector.getByRole("region", { name: "Proposed scene preview" }))
    .toBeVisible();
  await cameraDirector.getByRole("button", { name: "Apply" }).click();
  await expect(director).toBeHidden();
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data: approved } = await backup(page);
    expect(approved.scenes[0].cameraShots?.[0]).toMatchObject({
      style: "move", start: 0, end: 3, move: 3,
      frame: { x: 400, y: 225, zoom: 1.35 }, targets: [],
    });
    expect(approved.scenes[0].elements[0].frameSequence?.assetIds)
      .toHaveLength(2);
    expect(approved.scenes[1].cameraShots).toBeUndefined();
  }
  // PR #77: Try a different actual moving camera on the other untouched
  // imported PNG scene. Switch left/right and review before applying.
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  const panGuide = page.getByRole("region", { name: "Guided scene voice recording" });
  await panGuide.getByRole("button", { name: "Start guided voice recording" }).click();
  await panGuide.getByRole("button", { name: "Next scene" }).click();
  await panGuide.getByRole("button", { name: "Try a gentle cinematic side-pan" }).click();
  const panDirector = page.getByRole("dialog", { name: "Direct My Cartoon Camera" });
  await expect(panDirector.getByRole("combobox", { name: "Shot style" }))
    .toHaveValue("move");
  await expect(panDirector.getByRole("combobox", { name: "Gentle pan direction" }))
    .toHaveValue("left");
  await panDirector.getByRole("combobox", { name: "Gentle pan direction" })
    .selectOption("right");
  await expect(panDirector.getByRole("button", { name: "Apply" })).toBeDisabled();
  await panDirector.getByRole("button", { name: "Preview Full Sequence" }).click();
  await expect(panDirector.getByRole("region", { name: "Proposed scene preview" }))
    .toBeVisible();
  await panDirector.getByRole("button", { name: "Apply" }).click();
  await expect(panDirector).toBeHidden();
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data: approvedPan } = await backup(page);
    expect(approvedPan.scenes[1].cameraShots?.[0]).toMatchObject({
      style: "move", start: 0, end: 2, move: 2,
      frame: { x: 455, y: 225, zoom: 1.25 }, targets: [],
    });
    expect(approvedPan.scenes[0].cameraShots?.[0].frame.zoom).toBe(1.35);
    expect(approvedPan.scenes[1].elements[0].frameSequence?.assetIds)
      .toHaveLength(2);
  }
});

test("Caption import remains off by default and rejects overlong text before creating a project", async ({ page }) => {
  const { picker, director } = await prepare(page);
  const first = director.getByRole("textbox", { name: "Written narration for shot01_frame_" });
  const choice = director.getByRole("checkbox", {
    name: "Include drafted subtitles as editable captions in the NEW cartoon",
  });
  await first.fill("This will stay written narration only.");
  await expect(choice).not.toBeChecked();
  await choice.check();
  await first.fill("x".repeat(281));
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(picker.getByRole("alert")).toContainText("280 characters");
  await expect(page.locator(".editor")).toHaveCount(0);
  // Opt-out still accepts the unchanged PR #64 narrative import, without
  // injecting or truncating any caption.
  await choice.uncheck();
  await picker.getByRole("button", { name: "Create multi-shot cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    const { data } = await backup(page);
    expect(data.captions).toEqual([]);
    expect(data.scenes[0].narration).toHaveLength(281);
  }
});


test("Cinematic pull-back reveals actual original PNG frames only after Apply", async ({ page }) => {
  const {picker}=await prepare(page);
  await picker.getByRole("button",{name:"Create multi-shot cartoon"}).click();
  await expect(page.locator(".editor")).toBeVisible({timeout:30_000});
  await page.getByRole("button",{name:"Finish My Cartoon",exact:true}).click();
  const guide=page.getByRole("region",{name:"Guided scene voice recording"});
  await guide.getByRole("button",{name:"Start guided voice recording"}).click();
  await guide.getByRole("button",{name:"Try a cinematic pull-back reveal"}).click();
  const camera=page.getByRole("dialog",{name:"Direct My Cartoon Camera"});
  await expect(camera.getByRole("combobox",{name:"Shot style"})).toHaveValue("move");
  await expect(camera.getByRole("combobox",{name:"Reveal starting focus"}))
    .toHaveValue("center");
  await camera.getByRole("combobox",{name:"Reveal starting focus"})
    .selectOption("right");
  const startingZoom = camera.getByRole("spinbutton",{name:"Reveal starting zoom"});
  await startingZoom.fill("1.65");
  await startingZoom.press("Tab");
  await expect(startingZoom).toHaveValue("1.65");
  await expect(camera.getByRole("button",{name:"Apply"})).toBeDisabled();
  await camera.getByRole("button",{name:"Preview Full Sequence"}).click();
  await expect(camera.getByRole("region",{name:"Proposed scene preview"})).toBeVisible();
  // PR #80: inspect three actual times in the same Stage used by export.
  const contact = camera.getByRole("region",{name:"Camera motion contact sheet"});
  await expect(contact).toHaveCount(0);
  await camera.getByRole("checkbox",{name:"Show beginning, middle and end frames"}).check();
  await expect(contact.getByRole("figure")).toHaveCount(3);
  const startFrame=contact.getByRole("figure",{name:"Beginning frame"});
  const midFrame=contact.getByRole("figure",{name:"Middle frame"});
  const endFrame=contact.getByRole("figure",{name:"End frame"});
  await expect(startFrame.locator("[data-camera-transform]"))
    .toHaveAttribute("data-camera-zoom","1.65");
  const midwayZoom=Number(await midFrame.locator("[data-camera-transform]")
    .getAttribute("data-camera-zoom"));
  const endZoom=Number(await endFrame.locator("[data-camera-transform]")
    .getAttribute("data-camera-zoom"));
  expect(midwayZoom).toBeGreaterThan(1);
  expect(midwayZoom).toBeLessThan(1.65);
  expect(endZoom).toBeGreaterThanOrEqual(1);
  expect(endZoom).toBeLessThan(1.01);
  await camera.getByRole("checkbox",{name:"Compare with the saved camera"}).check();
  await expect(startFrame.locator("[data-camera-transform]"))
    .not.toHaveAttribute("data-camera-shot",/.+/);
  await camera.getByRole("checkbox",{name:"Compare with the saved camera"}).uncheck();
  await expect(startFrame.locator("[data-camera-transform]"))
    .toHaveAttribute("data-camera-shot",/.+/);
  await camera.getByRole("button",{name:"Apply"}).click();
  await expect(camera).toBeHidden();
  if ((page.viewportSize()?.width??0)>=1200){
    const {data}=await backup(page);
    expect(data.scenes[0].cameraShots?.[0]).toMatchObject({
      style:"move",start:0,end:2,move:2,
      fromFrame:{y:225,zoom:1.65},
      frame:{x:400,y:225,zoom:1},targets:[],
    });
    expect(data.scenes[0].cameraShots?.[0].fromFrame?.x).toBeGreaterThan(400);
    expect(data.scenes[1].cameraShots).toBeUndefined();
    expect(data.scenes[0].elements[0].frameSequence?.assetIds).toHaveLength(2);
  }
});


test("Cinematic vertical tilt previews and applies genuine original PNG frames safely", async ({ page }) => {
  const {picker}=await prepare(page);
  await picker.getByRole("button",{name:"Create multi-shot cartoon"}).click();
  await expect(page.locator(".editor")).toBeVisible({timeout:30_000});
  await page.getByRole("button",{name:"Finish My Cartoon",exact:true}).click();
  const guide=page.getByRole("region",{name:"Guided scene voice recording"});
  await guide.getByRole("button",{name:"Start guided voice recording"}).click();
  await guide.getByRole("button",{name:"Try a gentle cinematic vertical tilt"}).click();
  const director=page.getByRole("dialog",{name:"Direct My Cartoon Camera"});
  await expect(director.getByRole("combobox",{name:"Shot style"})).toHaveValue("move");
  const direction=director.getByRole("combobox",{name:"Gentle tilt direction"});
  await expect(direction).toHaveValue("up");
  await direction.selectOption("down");
  await expect(director.getByRole("button",{name:"Apply"})).toBeDisabled();
  await director.getByRole("button",{name:"Preview Full Sequence"}).click();
  const preview=director.getByRole("region",{name:"Proposed scene preview"});
  await expect(preview).toBeVisible();
  await director.getByRole("checkbox",{name:"Show beginning, middle and end frames"}).check();
  const frames=director.getByRole("region",{name:"Camera motion contact sheet"});
  await expect(frames.getByRole("figure")).toHaveCount(3);
  await expect(frames.getByRole("region",{name:"Full camera move safety scan"}))
    .toContainText("no canvas overrun found at 21 sampled moments");
  const end=frames.getByRole("figure",{name:"End frame"});
  const zoom=Number(await end.locator("[data-camera-transform]").getAttribute("data-camera-zoom"));
  expect(zoom).toBeGreaterThan(1.249);
  await director.getByRole("button",{name:"Apply"}).click();
  await expect(director).toBeHidden();
  if ((page.viewportSize()?.width??0)>=1200) {
    const {data}=await backup(page);
    expect(data.scenes[0].cameraShots?.[0]).toMatchObject({
      style:"move",start:0,end:2,move:2,
      frame:{x:400,y:260,zoom:1.25},targets:[],follow:false,
    });
    expect(data.scenes[1].cameraShots).toBeUndefined();
    expect(data.scenes[0].elements[0].frameSequence?.assetIds).toHaveLength(2);
  }
});


test("Diagonal cinematic glide previews and applies original PNGs only after approval", async ({ page }) => {
  const {picker}=await prepare(page);
  await picker.getByRole("button",{name:"Create multi-shot cartoon"}).click();
  await expect(page.locator(".editor")).toBeVisible({timeout:30_000});
  await page.getByRole("button",{name:"Finish My Cartoon",exact:true}).click();
  const guide=page.getByRole("region",{name:"Guided scene voice recording"});
  await guide.getByRole("button",{name:"Start guided voice recording"}).click();
  await guide.getByRole("button",{name:"Try a gentle diagonal cinematic glide"}).click();
  const camera=page.getByRole("dialog",{name:"Direct My Cartoon Camera"});
  await expect(camera.getByRole("combobox",{name:"Shot style"})).toHaveValue("move");
  const direction=camera.getByRole("combobox",{name:"Diagonal glide direction"});
  await expect(direction).toHaveValue("up-left");
  await direction.selectOption("down-right");
  const intensity=camera.getByRole("combobox",{name:"Diagonal glide intensity"});
  await expect(intensity).toHaveValue("balanced");
  await intensity.selectOption("expressive");
  const pacing=camera.getByRole("combobox",{name:"Diagonal glide pacing"});
  await expect(pacing).toHaveValue("continuous");
  await pacing.selectOption("settle-early");
  await expect(camera.getByRole("spinbutton",{name:"Move duration (seconds)"}))
    .toHaveValue("1.5");
  await expect(direction).toHaveValue("down-right");
  // Changing direction retains the selected intensity.
  await direction.selectOption("up-right");
  await expect(intensity).toHaveValue("expressive");
  await direction.selectOption("down-right");
  await expect(pacing).toHaveValue("settle-early");
  await expect(camera.getByRole("button",{name:"Apply"})).toBeDisabled();
  await camera.getByRole("button",{name:"Preview Full Sequence"}).click();
  const preview=camera.getByRole("region",{name:"Proposed scene preview"});
  await expect(preview).toBeVisible();
  // PR #89: verify the real move/hold boundary and live seek.
  const settleGuide=preview.getByRole("group",{name:"Camera move timing guide"});
  await expect(settleGuide).toContainText("1.50s");
  await expect(settleGuide).toContainText("holds for 0.50s");
  await settleGuide.getByRole("button",{name:"Jump to camera move finish"}).click();
  await expect(preview.getByRole("spinbutton",{name:"Preview time (seconds)"}))
    .toHaveValue("1.5");
  await expect(settleGuide).toContainText("final camera view is held");
  await camera.getByRole("checkbox",{name:"Show beginning, middle and end frames"}).check();
  // PR #90: two real Stage views at camera settle and shot end,
  // without changing the number of existing three-frame contact pictures.
  const holdReview=camera.getByText("Review final-view hold frames (0.50s)");
  await expect(holdReview).toBeVisible();
  await holdReview.click();
  const holdFrames=camera.getByRole("group",{name:"Camera hold frame review"});
  await expect(holdFrames.getByRole("figure")).toHaveCount(2);
  const settled=holdFrames.getByRole("figure",{name:"Camera settles frame"});
  const lastHeld=holdFrames.getByRole("figure",{name:"Near shot end frame"});
  await expect(settled).toContainText("1.50s into scene");
  await expect(lastHeld).toContainText("2.00s into scene");
  await expect(settled.locator("[data-camera-transform]")).toHaveAttribute("data-camera-zoom","1.4");
  await expect(lastHeld.locator("[data-camera-transform]")).toHaveAttribute("data-camera-zoom","1.4");
  await settled.getByRole("button",{name:"Inspect camera settles in preview"}).click();
  await expect(camera.getByRole("region",{name:"Proposed scene preview"})
    .getByRole("spinbutton",{name:"Preview time (seconds)"})).toHaveValue("1.5");
  const contact=camera.getByRole("region",{name:"Camera motion contact sheet"});
  await expect(contact.getByRole("figure")).toHaveCount(3);
  await expect(contact.getByRole("region",{name:"Full camera move safety scan"}))
    .toContainText("no canvas overrun found at 21 sampled moments");
  const halfway=contact.getByRole("figure",{name:"Middle frame"});
  const zoom=Number(await halfway.locator("[data-camera-transform]").getAttribute("data-camera-zoom"));
  expect(zoom).toBeGreaterThan(1);
  expect(zoom).toBeLessThan(1.4);
  const last=contact.getByRole("figure",{name:"End frame"});
  expect(Number(await last.locator("[data-camera-transform]").getAttribute("data-camera-zoom")))
    .toBeGreaterThan(1.399);
  // The compare toggle replaces proposal with saved wide view in the actual Stage.
  await camera.getByRole("checkbox",{name:"Compare with the saved camera"}).check();
  await expect(halfway.locator("[data-camera-transform]"))
    .not.toHaveAttribute("data-camera-shot",/.+/);
  await expect(settleGuide).toHaveCount(0);
  await expect(camera.getByText("Review final-view hold frames (0.50s)")).toHaveCount(0);
  await camera.getByRole("checkbox",{name:"Compare with the saved camera"}).uncheck();
  await expect(settleGuide).toBeVisible();
  await expect(halfway.locator("[data-camera-transform]"))
    .toHaveAttribute("data-camera-shot",/.+/);
  await camera.getByRole("button",{name:"Apply"}).click();
  await expect(camera).toBeHidden();
  if ((page.viewportSize()?.width??0)>=1200) {
    const {data}=await backup(page);
    expect(data.scenes[0].cameraShots?.[0]).toMatchObject({
      style:"move",start:0,end:2,move:1.5,
      frame:{x:480,y:270,zoom:1.4},targets:[],follow:false,
    });
    expect(data.scenes[1].cameraShots).toBeUndefined();
    expect(data.scenes[0].elements[0].frameSequence?.assetIds).toHaveLength(2);
  }
});
