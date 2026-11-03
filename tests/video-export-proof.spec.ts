import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { starterProject } from "../src/planner";
import { retimeScene } from "../src/timeline";
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
  } = {},
) {
  const width = options.width ?? 800,
    height = (width * 450) / 800;
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
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
    .getByRole("button", { name: "Export complete cartoon", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your movie is ready", exact: true }),
  ).toBeVisible({ timeout: (seconds + 35) * 1000 });
  const video = page.getByLabel("Completed cartoon video");
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
    .getByRole("button", { name: "Download completed video", exact: true })
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
