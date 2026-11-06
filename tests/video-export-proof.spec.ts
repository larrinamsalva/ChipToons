import { storyCardDemo } from "../src/story-card-demo";
import { cameraShotDemo } from "../src/camera-shot-demo";
import { GARDEN_NARRATION_START, gardenSoundDemo } from "../src/sound-garden-demo";
import { wateringWindow } from "../src/interaction-model";
import { participationExample } from "../src/participation-examples";
import { participationWindow } from "../src/participation-model";
import { visualTeachingExample } from "../src/focus-examples";
import { focusAnchor, projectFocusPoint } from "../src/focus-motion";
import { transformExample } from "../src/transform-examples";
import { EXAMPLE_NAMES } from "../src/transform-model";
import { gardenInteractionDemo } from "../src/garden-demo";
import { stagePoint } from "../src/interaction-motion";
import { kindHeartsCrew } from "../src/series-starter";
import { episodeBrief } from "../src/series";
import { sunnyCartoon } from "../src/puppet-project";
import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { applyDirections, createAssistantDraft, PLAYGROUND_BRIEF } from "../src/assistant";
import { starterProject } from "../src/demo-starter";
import { movieProofArtwork, segmentedProject } from "./creator-fixtures";
import { downloadAndVerifyMovie } from "./single-movie-proof";
import { backup } from "./production-helpers";
import { cameraAt, duplicateAnimatedScene, elementAt, retimeScene, sceneElementAt, sceneFramesAt, stageCameraAt } from "../src/timeline";
import { emptyProduction } from "../src/media-model";
import { builtInSound } from "../src/sounds";
import { EXPORT_RECORDING_LEAD_SECONDS } from "../src/segments";
import { newAudioClip } from "../src/production";
import { imageLibraryItem, placeLibraryItem } from "../src/library";
import { starterLocations } from "../src/world-starters";
import { makeScene, uid } from "../src/model";
import { demo, openLittleFixersOpening, restore } from "./production-helpers";

async function render(
  page: Page,
  info: TestInfo,
  name: string,
  seconds: number,
  options: {
    width?: 800 | 1280;
    fps?: 15 | 24;
    codec?: "vp8" | "vp9";
    audio?: boolean;
    captions?: boolean;
    silent?: boolean;
    segment?: number;
    limit?: number;
  } = {},
) {
  const width = options.width ?? 800,
    height = (width * 450) / 800;
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  if (options.limit) {
    const limit = page.getByRole("spinbutton", {
      name: "Maximum seconds per segment",
      exact: true,
    });
    await limit.fill(String(options.limit));
    await limit.press("Enter");
  }
  if (options.width)
    await page
      .getByLabel("Video export resolution")
      .selectOption(String(width));
  if (options.fps)
    await page
      .getByLabel("Video export frame rate")
      .selectOption(String(options.fps));
  if (options.codec)
    await page
      .getByLabel("Video export format")
      .selectOption(`video/webm;codecs=${options.codec},opus`);
  if (options.audio === false)
    await page
      .getByRole("checkbox", { name: "Include mixed audio", exact: true })
      .uncheck();
  if (options.captions === false)
    await page
      .getByRole("checkbox", { name: "Include timed captions", exact: true })
      .uncheck();
  await page
    .getByRole("button", {
      name: options.segment
        ? `Export segment ${options.segment}`
        : "Export complete cartoon",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: options.segment
        ? `Segment ${options.segment} is ready`
        : "Your movie is ready",
      exact: true,
    }),
  ).toBeVisible({ timeout: (seconds + 35) * 1000 });
  const video = page.getByLabel(
    options.segment ? "Completed segment video" : "Completed cartoon video",
  );
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(2);
  expect(
    await video.evaluate((el: HTMLVideoElement) => ({
      width: el.videoWidth,
      height: el.videoHeight,
      finite: Number.isFinite(el.duration),
    })),
  ).toEqual({ width, height, finite: true });
  await video.evaluate((el: HTMLVideoElement) => {
    el.muted = true;
    return el.play();
  });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.15);
  await video.evaluate((el: HTMLVideoElement) => {
    el.pause();
    el.currentTime = 1.1;
  });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeCloseTo(1.1, 1);
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: options.segment
        ? `Download segment ${options.segment}`
        : "Download completed video",
      exact: true,
    })
    .click();
  const movie = await pending,
    path = info.outputPath(`${name}.webm`);
  await movie.saveAs(path);
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-count_frames",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        path,
      ],
      { encoding: "utf8" },
    ),
  );
  const picture = probe.streams.find(
      (s: { codec_type: string }) => s.codec_type === "video",
    ),
    audio = probe.streams.find(
      (s: { codec_type: string }) => s.codec_type === "audio",
    );
  expect(picture).toMatchObject({
    codec_name: options.codec ?? "vp8",
    width,
    height,
  });
  expect(Number(picture.nb_read_frames)).toBeGreaterThan(
    seconds * (options.fps === 24 ? 16 : 8),
  );
  if (options.audio === false) expect(audio).toBeUndefined();
  else expect(audio).toMatchObject({ codec_name: "opus" });
  expect(Number(probe.format.duration)).toBeGreaterThanOrEqual(seconds - 0.1);
  expect(Number(probe.format.duration)).toBeLessThan(seconds + 1);
  const pcm =
    options.audio === false
      ? Buffer.alloc(0)
      : execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-i",
            path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "8000",
            "-f",
            "f32le",
            "pipe:1",
          ],
          { maxBuffer: 16 * 1024 * 1024 },
        );
  let sum = 0,
    peak = 0;
  for (let i = 0; i < pcm.length; i += 4) {
    const value = pcm.readFloatLE(i);
    sum += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  const rms = pcm.length ? Math.sqrt(sum / (pcm.length / 4)) : 0;
  if (options.silent) expect(peak).toBeLessThan(0.00001);
  else if (options.audio !== false) {
    expect(rms).toBeGreaterThan(0.002);
    expect(peak).toBeGreaterThan(0.02);
  }
  const hashes = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      path,
      "-an",
      "-vf",
      "fps=1,scale=160:90",
      "-f",
      "framemd5",
      "pipe:1",
    ],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((s) => s && !s.startsWith("#"))
    .map((s) => s.split(",").at(-1)?.trim());
  expect(new Set(hashes).size).toBeGreaterThan(2);
  const screenshot = info.outputPath(`${name}-frame.png`);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-ss",
    "1",
    "-frames:v",
    "1",
    screenshot,
  ]);
  await info.attach(`${name}-decoded-frame`, {
    path: screenshot,
    contentType: "image/png",
  });
  await info.attach(`${name}-playable-video`, {
    path,
    contentType: "video/webm",
  });
  await info.attach(`${name}-media-proof`, {
    body: JSON.stringify(
      {
        duration: Number(probe.format.duration),
        decodedFrames: Number(picture.nb_read_frames),
        width: picture.width,
        height: picture.height,
        video: picture.codec_name,
        audio: audio?.codec_name ?? null,
        rms,
        peak,
        distinctFrames: new Set(hashes).size,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await info.attach(`${name}-finished-workflow`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  return { path, pcm };
}

function shortProject() {
  let p = { ...starterProject("kindness"), ...emptyProduction() };
  p.scenes = p.scenes.slice(0, 2).map((s) => retimeScene(s, 2));
  const source = builtInSound("melody");
  p.audioAssets = [source];
  const music = newAudioClip(p, source, "music", 0);
  music.duration = 4;
  music.volume = 0.8;
  p.audioClips = [music];
  const voice = starterProject("kindness").audioAssets[0];
  p.audioAssets.push(voice);
  p.audioClips.push(newAudioClip(p, voice, "narration", 0, 0.3));
  p.captions = p.scenes.map((s) => ({
    id: uid(),
    sceneId: s.id,
    start: 0.2,
    end: 1.8,
    text: "A kind hello makes room for a friend.",
  }));
  const artwork = imageLibraryItem(
    {
      id: uid(),
      type: "image",
      mime: "image/png",
      name: "original.png",
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=",
    },
    "Original image",
    "prop",
  );
  p = placeLibraryItem(p, 0, artwork);
  return p;
}

test("genuine short export decodes moving frames, embedded raster art, captions and mixed non-silent audio", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  const p = shortProject();
  await restore(page, p);
  const { path } = await render(page, info, "short-cartoon", 4);
  // Read actual decoded bottom caption pixels: a dark, readable subtitle plate.
  const pixel = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-ss",
    "1",
    "-vf",
    "crop=2:2:30:400,format=rgb24",
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  expect(pixel[0]).toBeLessThan(60);
  expect(pixel[1]).toBeLessThan(60);
  expect(pixel[2]).toBeLessThan(70);
});

test("master mute records silence in an actual encoded audio track", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  const p = shortProject();
  p.mixer.muted = true;
  await restore(page, p);
  await render(page, info, "muted-cartoon", 4, { silent: true });
});

test("VP9 at 720p and 24 fps genuinely excludes audio and captions when unchecked", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await restore(page, shortProject());
  const { path } = await render(page, info, "silent-vp9-cartoon", 4, {
    width: 1280,
    fps: 24,
    codec: "vp9",
    audio: false,
    captions: false,
  });
  const pixels = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-ss",
    "1",
    "-vf",
    "crop=2:2:48:640,format=rgb24",
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  expect(Math.max(...pixels)).toBeGreaterThan(100);
});

test("joins genuine silent 720p VP8 parts even when Chromium understates their duration", async ({ page }, info) => {
  test.setTimeout(60_000);
  const parts = ["part-01-scenes-1-2", "part-02-scenes-3-4"].map(name =>
    fileURLToPath(new URL(`./fixtures/single-movie/${name}.webm`, import.meta.url)));
  const project = segmentedProject(movieProofArtwork);
  project.captions = [{ id: uid(), sceneId: project.scenes[2].id, start: 0.3, end: 1.2, text: "The second part starts here." }];
  await restore(page, project);
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  const limit = page.getByRole("spinbutton", { name: "Maximum seconds per segment", exact: true });
  await limit.fill("4");
  await limit.press("Enter");
  await page.getByRole("checkbox", { name: "Include mixed audio", exact: true }).uncheck();
  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  await page.getByRole("button", { name: "Prepare for YouTube", exact: true }).click();
  const prep = page.getByRole("dialog", { name: "Prepare for YouTube" });
  await expect(prep.getByText(/2 of 2 numbered parts missing/)).toBeVisible();
  await prep.getByLabel("Video title").fill("Two scenes, one movie");
  await prep.getByRole("button", { name: "Review numbered movie parts" }).click();
  for (const [index, path] of parts.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `Add missing part ${index + 1}`, exact: true }).click();
    await (await chooser).setFiles(path);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${index + 1} of 2 parts assigned`) })).toBeVisible();
  }
  await expect(page.getByRole("status").filter({ hasText: /2 of 2 parts assigned.*Ready for delivery/ })).toBeVisible();
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  const movie = await downloadAndVerifyMovie(page, info, parts, [4, 4], false);
  expect(movie.width).toBe(1280);
  expect(movie.height).toBe(720);
  expect(movie.parts.map(part => part.frames)).toEqual([61, 59]);
  expect(movie.parts.every(part => part.frames > 32)).toBe(true);
  expect(movie.parts[1].sourceEnd - movie.parts[1].reportedDuration).toBeGreaterThan(0.25);
  expect(movie.parts[1].outputLength).toBeGreaterThan(movie.parts[1].sourceEnd + 0.02);

  await page.getByRole("button", { name: "Prepare for YouTube", exact: true }).click();
  const kit = page.getByRole("dialog", { name: "Prepare for YouTube" });
  await expect(kit.getByText(/1280 × 720 · WebM/)).toBeVisible();
  await expect(kit.getByLabel("Video title")).toHaveValue("Two scenes, one movie");
  const subtitles = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download YouTube SRT", exact: true }).click();
  const text = await readFile((await (await subtitles).path())!, "utf8");
  const start = text.match(/00:00:(\d{2}),(\d{3}) -->/)!;
  expect(Number(start[1]) + Number(start[2]) / 1000).toBeCloseTo(
    movie.parts[1].start + EXPORT_RECORDING_LEAD_SECONDS + 0.3, 3,
  );
  expect(text).toContain("The second part starts here.");
  const video = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download YouTube WebM", exact: true }).click();
  const file = await video;
  expect(file.suggestedFilename()).toMatch(/-youtube\.webm$/);
  const sha = async (name: string) => createHash("sha256").update(await readFile(name)).digest("hex");
  expect(await sha((await file.path())!)).toBe(await sha(info.outputPath("Kindness-in-two-little-parts-complete.webm")));
});

test("exports an editable playground location through the shared Stage", async ({ page }, info) => {
  test.setTimeout(75_000);
  const base = shortProject();
  base.scenes[0].elements = base.scenes[0].elements.filter(element => !element.assetId);
  base.assets = [];
  const project = placeLibraryItem(base, 0, starterLocations()[0]);
  project.scenes[0].elements.find(element => !!element.characterId)!.motion = "walk";
  await restore(page, project);
  const { path } = await render(page, info, "kind-hearts-playground", 4, { captions: false });
  const pixels = execFileSync("ffmpeg", ["-v", "error", "-i", path, "-ss", "1.1",
    "-vf", "crop=8:8:662:310,format=rgb24", "-frames:v", "1", "-f", "rawvideo", "pipe:1"]);
  const hasBench = Array.from({ length: pixels.length / 3 }, (_, index) => pixels.subarray(index * 3, index * 3 + 3))
    .some(([r, g, b]) => Math.abs(r - 231) < 30 && Math.abs(g - 177) < 30 && Math.abs(b - 129) < 30);
  expect(hasBench).toBe(true);
});

test("the complete original friendship demo exports as a playable sixty-second movie with voices, music and effects", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  await demo(page);
  await render(page, info, "friendship-demo", 60);
});

test("genuine consecutive parts retain camera, source artwork, subtitle timing and absolute music offsets", async ({
  page,
}, info) => {
  test.setTimeout(100_000);
  const png = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=magenta:s=32x32",
    "-frames:v",
    "1",
    "-f",
    "image2pipe",
    "-vcodec",
    "png",
    "pipe:1",
  ]);
  const p = segmentedProject(`data:image/png;base64,${png.toString("base64")}`);
  await restore(page, p);
  const before = (await backup(page)).data;
  const part1 = await render(page, info, "friendship-part-01", 4, {
    segment: 1,
    limit: 4,
  });
  const subtitles = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Segment 2 subtitles", exact: true })
    .click();
  const subtitleText = await import("node:fs/promises").then(async (fs) =>
    fs.readFile((await (await subtitles).path())!, "utf8"),
  );
  expect(subtitleText).toContain("00:00:00,250 --> 00:00:01,600\nScene 3:");
  expect(subtitleText).toContain("00:00:02,250 --> 00:00:03,600\nScene 4:");
  expect(subtitleText).not.toContain("Scene 2:");
  await page
    .getByRole("button", { name: "Back to studio", exact: true })
    .click();
  const part2 = await render(page, info, "friendship-part-02", 4, {
    segment: 2,
    limit: 4,
  });
  const measurements = [];
  for (const [i, part] of [part1, part2].entries()) {
    const raw = execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        part.path,
        "-ss",
        "1.2",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
      ],
      { maxBuffer: 2 * 1024 * 1024 },
    );
    let xSum = 0,
      pixels = 0;
    for (let j = 0; j < raw.length; j += 3)
      if (raw[j] > 180 && raw[j + 1] < 80 && raw[j + 2] > 180) {
        xSum += (j / 3) % 800;
        pixels++;
      }
    expect(pixels).toBeGreaterThan(1500);
    const scene = p.scenes[i * 2],
      el = elementAt(scene.elements[0], 1, 2),
      camera = cameraAt(scene, 1),
      expectedX = 400 + (el.x - camera.x) * camera.zoom,
      centroid = xSum / pixels;
    expect(Math.abs(centroid - expectedX)).toBeLessThan(4);
    const plate = (400 * 800 + 30) * 3;
    expect(Math.max(raw[plate], raw[plate + 1], raw[plate + 2])).toBeLessThan(
      80,
    );
    const noCaption = execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      part.path,
      "-ss",
      "1.95",
      "-vf",
      "crop=2:2:30:400,format=rgb24",
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "pipe:1",
    ]);
    expect(Math.max(...noCaption)).toBeGreaterThan(100);
    // A different original melody note is expected at this absolute story time.
    // This fails if part 2 restarts the music instead of seeking its trimmed loop.
    const start = Math.round(1.34 * 8000),
      length = 800;
    let dominant = 0,
      power = 0;
    for (let hz = 300; hz <= 500; hz++) {
      let re = 0,
        im = 0;
      for (let k = 0; k < length; k++) {
        const sample = part.pcm.readFloatLE((start + k) * 4),
          angle = (2 * Math.PI * hz * k) / 8000;
        re += sample * Math.cos(angle);
        im += sample * Math.sin(angle);
      }
      const energy = re * re + im * im;
      if (energy > power) {
        power = energy;
        dominant = hz;
      }
    }
    expect(Math.abs(dominant - (i === 0 ? 349.23 : 440))).toBeLessThan(8);
    measurements.push({
      part: i + 1,
      scenes: [i * 2 + 1, i * 2 + 2],
      expectedArtworkX: expectedX,
      decodedArtworkX: centroid,
      magentaPixels: pixels,
      expectedMusicHz: i === 0 ? 349.23 : 440,
      decodedMusicHz: dominant,
    });
  }
  await page
    .getByRole("button", { name: "Back to studio", exact: true })
    .click();
  expect((await backup(page)).data).toEqual(before);
  await info.attach("segmented-timeline-continuity", {
    body: JSON.stringify(
      {
        parts: measurements,
        subtitleText,
        sourceUnchanged: true,
        logicalStorySeconds: 8,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});


test("a generated assistant scene exports playable WebM with real character and camera movement", async ({ page }, info) => {
  const plan = createAssistantDraft(PLAYGROUND_BRIEF, [{ name: "Shine" }, { name: "Sunny" }, { name: "Sam" }]);
  const draft = applyDirections(plan.project, plan.directions);
  const scene = draft.scenes[3];
  expect(scene.cameraAnimation?.followId).toBe(scene.elements[0].id);
  expect(scene.elements[0].animation?.keyframes.length).toBeGreaterThan(2);
  await restore(page, { ...draft, scenes: [scene] });
  await render(page, info, "kind-hearts-assistant", scene.duration, { audio: false, captions: false });
});

test("a puppet wave changes the arm region across decoded WebM frames", async ({ page }, info) => {
  test.setTimeout(60_000);
  const draft = sunnyCartoon();
  const scene = draft.scenes[1];
  scene.elements = [{ ...scene.elements[1], x: 400,
    animation: { ...scene.elements[1].animation!, keyframes: scene.elements[1].animation!.keyframes.map(key => ({
      ...key, x: 400, heart: "off" as const, mouth: "closed" as const,
    })), blink: false } }];
  scene.transition = "cut";
  await restore(page, { ...draft, scenes: [scene] });
  const { path } = await render(page, info, "sunny-puppet-wave", 5, { audio: false, captions: false });
  const arm = (time: string) => execFileSync("ffmpeg", [
    "-v", "error", "-ss", time, "-i", path, "-vf", "crop=120:112:445:156",
    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
  ]);
  const still = arm("0.05"), waving = arm("1.30");
  expect(still.length).toBe(120 * 112 * 3);
  expect(waving.length).toBe(still.length);
  let pixels = 0;
  for (let i = 0; i < still.length; i += 3) {
    if (Math.abs(still[i] - waving[i]) + Math.abs(still[i + 1] - waving[i + 1]) + Math.abs(still[i + 2] - waving[i + 2]) > 55) pixels++;
  }
  expect(pixels).toBeGreaterThan(100);
});

test("A Hello Heart previews its linked narrator and exports genuine spoken audio and moving artwork", async ({ page }, info) => {
  test.setTimeout(70_000);
  const { plan, artwork } = kindHeartsCrew();
  const episode = plan.episodes[0];
  const draft = createAssistantDraft(episodeBrief(episode, 1), plan.cast.slice(0, 2).map((member, index) => ({
    name: member.name, seriesCastId: member.id, library: artwork[index],
  }))).project;
  await restore(page, { ...draft, scenes: [draft.scenes[0]],
    scriptOptions: { pace: 120, pause: 1, seriesTitle: plan.name, helloHeart: true } });
  await page.getByRole("button", { name: "Write My Episode Script", exact: true }).click();
  await page.getByRole("button", { name: "Add A Hello Heart sample", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Recording assigned/ })).toBeVisible();
  const audio = page.getByLabel("Original audio source");
  await audio.evaluate((element: HTMLAudioElement) => element.play());
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.15);
  await audio.evaluate((element: HTMLAudioElement) => element.pause());
  await page.getByRole("button", { name: "Preview acting suggestion", exact: true }).click();
  await page.getByRole("button", { name: "Apply acting suggestion", exact: true }).click();
  await page.getByRole("button", { name: "Add script caption drafts", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const project = (await backup(page)).data;
  const narrator = project.scenes[0].script?.lines[0];
  expect(narrator?.text).toBe("At the park, one kind hello helps a new friend feel welcome.");
  expect(project.audioClips).toHaveLength(1);
  expect(project.audioClips[0]).toMatchObject({ id: narrator?.clipId, sceneId: project.scenes[0].id, category: "narration", start: 0 });
  expect(project.captions[0]).toMatchObject({ start: 0, text: narrator?.text });
  await render(page, info, "a-hello-heart-script", project.scenes[0].duration);
});

test("Shine’s exported second segment contains real speech with open mouth frames and closes during silence", async ({ page }, info) => {
  test.setTimeout(80_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Try Shine Says Hello", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A Hello Heart — Shine Says Hello", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Make My Character Talk", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Recorded voice", exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Analyze recording", exact: true }).click();
  await expect(dialog.getByText("Mouth animation suggested", { exact: true })).toBeVisible();
  const seek = dialog.getByRole("spinbutton", { name: "Preview scene time (seconds)", exact: true });
  await seek.fill("0.72");
  await seek.press("Enter");
  const actor = dialog.getByRole("figure").nth(1).locator("[data-voice-opening]");
  await expect.poll(async () => Number(await actor.getAttribute("data-voice-opening"))).toBeGreaterThan(0.2);
  const mouth = await actor.locator('[data-puppet-part="head"] ellipse[cy="15"]').evaluate((node: SVGEllipseElement) => {
    const svg = node.ownerSVGElement!;
    const center = new DOMPoint(node.cx.baseVal.value, node.cy.baseVal.value)
      .matrixTransform(node.getCTM()!).matrixTransform(svg.getCTM()!.inverse());
    return { x: Math.round(center.x), y: Math.round(center.y) };
  });
  await page.getByRole("button", { name: "Apply mouth animation", exact: true }).click();
  const project = (await backup(page)).data;
  const scene = project.scenes[0], element = scene.elements[0];
  const speech = [0.72, 0.82, 4.3, 4.4];
  expect(speech.every(time => (sceneElementAt(project, scene, element, time, 0).voiceOpening ?? 0) > 0.2)).toBe(true);
  const silence = [2.88, 3.2, 3.55];
  expect(silence.every(time => sceneElementAt(project, scene, element, time, 0).voiceOpening === 0)).toBe(true);
  const intro = { ...makeScene(project.characters), title: "Before Shine greets the neighbor", elements: [], duration: 3 };
  await restore(page, { ...project, scenes: [intro, scene] });
  const { path, pcm } = await render(page, info, "shine-says-hello-segment-2", scene.duration, { segment: 2, limit: 8 });
  const crop = `crop=36:34:${mouth.x - 18}:${mouth.y - 17}`;
  const pixels = execFileSync("ffmpeg", [
    "-v", "error", "-i", path, "-vf", crop, "-fps_mode", "passthrough",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
  ]);
  const { frames } = JSON.parse(execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_frames",
    "-show_entries", "frame=best_effort_timestamp_time", "-of", "json", path,
  ], { encoding: "utf8" })) as { frames: { best_effort_timestamp_time: string }[] };
  const frameBytes = 36 * 34 * 3;
  expect(pixels.length).toBe(frames.length * frameBytes);
  function audioAt(time: number) {
    const start = Math.floor((time - 0.05) * 8000);
    let sum = 0;
    for (let i = start; i < start + 800; i++) sum += pcm.readFloatLE(i * 4) ** 2;
    return Math.sqrt(sum / 800);
  }
  const measurements = frames.flatMap((frame, index) => {
    const time = Number(frame.best_effort_timestamp_time);
    if (time < 0.55 || time > 5.6) return [];
    let ink = 0;
    const first = index * frameBytes;
    for (let i = first; i < first + frameBytes; i += 3)
      if (pixels[i] < 95 && pixels[i + 1] < 75 && pixels[i + 2] < 95) ink++;
    return [{ time, ink, rms: audioAt(time) }];
  });
  const silentFrames = measurements.filter(frame => frame.time >= 2.92 && frame.time <= 3.55);
  expect(silentFrames.length).toBeGreaterThanOrEqual(6);
  expect(Math.max(...silentFrames.map(frame => frame.rms))).toBeLessThan(0.006);
  expect(Math.max(...silentFrames.map(frame => frame.ink))).toBeLessThan(100);
  const closedInk = Math.max(...silentFrames.map(frame => frame.ink));
  const speakingFrames = [[0.55, 2.5], [4.1, 5.6]].map(([from, to]) => {
    const matches = measurements.filter(frame => frame.time >= from && frame.time <= to &&
      frame.rms > 0.035 && frame.ink > closedInk + 20);
    expect(matches.length).toBeGreaterThanOrEqual(5);
    return matches;
  });
  await info.attach("shine-speech-and-silence-measurements", {
    body: JSON.stringify({ cropCenter: mouth, speakingFrames, silentFrames }, null, 2),
    contentType: "application/json",
  });
});

test("decodes one watering can at its resting, carried, tilted and released positions", async ({ page }, info) => {
  test.setTimeout(110_000);
  const project = gardenInteractionDemo();
  const scene = project.scenes[0];
  const action = scene.interactions![0];
  const can = scene.elements.find(item => item.id === action.objectId)!;
  const opening = retimeScene({ ...duplicateAnimatedScene(scene), interactions: undefined }, 3);
  opening.title = "Meet the garden helpers";
  await restore(page, { ...project, scenes: [opening, scene] });
  const first = await render(page, info, "garden-opening", opening.duration, {
    audio: false, segment: 1, limit: scene.duration,
  });
  const finish = page.getByRole("button", { name: "Back to studio", exact: true });
  await finish.click();
  const { path } = await render(page, info, "helping-hands-garden", scene.duration, {
    audio: false, segment: 2, limit: scene.duration,
  });
  function projectedCenter(time: number) {
    const frame = sceneFramesAt(project, scene, time).get(can.id)!;
    const p = stagePoint(can, frame, { x: 0, y: -29 });
    const camera = cameraAt(scene, time);
    return { x: (p.x - camera.x) * camera.zoom + 400, y: (p.y - camera.y) * camera.zoom + 225 };
  }
  const measurements = [];
  for (const time of [0.4, 2.75, 4.45, 6.2, 9.1]) {
    const frame = execFileSync("ffmpeg", ["-v", "error", "-ss", String(time), "-i", path,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 2 * 1024 * 1024 });
    expect(frame.length).toBe(800 * 450 * 3);
    const target = projectedCenter(time);
    let inside = 0, outside = 0, totalX = 0, totalY = 0;
    for (let y = 180; y < 440; y++) for (let x = 0; x < 800; x++) {
      const i = (y * 800 + x) * 3;
      // The can is the only large teal shape. Tolerate VP8 and RGB conversion shifts.
      const [r, g, b] = [frame[i], frame[i + 1], frame[i + 2]];
      if (r < 95 || r > 161 || g < 148 || g > 212 || b < 153 || b > 214 ||
          b < g - 5 || g - r <= 33 || b - r < 34) continue;
      if (Math.hypot(x - target.x, y - target.y) < 48) { inside++; totalX += x; totalY += y; }
      else outside++;
    }
    expect(inside, `can at ${time}s`).toBeGreaterThan(190);
    expect(outside, `no second can at ${time}s`).toBeLessThan(inside * 0.35);
    measurements.push({ time, expectedX: target.x, expectedY: target.y, x: totalX / inside, y: totalY / inside, pixels: inside, outside });
  }
  expect(measurements[0].x - measurements[2].x).toBeGreaterThan(130);
  expect(measurements[2].x - measurements[4].x).toBeGreaterThan(45);
  await info.attach("decoded watering can positions", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  const files = [first.path, path];
  for (const [index, file] of files.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `Add missing part ${index + 1}`, exact: true }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${index + 1} of 2 parts assigned`) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  // Compare every independently decoded picture in both segments with the complete movie.
  await downloadAndVerifyMovie(page, info, files, [opening.duration, scene.duration], false);
});

test("decodes a single wagon with a loose and fixed wheel, then verifies the joined voiced cartoon", async ({ page }, info) => {
  test.setTimeout(140_000);
  const expected = transformExample("wagon");
  const [repair, testRun] = expected.scenes;
  await page.goto("./");
  await page.getByText("Try a Fix, Build & Transform example", { exact: true }).click();
  await page.getByRole("button", { name: `Try ${EXAMPLE_NAMES.wagon}`, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const options = { limit: repair.duration };
  const first = await render(page, info, "wobbly-wagon-repair", repair.duration, { ...options, segment: 1 });
  await page.getByRole("button", { name: "Back to studio", exact: true }).click();
  const second = await render(page, info, "wobbly-wagon-test", testRun.duration, { ...options, segment: 2 });
  const windowRms = (start: number) => {
    const sample = Math.round(start * 8000), length = 3200;
    let energy = 0;
    for (let i = 0; i < length; i++) energy += first.pcm.readFloatLE((sample + i) * 4) ** 2;
    return Math.sqrt(energy / length);
  };
  expect(windowRms(8.2)).toBeGreaterThan(3 * windowRms(12.4));
  const proofs = [];
  for (const [scene, movie, at, fixed] of [
    [repair, first.path, 2.25, false],
    [repair, first.path, 8.85, false],
    [repair, first.path, 9.6, true],
    [repair, first.path, 12.7, true],
    // Sample after the final spoken caption has cleared the fixed wheel.
    [testRun, second.path, 7.55, true],
  ] as const) {
    const raw = rawFrame(movie, at);
    const object = scene.elements.find(item => item.prop === "toy-wagon")!;
    const frame = sceneFramesAt(expected, scene, at).get(object.id)!;
    const camera = cameraAt(scene, at);
    const center = (x: number, y: number) => {
      const point = stagePoint(object, frame, { x, y });
      return { x: (point.x - camera.x) * camera.zoom + 400, y: (point.y - camera.y) * camera.zoom + 225 };
    };
    const body = center(0, -35);
    let near = 0, elsewhere = 0, sumX = 0;
    for (let y = 155; y < 450; y++) for (let x = 0; x < 800; x++) {
      const i = (y * 800 + x) * 3, r = raw[i], g = raw[i + 1], b = raw[i + 2];
      if (r < 157 || r > 246 || g < 60 || g > 153 || b - g < 20 || r - b < 28) continue;
      if (Math.hypot(x - body.x, y - body.y) < 67) { near++; sumX += x; }
      else elsewhere++;
    }
    function wheelPixels(x: number, y: number) {
      const point = center(x, y);
      let count = 0;
      for (let py = Math.max(0, Math.floor(point.y - 9)); py < Math.min(450, point.y + 9); py++)
        for (let px = Math.max(0, Math.floor(point.x - 9)); px < Math.min(800, point.x + 9); px++) {
          const i = (py * 800 + px) * 3, r = raw[i], g = raw[i + 1], b = raw[i + 2];
          // The adult’s nearby trousers are purple. Check the wheel’s blue-grey hue.
          if (Math.hypot(px - point.x, py - point.y) < 9 && r >= 57 && r <= 111 &&
              g - r >= 12 && g - r <= 34 && b - g >= 16 && b - g <= 38) count++;
        }
      return count;
    }
    const loose = wheelPixels(61, -6), attached = wheelPixels(33, -11);
    expect(near, `one wagon at ${scene.title} ${at}s`).toBeGreaterThan(300);
    expect(elsewhere, `no second wagon at ${scene.title} ${at}s`).toBeLessThan(near * 0.22);
    expect(fixed ? attached : loose, `wheel position at ${scene.title} ${at}s`).toBeGreaterThan(38);
    expect(fixed ? loose : attached, `no duplicate wheel at ${scene.title} ${at}s`).toBeLessThan(38);
    proofs.push({ scene: scene.title, at, held: !!frame.heldBy, fixed, x: sumX / near, near, elsewhere, loose, attached });
  }
  expect(proofs[1].held && proofs[2].held).toBe(true);
  expect(proofs[4].x - proofs[3].x).toBeGreaterThan(165);
  const closing = rawFrame(second.path, 5.5);
  const brightCaptionInk = pixels(closing, 35, 365, 730, 58, (r, g, b) => Math.min(r, g, b) > 210);
  const darkCaptionPlate = pixels(closing, 35, 365, 730, 58, (r, g, b) => Math.max(r, g, b) < 40);
  expect(darkCaptionPlate).toBeGreaterThan(20_000);
  expect(brightCaptionInk).toBeGreaterThan(450);
  await info.attach("decoded wagon proof", { body: JSON.stringify(proofs, null, 2), contentType: "application/json" });

  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  const files = [first.path, second.path];
  for (const [index, file] of files.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `Add missing part ${index + 1}`, exact: true }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${index + 1} of 2 parts assigned`) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  await downloadAndVerifyMovie(page, info, files, [repair.duration, testRun.duration]);
});

function rawFrame(movie: string, at: number, filter?: string) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(at + EXPORT_RECORDING_LEAD_SECONDS), "-i", movie,
    ...(filter ? ["-vf", filter] : []), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 2 * 1024 * 1024 });
  expect(raw.length).toBe(800 * 450 * 3);
  return raw;
}
function pixels(raw: Buffer, x: number, y: number, width: number, height: number,
  match: (r: number, g: number, b: number) => boolean) {
  let total = 0;
  for (let row = Math.max(0, Math.floor(y)); row < Math.min(450, y + height); row++) {
    for (let col = Math.max(0, Math.floor(x)); col < Math.min(800, x + width); col++) {
      const index = (row * 800 + col) * 3;
      if (match(raw[index], raw[index + 1], raw[index + 2])) total++;
    }
  }
  return total;
}

function changedPixels(before: Buffer, after: Buffer, x: number, y: number, width: number, height: number) {
  let changed = 0;
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      const i = (row * 800 + col) * 3;
      const difference = Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) +
        Math.abs(before[i + 2] - after[i + 2]);
      if (difference > 75) changed++;
    }
  }
  return changed;
}

test("decodes visual teaching graphics following the held wagon with clear spoken captions and verifies the joined lesson", async ({ page }, info) => {
  test.setTimeout(140_000);
  const expected = visualTeachingExample(transformExample("wagon"), "wagon");
  const [repair, rollout] = expected.scenes;
  await page.goto("./");
  await page.getByText("Try a Visual Teaching example", { exact: true }).click();
  await page.getByRole("button", { name: expected.title, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const limit = repair.duration;
  const first = await render(page, info, "visual-lesson-repair", repair.duration, { limit, segment: 1 });
  await page.getByRole("button", { name: "Back to studio", exact: true }).click();
  const second = await render(page, info, "visual-lesson-roll", rollout.duration, { limit, segment: 2 });

  const yellow = (r: number, g: number, b: number) => r > 235 && g > 219 && b >= 115 && b < 198 && r - g < 38;
  const early = pixels(rawFrame(first.path, 1.0), 75, 10, 269, 85, yellow);
  const numbered = pixels(rawFrame(first.path, 2.75), 75, 10, 269, 85, yellow);
  expect(numbered - early).toBeGreaterThan(400);
  const wagon = repair.elements.find(item => item.prop === "toy-wagon")!;
  const arrow = repair.focusGraphics!.find(item => item.kind === "arrow")!;
  const colors = (r: number, g: number, b: number) => r < 60 && g > 68 && g < 157 && b - g > 22 && b - g < 90;
  const path = [5.86, 7.77].map(at => {
    const frames = sceneFramesAt(expected, repair, at);
    const frame = frames.get(wagon.id)!;
    expect(frame.heldBy).toBeTruthy();
    const point = focusAnchor(repair, arrow, frames, cameraAt(repair, at));
    const count = pixels(rawFrame(first.path, at), point.x - 12, point.y - 12, 24, 24, colors);
    expect(count, `arrow at the held wheel at ${at}s`).toBeGreaterThan(18);
    return { at, ...point, count };
  });
  const circle = rollout.focusGraphics!.find(item => item.kind === "circle")!;
  const rolling = [2.32, 2.82].map(at => {
    const frames = sceneFramesAt(expected, rollout, at);
    const point = focusAnchor(rollout, circle, frames, cameraAt(rollout, at));
    const count = pixels(rawFrame(second.path, at), point.x - 25, point.y - 24, 50, 48, colors);
    expect(count, `highlight follows the rolling wheel at ${at}s`).toBeGreaterThan(45);
    return { at, ...point, count };
  });
  expect(rolling[1].x - rolling[0].x).toBeGreaterThan(22);

  function wheel(raw: Buffer, at: number, x: number, y: number) {
    const frame = sceneFramesAt(expected, repair, at).get(wagon.id)!;
    const camera = cameraAt(repair, at);
    const point = stagePoint(wagon, frame, { x, y });
    const screenX = 400 + (point.x - camera.x) * camera.zoom, screenY = 225 + (point.y - camera.y) * camera.zoom;
    return pixels(raw, screenX - 6, screenY - 6, 12, 12,
      (r, g, b) => r >= 57 && r <= 111 && g - r >= 12 && g - r <= 34 && b - g >= 16 && b - g <= 38);
  }
  // Check several frames after the arrow fades and before the repair. The recorder
  // samples near, rather than exactly at, these times.
  const looseWheel = [8.9, 9.0, 9.1].map(at => wheel(rawFrame(first.path, at), at, 61, -6));
  const after = rawFrame(first.path, 9.77);
  expect(Math.max(...looseWheel)).toBeGreaterThan(30);
  expect(wheel(after, 9.77, 33, -11)).toBeGreaterThan(30);
  expect(wheel(after, 9.77, 61, -6)).toBeLessThan(27);
  const captionInk = pixels(after, 40, 387, 720, 43, (r, g, b) => Math.min(r, g, b) > 210);
  const captionPlate = pixels(after, 40, 388, 720, 42, (r, g, b) => Math.max(r, g, b) < 56);
  expect(captionInk).toBeGreaterThan(120);
  expect(captionPlate).toBeGreaterThan(5000);
  await info.attach("decoded teaching graphic evidence", {
    body: JSON.stringify({ early, numbered, path, rolling, looseWheel, captionInk, captionPlate }, null, 2), contentType: "application/json",
  });

  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  const files = [first.path, second.path];
  for (const [index, file] of files.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `Add missing part ${index + 1}`, exact: true }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${index + 1} of 2 parts assigned`) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  await downloadAndVerifyMovie(page, info, files, [repair.duration, rollout.duration]);
});

test("decodes a voiced wagon question, both choices, quiet thinking time and its timed reveal in the joined lesson", async ({ page }, info) => {
  test.setTimeout(140_000);
  const expected = participationExample("wagon");
  const [repair, roll] = expected.scenes;
  const [moment] = repair.participation!;
  const { start, think, reveal, end } = participationWindow(moment);
  await page.goto("./");
  await page.getByText("Try a Pause, Think & Try example", { exact: true }).click();
  await page.getByRole("button", { name: expected.title, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const limit = repair.duration;
  const first = await render(page, info, "participation-wagon-question", repair.duration, { limit, segment: 1 });
  await page.getByRole("button", { name: "Back to studio", exact: true }).click();
  const second = await render(page, info, "participation-wagon-test", roll.duration, { limit, segment: 2 });

  const cream = (r: number, g: number, b: number) => r > 235 && g > 221 && b >= 160 && b < 218 && r - b > 29;
  const green = (r: number, g: number, b: number) => r >= 200 && r <= 249 && g >= 233 && g - r >= 8 && g - b >= 9 && Math.abs(r - b) <= 8;
  const pink = (r: number, g: number, b: number) => r >= 243 && g >= 220 && b >= 225 && r - g >= 3 && r - b >= 3 && Math.abs(g - b) <= 12;
  const blue = (r: number, g: number, b: number) => r >= 212 && r <= 253 && g >= 231 && b >= 247 && g - r >= 3 && b >= g - 2;
  const panel = (frame: Buffer, match: (r: number, g: number, b: number) => boolean) => pixels(frame, 98, 19, 604, 47, match);
  const before = rawFrame(first.path, start - 0.45), question = rawFrame(first.path, start + 0.52);
  const endOfThinking = rawFrame(first.path, reveal - 0.3);
  const thinkFrames = [think + 0.36, (think + reveal) / 2, reveal - 0.3].map(at => rawFrame(first.path, at));
  const completed = rawFrame(first.path, reveal + 0.65);
  const after = rawFrame(first.path, end + 0.48);
  expect(panel(before, cream)).toBeLessThan(1700);
  expect(panel(question, cream)).toBeGreaterThan(17_000);
  for (const frame of thinkFrames) {
    expect(panel(frame, cream)).toBeGreaterThan(17_000);
    expect(pixels(frame, 99, 73, 291, 51, blue)).toBeGreaterThan(4300);
    expect(pixels(frame, 411, 73, 290, 51, pink)).toBeGreaterThan(4300);
  }
  expect(panel(completed, cream)).toBeLessThan(1700);
  expect(panel(completed, green)).toBeGreaterThan(15_000);
  expect(panel(after, green)).toBeLessThan(1700);
  const captionInk = pixels(completed, 40, 385, 720, 45, (r, g, b) => Math.min(r, g, b) > 210);
  const captionPlate = pixels(completed, 40, 385, 720, 45, (r, g, b) => Math.max(r, g, b) < 58);
  expect(captionInk).toBeGreaterThan(115);
  expect(captionPlate).toBeGreaterThan(5000);

  const circle = repair.focusGraphics![0], wagon = repair.elements.find(item => item.prop === "toy-wagon")!;
  const marker = (r: number, g: number, b: number) => r < 60 && g > 68 && g < 157 && b - g > 22 && b - g < 90;
  const markerPixels = (frame: Buffer, at: number) => {
    const sampled = sceneFramesAt(expected, repair, at);
    const point = focusAnchor(repair, circle, sampled, cameraAt(repair, at));
    const count = pixels(frame, point.x - 26, point.y - 26, 52, 52, marker);
    return { at, ...point, count, held: Boolean(sampled.get(wagon.id)?.heldBy) };
  };
  expect(markerPixels(endOfThinking, reveal - 0.3).count).toBeLessThan(30);
  const moving = [reveal + 0.65, reveal + 2.48].map(at => markerPixels(rawFrame(first.path, at), at));
  expect(moving.every(frame => frame.held && frame.count > 65)).toBe(true);
  expect(Math.hypot(moving[1].x - moving[0].x, moving[1].y - moving[0].y)).toBeGreaterThan(3);

  const windowRms = (at: number) => {
    const firstSample = Math.round(at * 8000), length = 3200;
    let power = 0;
    for (let i = 0; i < length; i++) power += first.pcm.readFloatLE((firstSample + i) * 4) ** 2;
    return Math.sqrt(power / length);
  };
  const voice = { question: windowRms(start + 0.6), think: windowRms(think + 0.9), explanation: windowRms(reveal + 0.65) };
  expect(voice.question).toBeGreaterThan(voice.think * 3);
  expect(voice.explanation).toBeGreaterThan(voice.think * 3);
  await info.attach("decoded participation evidence", {
    body: JSON.stringify({ start, think, reveal, end, moving, captionInk, captionPlate, voice }, null, 2),
    contentType: "application/json",
  });

  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  const files = [first.path, second.path];
  for (const [index, file] of files.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `Add missing part ${index + 1}`, exact: true }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${index + 1} of 2 parts assigned`) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  await downloadAndVerifyMovie(page, info, files, [repair.duration, roll.duration]);
});

test("decodes real garden footsteps, pickup, pouring, placement, chime and narration at their authored times", async ({ page }, info) => {
  test.setTimeout(140_000);
  const project = gardenSoundDemo();
  const [garden, lesson] = project.scenes;
  const [action] = garden.interactions!;
  const water = wateringWindow(action);
  const effect = (name: string) => project.audioClips.find(clip => clip.name === name)!;
  await page.goto("./");
  await page.getByText("Try a Sound Director example", { exact: true }).click();
  await page.getByRole("button", { name: project.title, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const first = await render(page, info, "garden-sound-actions", garden.duration, { limit: garden.duration, segment: 1 });
  await page.getByRole("button", { name: "Back to studio", exact: true }).click();
  const second = await render(page, info, "garden-sound-lesson", lesson.duration, { limit: garden.duration, segment: 2 });

  const rate = 8000;
  function samples(pcm: Buffer, time: number, span: number) {
    const begin = Math.round((time + EXPORT_RECORDING_LEAD_SECONDS) * rate);
    return Array.from({ length: Math.round(span * rate) }, (_, i) => pcm.readFloatLE((begin + i) * 4));
  }
  function rms(pcm: Buffer, time: number, span: number, high = false) {
    const values = samples(pcm, time, span);
    const total = values.reduce((sum, value, index) => sum + (high ? value - (values[index - 1] ?? value) : value) ** 2, 0);
    return Math.sqrt(total / values.length);
  }
  function tone(pcm: Buffer, time: number, frequency: number, span = 0.14) {
    const values = samples(pcm, time, span);
    let real = 0, imaginary = 0;
    for (const [i, value] of values.entries()) {
      const phase = 2 * Math.PI * i * frequency / rate;
      const taper = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / values.length);
      real += value * taper * Math.cos(phase);
      imaginary += value * taper * Math.sin(phase);
    }
    return Math.hypot(real, imaginary) / values.length;
  }
  const walking = effect("Little footsteps").start, pickup = effect("Soft object pickup").start;
  const place = effect("Wooden object set down").start, success = effect("Friendly success cue").start;
  const measurements = [
    { event: "walk", at: walking,
      near: Math.min(rms(first.pcm, walking - 0.04, 0.14, true), rms(first.pcm, walking + 0.31, 0.14, true)),
      before: Math.max(rms(first.pcm, walking - 0.44, 0.14, true), rms(first.pcm, walking + 0.17, 0.12, true)) },
    { event: "pick up", at: pickup, near: tone(first.pcm, pickup + 0.035, 490), before: tone(first.pcm, pickup - 0.21, 490) },
    { event: "pour", at: water.start, near: rms(first.pcm, water.start + 0.28, 0.42, true), before: rms(first.pcm, water.start - 0.52, 0.32, true),
      after: rms(first.pcm, water.end + 0.19, 0.27, true) },
    { event: "set down", at: place, near: tone(first.pcm, place + 0.035, 196), before: tone(first.pcm, place - 0.27, 196) },
    { event: "success", at: success, near: tone(first.pcm, success + 0.045, 523.25), before: tone(first.pcm, success - 0.24, 523.25) },
  ];
  for (const sample of measurements) {
    expect(sample.near, sample.event).toBeGreaterThan(0.0015);
    expect(sample.near, sample.event).toBeGreaterThan(sample.before * 3);
    if (sample.after !== undefined) expect(sample.near, sample.event).toBeGreaterThan(sample.after * 3);
  }
  const waterAt = water.start + 0.48;
  const stream = sceneFramesAt(project, garden, waterAt).get(action.objectId)!.watering!;
  const camera = cameraAt(garden, waterAt);
  const streamX = (stream.x - camera.x) * camera.zoom + 400, streamY = (stream.y - camera.y) * camera.zoom + 225;
  const waterPixels = pixels(rawFrame(first.path, waterAt), streamX - 48, streamY - 3, 53, 42,
    (r, g, b) => r > 198 && g > 227 && b >= 236 && b - r > 6);
  expect(waterPixels).toBeGreaterThan(45);
  const bedBefore = rms(first.pcm, garden.duration - 0.48, 0.28);
  const bedAfter = rms(second.pcm, 0.06, 0.25);
  expect(bedBefore).toBeGreaterThan(0.00045);
  expect(bedAfter).toBeGreaterThan(0.00045);
  const speech = rms(second.pcm, GARDEN_NARRATION_START + 0.3, 2.5);
  expect(speech).toBeGreaterThan(bedAfter * 5);
  const voicedFrame = rawFrame(second.path, GARDEN_NARRATION_START + 1.4);
  const caption = pixels(voicedFrame, 40, 365, 720, 65, (r, g, b) => Math.min(r, g, b) > 210);
  expect(caption).toBeGreaterThan(160);
  await info.attach("decoded garden cue measurements", {
    body: JSON.stringify({ measurements, waterPixels, bedBefore, bedAfter, speech, caption }, null, 2),
    contentType: "application/json",
  });

  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  const files = [first.path, second.path];
  for (const [index, file] of files.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `Add missing part ${index + 1}`, exact: true }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${index + 1} of 2 parts assigned`) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  await downloadAndVerifyMovie(page, info, files, [garden.duration, lesson.duration]);
});

test("decodes exact wagon camera cuts, a moving follow shot, teaching overlays and continuous voices in the joined movie", async ({ page }, info) => {
  test.setTimeout(150_000);
  const expected = cameraShotDemo();
  const [repair, roll] = expected.scenes;
  await page.goto("./");
  await page.getByText("Try a Camera & Shot Director example", { exact: true }).click();
  await page.getByRole("button", { name: expected.title, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const limit = repair.duration;
  const first = await render(page, info, "camera-wagon-workshop", repair.duration, { limit, segment: 1 });
  await page.getByRole("button", { name: "Back to studio", exact: true }).click();
  const second = await render(page, info, "camera-wagon-roll", roll.duration, { limit, segment: 2 });

  const magenta = (r: number, g: number, b: number) => r >= 157 && r <= 246 && g >= 60 && g <= 153 && b - g >= 20 && r - b >= 28;
  const wheel = (r: number, g: number, b: number) => r >= 57 && r <= 111 && g - r >= 12 && g - r <= 34 && b - g >= 16 && b - g <= 38;
  const projector = (scene: typeof repair, at: number) => {
    const frames = sceneFramesAt(expected, scene, at);
    const camera = stageCameraAt(expected, scene, at, false, frames);
    const object = scene.elements.find(item => item.prop === "toy-wagon")!;
    return (x: number, y: number) => projectFocusPoint(scene, object, frames.get(object.id)!, camera, { x, y });
  };
  const centerPixels = (frame: Buffer, point: { x: number; y: number }, radius: number, match: typeof magenta) =>
    pixels(frame, point.x - radius, point.y - radius, radius * 2, radius * 2, match);
  const colorArea = (frame: Buffer) => pixels(frame, 0, 145, 800, 305, magenta);
  const wide = rawFrame(first.path, 0.9);
  const beforeCut = rawFrame(first.path, 3.30), detail = rawFrame(first.path, 3.66);
  expect(colorArea(wide)).toBeGreaterThan(350);
  expect(colorArea(detail)).toBeGreaterThan(colorArea(beforeCut) * 1.9);
  expect(colorArea(detail)).toBeGreaterThan(colorArea(wide) * 2.3);
  const loose = projector(repair, 3.66)(61, -6);
  expect(centerPixels(detail, loose, 12, wheel)).toBeGreaterThan(90);

  const revealAt = 8.25, reveal = rawFrame(first.path, revealAt);
  const circle = repair.focusGraphics![0];
  const revealFrames = sceneFramesAt(expected, repair, revealAt);
  const center = focusAnchor(repair, circle, revealFrames, stageCameraAt(expected, repair, revealAt, false, revealFrames));
  const marker = (r: number, g: number, b: number) => r < 60 && g > 68 && g < 157 && b - g > 22 && b - g < 90;
  const graphic = centerPixels(reveal, center, 27, marker);
  const caption = pixels(reveal, 40, 385, 720, 45, (r, g, b) => Math.min(r, g, b) > 210);
  const answer = pixels(reveal, 98, 19, 604, 47, (r, g, b) => r >= 200 && r <= 249 && g >= 233 && g - r >= 8 && g - b >= 9 && Math.abs(r - b) <= 8);
  expect(graphic).toBeGreaterThan(65);
  expect(caption).toBeGreaterThan(115);
  expect(answer).toBeGreaterThan(15_000);

  const follow = [1.65, 3.9].map(at => {
    const raw = rawFrame(second.path, at), center = projector(roll, at)(0, -35);
    return { at, ...center, pixels: centerPixels(raw, center, 55, magenta), cameraX: stageCameraAt(expected, roll, at).x };
  });
  expect(follow.every(point => point.pixels > 600 && point.x >= 320 && point.x <= 630)).toBe(true);
  expect(follow[1].cameraX - follow[0].cameraX).toBeGreaterThan(85);
  const rms = (at: number, span = 0.30) => {
    const start = Math.round((at + EXPORT_RECORDING_LEAD_SECONDS) * 8000), length = Math.round(span * 8000);
    let power = 0;
    for (let i = 0; i < length; i++) power += first.pcm.readFloatLE((start + i) * 4) ** 2;
    return Math.sqrt(power / length);
  };
  const voice = { beforeCut: rms(2.93), afterCut: rms(3.55), thinking: rms(5.55) };
  expect(voice.beforeCut).toBeGreaterThan(voice.thinking * 3);
  expect(voice.afterCut).toBeGreaterThan(voice.thinking * 3);
  await info.attach("decoded camera evidence", { body: JSON.stringify({
    wide: colorArea(wide), beforeCut: colorArea(beforeCut), detail: colorArea(detail), loose, graphic, caption, answer, follow, voice,
  }, null, 2), contentType: "application/json" });
  for (const [label, movie, at] of [["wide-workshop", first.path, 0.9], ["close-up", first.path, 2.93],
    ["wheel-detail", first.path, 3.66], ["wheel-reveal", first.path, revealAt], ["following-the-wagon", second.path, 3.9]] as const) {
    const path = info.outputPath(`${label}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(at + EXPORT_RECORDING_LEAD_SECONDS), "-i", movie,
      "-frames:v", "1", "-threads", "1", path]);
    await info.attach(label, { path, contentType: "image/png" });
  }

  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  const files = [first.path, second.path];
  for (const [index, file] of files.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `Add missing part ${index + 1}`, exact: true }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${index + 1} of 2 parts assigned`) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  await downloadAndVerifyMovie(page, info, files, [repair.duration, roll.duration]);
});

test("decodes the Kind Hearts opening, title, chapter, recap and readable credits in genuine numbered and joined movies", async ({ page }, info) => {
  test.setTimeout(185_000);
  const expected = storyCardDemo();
  await page.goto("./");
  await page.getByText("Try a complete episode with opening and credits", { exact: true }).click();
  await page.getByRole("button", { name: expected.title, exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const limit = 38;
  const first = await render(page, info, "kind-hearts-opening-and-story", 32, { limit, segment: 1 });
  await page.getByRole("button", { name: "Back to studio", exact: true }).click();
  const second = await render(page, info, "kind-hearts-recap-and-credits", 37, { limit, segment: 2 });
  // Use the recording’s BT.709 full-range conversion to compare against SVG colors.
  const colorFilter = "scale=in_color_matrix=bt709:in_range=full:out_range=full";
  const cardFrame = (file: string, at: number) => rawFrame(file, at, colorFilter);
  const proof = [];
  const ink = (r: number, g: number, b: number) => r >= 30 && r < 90 && g >= 15 && g < 70 && b >= 25 && b < 100;
  for (const [name, movie, at, color] of [
    ["animated-opening", first.path, 2.35, [255, 230, 175]], ["episode-one-title", first.path, 6.8, [231, 230, 250]],
    ["chapter-time-to-help", first.path, 19.35, [212, 239, 223]], ["three-lesson-points", second.path, 9.5, [252, 228, 237]],
    ["kind-goodbye", second.path, 17.2, [226, 241, 247]], ["original-credits", second.path, 29, [246, 233, 214]],
  ] as const) {
    const raw = cardFrame(movie, at);
    const paper = pixels(raw, 74, 40, 652, 366, (r, g, b) =>
      Math.abs(r - color[0]) <= 10 && Math.abs(g - color[1]) <= 10 && Math.abs(b - color[2]) <= 10);
    const letters = pixels(raw, 95, 55, 610, 300, ink);
    expect(paper, `visible card at ${name}`).toBeGreaterThan(20_000);
    expect(letters, `legible dark text at ${name}`).toBeGreaterThan(1250);
    proof.push({ name, at, paper, letters });
    const path = info.outputPath(`${name}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(at + EXPORT_RECORDING_LEAD_SECONDS),
      "-i", movie, "-vf", colorFilter, "-frames:v", "1", "-threads", "1", path]);
    await info.attach(name, { path, contentType: "image/png" });
  }

  const a = rawFrame(first.path, 0.75), b = rawFrame(first.path, 3.3);
  let moving = 0;
  for (let y = 225; y < 418; y++) for (let x = 110; x < 675; x++) {
    const i = (y * 800 + x) * 3;
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) moving++;
  }
  expect(moving).toBeGreaterThan(3500);
  const recap = rawFrame(second.path, 9.5);
  expect(pixels(recap, 32, 367, 736, 60, (r, g, b) => Math.max(r, g, b) < 52)).toBeGreaterThan(15_000);
  expect(pixels(recap, 32, 367, 736, 60, (r, g, b) => Math.min(r, g, b) > 222)).toBeGreaterThan(600);
  const averageInkY = (at: number) => {
    const raw = rawFrame(second.path, at);
    let count = 0, total = 0;
    for (let y = 70; y < 357; y++) {
      const row = pixels(raw, 185, y, 430, 1, ink);
      total += y * row; count += row;
    }
    expect(count).toBeGreaterThan(1400);
    return total / count;
  };
  expect(averageInkY(21) - averageInkY(33)).toBeGreaterThan(25);

  const rms = (pcm: Buffer, at: number) => {
    const from = Math.round((at + EXPORT_RECORDING_LEAD_SECONDS) * 8000), length = 4000;
    let energy = 0;
    for (let i = 0; i < length; i++) energy += pcm.readFloatLE((from + i) * 4) ** 2;
    return Math.sqrt(energy / length);
  };
  const audio = { opening: rms(first.pcm, 2.1), narrator: rms(first.pcm, 10.35), recap: rms(second.pcm, 8.05),
    underCredits: rms(second.pcm, 28) };
  expect(audio.opening).toBeGreaterThan(0.003);
  expect(audio.narrator).toBeGreaterThan(audio.underCredits * 2);
  expect(audio.recap).toBeGreaterThan(audio.underCredits * 2);
  await info.attach("independent title and audio measurements", { body: JSON.stringify({ proof, moving, audio }, null, 2),
    contentType: "application/json" });

  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  const files = [first.path, second.path];
  for (const [index, file] of files.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `Add missing part ${index + 1}`, exact: true }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${index + 1} of 2 parts assigned`) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  await downloadAndVerifyMovie(page, info, files, [32, 37]);
});

test("exports the voiced Little Fixers cutout puppet, chair and detail shot as genuine animation", async ({ page }, info) => {
  test.setTimeout(135_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Turn My Picture Into a Cartoon", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Turn My Picture Into a Cartoon" });
  await dialog.getByRole("button", { name: "Use the Little Fixers Club poster", exact: true }).click();
  await dialog.getByRole("button", { name: "Open the animated workshop demo", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".editor")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Little Fixers Club — The Wobbly Chair", exact: true })).toBeVisible();
  const { data } = await backup(page);
  const hosts = data.scenes.map(scene => scene.elements.find(element => element.characterId)!);
  expect(new Set(hosts.map(host => host.characterId)).size).toBe(1);
  for (const scene of data.scenes) {
    const cues = data.captions.filter(caption => caption.sceneId === scene.id);
    expect(cues.map(caption => caption.text).join(" ")).toBe(scene.script!.lines[0].text);
    expect(Math.max(...cues.map(caption => caption.text.length))).toBeLessThan(75);
  }

  const { path } = await render(page, info, "little-fixers-workshop", 34);
  const resting = rawFrame(path, 0.45);
  const pointing = rawFrame(path, 2.9);
  const beforeWobble = rawFrame(path, 3.03);
  const wobbling = rawFrame(path, 3.42);
  const measurements = {
    head: changedPixels(resting, pointing, 203, 44, 120, 86),
    arm: changedPixels(resting, pointing, 318, 88, 84, 117),
    torso: changedPixels(resting, pointing, 241, 166, 34, 30),
    background: changedPixels(resting, pointing, 635, 60, 110, 100),
    chair: changedPixels(beforeWobble, wobbling, 475, 214, 126, 129),
  };
  expect(measurements.head).toBeGreaterThan(350);
  expect(measurements.arm).toBeGreaterThan(350);
  expect(measurements.torso).toBeLessThan(measurements.arm / 3);
  expect(measurements.background).toBeLessThan(35);
  expect(measurements.chair).toBeGreaterThan(350);
  await info.attach("independently decoded motion regions", {
    body: JSON.stringify(measurements, null, 2), contentType: "application/json",
  });
  for (const [name, at] of [
    ["host-at-rest", 0.45], ["host-pointing", 2.9], ["chair-still", 3.03],
    ["chair-wobbling", 3.42], ["wide-before-cut", 14.15], ["chair-detail", 15.45],
    ["chair-set-aside", 29.0],
  ] as const) {
    const frame = info.outputPath(`${name}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(at + EXPORT_RECORDING_LEAD_SECONDS),
      "-i", path, "-frames:v", "1", "-threads", "1", frame]);
    await info.attach(name, { path: frame, contentType: "image/png" });
  }

  await page.getByRole("button", { name: "Prepare for YouTube", exact: true }).click();
  const kit = page.getByRole("dialog", { name: "Prepare for YouTube" });
  await expect(kit.getByText(/800 × 450 · WebM/)).toBeVisible();
  await expect(kit.getByText(/Opus audio track present/)).toBeVisible();
  await expect(kit.getByLabel("Series name")).toHaveValue("Little Fixers Club");
  await kit.getByRole("checkbox", { name: "Include chapters in the description" }).check();
  await kit.getByLabel("Chapter at 00:12").fill("Inspect the loose joint");
  const chapterDownload = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download chapter timestamps" }).click();
  expect(await readFile((await (await chapterDownload).path())!, "utf8"))
    .toBe("00:00 Welcome to the workshop\n00:12 Inspect the loose joint\n00:24 Repair, reuse, and rebuild\n");

  const srtDownload = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download YouTube SRT" }).click();
  const srtText = await readFile((await (await srtDownload).path())!, "utf8");
  expect(srtText).toContain("1\n00:00:00,150 --> 00:00:02,050\nWelcome, Little Fixers.");
  expect(srtText).toContain("Good looking out, Little Fixers!");
  const movieDownload = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download YouTube WebM" }).click();
  const exported = await movieDownload;
  expect(exported.suggestedFilename()).toMatch(/-youtube\.webm$/);
  const hash = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex");
  expect(await hash((await exported.path())!)).toBe(await hash(path));

  await kit.getByLabel("Frame time in seconds").fill("2.9");
  await kit.getByLabel("Thumbnail title").fill("Fix it, don't toss it!");
  await kit.getByLabel("Thumbnail colors").selectOption("green");
  await kit.getByLabel("Reposition original artwork").selectOption({ label: "Workshop host" });
  await kit.getByRole("slider", { name: "Horizontal offset" }).press("ArrowRight");
  await kit.getByRole("button", { name: "Preview thumbnail at small size" }).click();
  await expect(kit.getByAltText("Small preview of the chosen cartoon thumbnail")).toBeVisible();
  const imageDownload = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download thumbnail PNG" }).click();
  const thumbnail = await imageDownload;
  expect(thumbnail.suggestedFilename()).toMatch(/-thumbnail\.png$/);
  const imagePath = info.outputPath("little-fixers-youtube-thumbnail.png");
  await thumbnail.saveAs(imagePath);
  const imageProbe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
    "stream=codec_name,width,height", "-of", "json", imagePath], { encoding: "utf8" }));
  expect(imageProbe.streams).toEqual([{ codec_name: "png", width: 1280, height: 720 }]);
  await info.attach("Little Fixers YouTube thumbnail", { path: imagePath, contentType: "image/png" });
});

test("decodes the complete Little Fixers episode opening with speaking, wobble, and a thinking pause", async ({ page }, info) => {
  test.setTimeout(205_000);
  await openLittleFixersOpening(page);
  const { path, pcm } = await render(page, info, "little-fixers-episode-1-opening", 119);
  const rest = rawFrame(path, 0.45), gesture = rawFrame(path, 2.22);
  const still = rawFrame(path, 2.98), wobble = rawFrame(path, 3.43);
  const wide = rawFrame(path, 31.5), detail = rawFrame(path, 36.05);
  const chairColor = (r: number, g: number, b: number) => r >= 144 && r - g >= 38 && g - b >= 20;
  const motion = {
    head: changedPixels(rest, gesture, 185, 38, 130, 103),
    arm: changedPixels(rest, gesture, 304, 91, 95, 118),
    backdrop: changedPixels(rest, gesture, 703, 49, 75, 100),
    chair: changedPixels(still, wobble, 473, 214, 126, 128),
    wideJoint: pixels(wide, 295, 110, 213, 168, chairColor),
    closeJoint: pixels(detail, 295, 110, 213, 168, chairColor),
  };
  expect(motion.head).toBeGreaterThan(350);
  expect(motion.arm).toBeGreaterThan(350);
  expect(motion.backdrop).toBeLessThan(45);
  expect(motion.chair).toBeGreaterThan(350);
  expect(motion.closeJoint - motion.wideJoint).toBeGreaterThan(1800);
  function rms(start: number, end: number) {
    const first = Math.round((start + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
    const last = Math.round((end + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
    let energy = 0;
    for (let sample = first; sample < last; sample++) energy += pcm.readFloatLE(sample * 4) ** 2;
    return Math.sqrt(energy / (last - first));
  }
  const audio = { question: rms(86, 88), thinking: rms(91.1, 94.6), answer: rms(95.65, 98) };
  expect(audio.question).toBeGreaterThan(0.015);
  expect(audio.answer).toBeGreaterThan(0.015);
  expect(audio.thinking).toBeLessThan(0.005);
  await info.attach("decoded opening measurements", {
    body: JSON.stringify({ motion, audio }, null, 2), contentType: "application/json",
  });
  for (const [name, at] of [["wobble", 3.43], ["joint-detail", 36.05], ["episode-title", 64],
    ["thinking-pause", 92], ["safe-answer", 97], ["workbench", 113]] as const) {
    const frame = info.outputPath(`${name}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-ss", String(at + EXPORT_RECORDING_LEAD_SECONDS), "-i", path,
      "-frames:v", "1", "-threads", "1", frame]);
    await info.attach(name, { path: frame, contentType: "image/png" });
  }

  await page.getByRole("button", { name: "Prepare for YouTube", exact: true }).click();
  const kit = page.getByRole("dialog", { name: "Prepare for YouTube" });
  await expect(kit.getByText(/Opus audio track present/)).toBeVisible();
  await expect(kit.getByRole("button", { name: "Download YouTube WebM", exact: true })).toBeEnabled();
  const srtDownload = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download YouTube SRT", exact: true }).click();
  const srt = await readFile((await (await srtDownload).path())!, "utf8");
  expect(srt).toContain("00:00:00,750 -->");
  expect(srt).toContain("00:01:35,450 -->");
  expect(srt).toContain("Ask a grown-up. Leave the chair alone until it's checked.");
});


test("exports genuine Safety First motion and non-silent sound without claiming voice takes", async ({ page }, info) => {
  test.setTimeout(210_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Turn My Picture Into a Cartoon", exact: true }).click();
  const picture = page.getByRole("dialog", { name: "Turn My Picture Into a Cartoon" });
  await picture.getByRole("button", { name: "Use the Little Fixers Club poster", exact: true }).click();
  await picture.getByRole("button", {
    name: "Open animated Safety First (3:00; new voice to record)", exact: true,
  }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const { data } = await backup(page);
  const cuts = data.scenes.slice(8);
  expect(cuts.map(scene => scene.duration)).toEqual([31, 30]);
  expect(cuts.flatMap(scene => scene.script?.lines ?? []).every(line => line.takes.length === 0)).toBe(true);

  // Desktop exports the independently authored 61s animation as one real segment.
  // Keep the approved 119s opening unmodified and verify actual encoded output.
  const { path } = await render(page, info, "little-fixers-safety-first", 61, { limit: 120, segment: 2 });
  const blocked = rawFrame(path, 16);
  const cleared = rawFrame(path, 27);
  const activity = changedPixels(blocked, cleared, 245, 150, 500, 275);
  expect(activity).toBeGreaterThan(800);
  const begin = info.outputPath("safety-before.png");
  const end = info.outputPath("safety-after.png");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(16 + EXPORT_RECORDING_LEAD_SECONDS),
    "-i", path, "-frames:v", "1", "-threads", "1", begin]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(27 + EXPORT_RECORDING_LEAD_SECONDS),
    "-i", path, "-frames:v", "1", "-threads", "1", end]);
  await info.attach("Safety First blocked walkway", { path: begin, contentType: "image/png" });
  await info.attach("Safety First clear walkway", { path: end, contentType: "image/png" });
});


test("decodes real animated Meet the Tools video with checklist movement and audible effects", async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Turn My Picture Into a Cartoon", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Turn My Picture Into a Cartoon" });
  await dialog.getByRole("button", { name: "Use the Little Fixers Club poster", exact: true }).click();
  await dialog.getByRole("button", {
    name: "Open animated Meet the Tools (4:00; new voices to record)", exact: true,
  }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const { data } = await backup(page);
  expect(data.scenes.map(s => s.duration).slice(-2)).toEqual([30, 30]);
  expect(data.scenes.slice(-2).flatMap(s => s.script?.lines ?? [])
    .every(line => line.takes.length === 0)).toBe(true);
  // Desktop segments are 119 seconds of the original opening, 91 seconds of
  // Safety First + Tools part one, and 30 seconds of Tools part two.
  const { path } = await render(page, info, "little-fixers-tools-counting", 30,
    { segment: 3, limit: 120 });
  const early = rawFrame(path, 4.0);
  const later = rawFrame(path, 15.5);
  const changed = changedPixels(early, later, 210, 65, 545, 340);
  expect(changed).toBeGreaterThan(700);
  await info.attach("Independent Tools animated frame difference", {
    body: JSON.stringify({ changedPixels: changed, frameTimes: [4.0, 15.5] }, null, 2),
    contentType: "application/json",
  });
});


test("exports an original full-body vector cartoon walking in a layered workshop", async ({ page }, info) => {
  test.setTimeout(140_000);
  await page.goto("./");
  await page.getByRole("button", {
    name: "Try the full-body cartoon workshop", exact: true,
  }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const { data } = await backup(page);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.characters[0].puppet?.costume).toBe("workshop");
  // Actual browser-recorded WebM with an Opus sound track: not a storyboard
  // slideshow, static sketch, screenshot, or unverified export button.
  const { path } = await render(page, info, "little-fixers-full-body-cartoon", 34);
  const first = rawFrame(path, 1.5);
  const walking = rawFrame(path, 7.4);
  const noticing = rawFrame(path, 20.8);
  const walkMotion = changedPixels(first, walking, 115, 75, 570, 365);
  const performance = changedPixels(walking, noticing, 115, 75, 570, 365);
  expect(walkMotion).toBeGreaterThan(1000);
  expect(performance).toBeGreaterThan(1000);
  await info.attach("Independent full-body walk and camera motion measurements", {
    body: JSON.stringify({ walkMotion, performance }, null, 2),
    contentType: "application/json",
  });
});


test("exports real talking Scout with approved voice, expressive mouth movement and timed captions", async ({ page }, info) => {
  test.setTimeout(160_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Watch Scout walk and talk", exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const { data } = await backup(page);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  expect(data.scenes[0].duration).toBe(34);
  const actor = data.scenes[0].elements.find(item => item.characterId);
  expect(actor?.voiceMouth).toHaveLength(3);
  expect(data.scenes[0].script?.lines).toHaveLength(3);
  expect(data.captions.length).toBeGreaterThanOrEqual(3);

  // Browser produces independently decodable VP8 video + Opus audio,
  // with no poster and a full-body walk cycle, not still screenshots.
  const { path, pcm } = await render(page, info, "scout-walks-and-talks", 34);
  const arrival = rawFrame(path, 2.3);
  const walking = rawFrame(path, 9.1);
  const speaking = rawFrame(path, 21.6);
  expect(changedPixels(arrival, walking, 100, 72, 570, 380)).toBeGreaterThan(900);
  expect(changedPixels(walking, speaking, 100, 72, 570, 380)).toBeGreaterThan(900);
  function rms(start: number, end: number) {
    const first = Math.floor((start + EXPORT_RECORDING_LEAD_SECONDS) * 8000),
      last = Math.floor((end + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
    let energy = 0;
    for (let i = first; i < last; i++) energy += pcm.readFloatLE(i * 4) ** 2;
    return Math.sqrt(energy / (last - first));
  }
  const voiced = { greeting: rms(1.3, 2.4), secondLesson: rms(21.4, 22.5) };
  expect(voiced.greeting).toBeGreaterThan(0.012);
  expect(voiced.secondLesson).toBeGreaterThan(0.012);
  await info.attach("Scout original voiced performance measurements", {
    body: JSON.stringify(voiced, null, 2), contentType: "application/json",
  });
  await page.getByRole("button", { name: "Prepare for YouTube", exact: true }).click();
  const kit = page.getByRole("dialog", { name: "Prepare for YouTube" });
  await expect(kit.getByText(/Opus audio track present/)).toBeVisible();
  const download = page.waitForEvent("download");
  await kit.getByRole("button", { name: "Download YouTube SRT", exact: true }).click();
  const srt = await readFile((await (await download).path())!, "utf8");
  expect(srt).toContain("Welcome to the Little Fixers Club!");
  expect(srt).toContain("Fixing starts with a plan");
});


test("exports real one-minute Scout cartoon with spoken opening and hand-carried checklist", async ({ page }, info) => {
  test.setTimeout(170_000);
  await page.goto("./");
  await page.getByRole("button", {
    name: "Watch Scout pick up a checklist (1:00)", exact: true,
  }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const { data } = await backup(page);
  expect(data.scenes.map(scene => scene.duration)).toEqual([34, 26]);
  expect(data.pictureSourceId).toBeUndefined();
  const scene = data.scenes[1];
  const carried = sceneFramesAt(data, scene, 9);
  const book = scene.elements.find(element => element.prop === "book")!;
  expect(carried.get(book.id)?.heldBy).toBe(scene.elements.find(element => element.characterId)?.id);
  expect(scene.script?.lines.every(line => line.takes.length === 0)).toBe(true);

  // Independent decoded VP8 frames and real Opus audio, not a slide show.
  // At 60 seconds this remains a single phone-safe movie.
  const { path, pcm } = await render(page, info, "scout-lifts-checklist", 60, { limit: 60 });
  const approach = rawFrame(path, 37.5);
  const pickup = rawFrame(path, 44.2);
  const placed = rawFrame(path, 51.2);
  const liftedPixels = changedPixels(approach, pickup, 185, 80, 555, 370);
  const placedPixels = changedPixels(pickup, placed, 185, 80, 555, 370);
  expect(liftedPixels).toBeGreaterThan(650);
  expect(placedPixels).toBeGreaterThan(650);
  function rms(a: number, b: number) {
    const begin = Math.floor((a + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
    const end = Math.floor((b + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
    let power = 0;
    for (let i = begin; i < end; i++) power += pcm.readFloatLE(i * 4) ** 2;
    return Math.sqrt(power / (end - begin));
  }
  const greetingSpeech = rms(1.3, 2.4);
  expect(greetingSpeech).toBeGreaterThan(0.012);
  await info.attach("Scout real-video performance and checklist action", {
    body: JSON.stringify({ liftedPixels, placedPixels, greetingSpeech }, null, 2),
    contentType: "application/json",
  });
});


test("encodes a real 90-second Scout story with visibly wobbling chair and audible original speech", async ({ page }, info) => {
  test.setTimeout(200_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Watch Scout and the wobbly chair (1:30)", exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  const { data } = await backup(page);
  expect(data.scenes.map(scene => scene.duration)).toEqual([34, 26, 30]);
  expect(data.pictureSourceId).toBeUndefined();
  expect(data.assets).toHaveLength(0);
  const chair = data.scenes[2].elements.find(e => e.prop === "chair")!;
  const scout = data.scenes[2].elements.find(e => e.characterId === data.characters[0].id)!;
  expect(sceneFramesAt(data, data.scenes[2], 7.25).get(chair.id)?.rotation).toBeLessThan(-1);
  expect(sceneFramesAt(data, data.scenes[2], 13.8).get(scout.id)?.x)
    .toBeLessThan(sceneFramesAt(data, data.scenes[2], 6).get(scout.id)!.x);
  // Exports a real 90-second VP8/Opus WebM including the third scene, not
  // selected screenshots or a photo slide show. Keeps the original three
  // approved speech takes; new scene dialogue is intentionally unrecorded.
  const { path, pcm } = await render(page, info, "scout-notices-wobbly-chair", 90);
  const approaching = rawFrame(path, 63);
  const wobbling = rawFrame(path, 68);
  const reacting = rawFrame(path, 72);
  const pointing = rawFrame(path, 82);
  const movement = changedPixels(approaching, wobbling, 130, 74, 650, 400);
  const reaction = changedPixels(wobbling, reacting, 130, 74, 650, 400);
  const resolution = changedPixels(reacting, pointing, 130, 74, 650, 400);
  expect(movement).toBeGreaterThan(650);
  expect(reaction).toBeGreaterThan(650);
  expect(resolution).toBeGreaterThan(650);

  const first = Math.floor((1.3 + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
  const last = Math.floor((2.4 + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
  let energy = 0;
  for (let i = first; i < last; i++) energy += pcm.readFloatLE(i * 4) ** 2;
  const rms = Math.sqrt(energy / (last - first));
  expect(rms).toBeGreaterThan(0.012);
  await info.attach("Scout's genuine wobbly-chair animation and original voice proof", {
    body: JSON.stringify({ movement, reaction, resolution, approvedSpeechRms: rms }, null, 2),
    contentType: "application/json",
  });
});


test("real two-minute Scout and Helper Jo movie shows two-person entrance and checklist transfer", async ({ page }, info) => {
  test.setTimeout(270_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Watch Scout meet Helper Jo (2:00)", exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 55_000 });
  const { data } = await backup(page);
  expect(data.scenes.map(scene => scene.duration)).toEqual([34, 26, 30, 30]);
  expect(data.assets).toHaveLength(0);
  const scene = data.scenes[3];
  const book = scene.elements.find(element => element.prop === "book")!;
  const scout = scene.elements.find(element => element.characterId === data.characters[0].id)!;
  const jo = scene.elements.find(element => element.characterId === data.characters[1].id)!;
  expect(sceneFramesAt(data, scene, 13).get(book.id)?.heldBy).toBe(scout.id);
  expect(sceneFramesAt(data, scene, 17).get(book.id)?.heldBy).toBe(jo.id);
  expect(sceneFramesAt(data, scene, 24).get(book.id)?.heldBy).toBeUndefined();
  expect(scene.script?.lines.every(line => line.takes.length === 0)).toBe(true);
  // Full 120-second original VP8/Opus is actually recorded and independently
  // decoded by ffmpeg. Jo and Scout are active puppet rigs, not cutout images.
  const { path, pcm } = await render(page, info, "scout-helper-jo-two-character-story", 120);
  const before = rawFrame(path, 92);
  const approaching = rawFrame(path, 99);
  const handoff = rawFrame(path, 107);
  const adultListens = rawFrame(path, 117);
  const entrance = changedPixels(before, approaching, 180, 65, 720, 425);
  const transfer = changedPixels(approaching, handoff, 180, 65, 720, 425);
  const reaction = changedPixels(handoff, adultListens, 180, 65, 720, 425);
  expect(entrance).toBeGreaterThan(600);
  expect(transfer).toBeGreaterThan(600);
  expect(reaction).toBeGreaterThan(600);
  const from = Math.floor((1.3 + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
  const to = Math.floor((2.4 + EXPORT_RECORDING_LEAD_SECONDS) * 8000);
  let sum = 0;
  for (let i = from; i < to; i++) sum += pcm.readFloatLE(i * 4) ** 2;
  const voiceRms = Math.sqrt(sum / (to - from));
  expect(voiceRms).toBeGreaterThan(0.012);
  await info.attach("real-two-character-movie-proof", {
    body: JSON.stringify({ entrance, transfer, reaction, originalVoiceRms: voiceRms }, null, 2),
    contentType: "application/json",
  });
});
