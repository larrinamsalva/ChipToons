import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { applyDirections, createAssistantDraft, PLAYGROUND_BRIEF } from "../src/assistant";
import { starterProject } from "../src/demo-starter";
import { segmentedProject } from "./creator-fixtures";
import { backup } from "./production-helpers";
import { cameraAt, elementAt, retimeScene } from "../src/timeline";
import { emptyProduction } from "../src/media-model";
import { builtInSound } from "../src/sounds";
import { newAudioClip } from "../src/production";
import { imageLibraryItem, placeLibraryItem } from "../src/library";
import { uid } from "../src/model";
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
