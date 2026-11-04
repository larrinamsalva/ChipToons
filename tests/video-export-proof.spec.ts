import { gardenInteractionDemo } from "../src/garden-demo";
import { stagePoint } from "../src/interaction-motion";
import { kindHeartsCrew } from "../src/series-starter";
import { episodeBrief } from "../src/series";
import { sunnyCartoon } from "../src/puppet-project";
import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyDirections, createAssistantDraft, PLAYGROUND_BRIEF } from "../src/assistant";
import { starterProject } from "../src/demo-starter";
import { movieProofArtwork, segmentedProject } from "./creator-fixtures";
import { downloadAndVerifyMovie } from "./single-movie-proof";
import { backup } from "./production-helpers";
import { cameraAt, duplicateAnimatedScene, elementAt, retimeScene, sceneElementAt, sceneFramesAt } from "../src/timeline";
import { emptyProduction } from "../src/media-model";
import { builtInSound } from "../src/sounds";
import { newAudioClip } from "../src/production";
import { imageLibraryItem, placeLibraryItem } from "../src/library";
import { starterLocations } from "../src/world-starters";
import { makeScene, uid } from "../src/model";
import { demo, restore } from "./production-helpers";

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
  await restore(page, segmentedProject(movieProofArtwork));
  await page.getByRole("button", { name: "Finish My Cartoon", exact: true }).click();
  const limit = page.getByRole("spinbutton", { name: "Maximum seconds per segment", exact: true });
  await limit.fill("4");
  await limit.press("Enter");
  await page.getByRole("checkbox", { name: "Include mixed audio", exact: true }).uncheck();
  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
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
