import { execFileSync } from "node:child_process";
import { expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

const RATE = 8000;
function ffmpeg(args: string[]) {
  return execFileSync("ffmpeg", ["-v", "error", "-xerror", ...args], { maxBuffer: 48 * 1024 * 1024 });
}
function frameHashes(path: string) {
  return ffmpeg(["-i", path, "-map", "0:v:0", "-fps_mode", "passthrough", "-f", "framemd5", "-"])
    .toString().split("\n").filter(row => row && !row.startsWith("#")).map(row => row.split(",").at(-1)!.trim());
}
function sourceTiming(path: string) {
  const probe: {
    format: { duration: string };
    packets: { stream_index: number; pts_time: string; duration_time?: string }[];
  } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
    "packet=stream_index,pts_time,duration_time:format=duration", "-of", "json", path],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }));
  const duration = Number(probe.format.duration);
  const end = probe.packets.reduce((latest, packet) => {
    // FFprobe can infer a duration for the last picture from nominal frame
    // rate. Its timestamp is authoritative when the source has no block duration.
    const audioDuration = packet.stream_index === 0 ? 0 : Number(packet.duration_time ?? 0);
    return Math.max(latest, Number(packet.pts_time) + audioDuration);
  }, duration);
  const times = probe.packets.filter(packet => packet.stream_index === 0).map(packet => Number(packet.pts_time));
  return { duration, end, times };
}
function pcm(path: string) {
  const raw = ffmpeg(["-copyts", "-i", path, "-vn", "-af", `aresample=${RATE}:async=1:first_pts=0`,
    "-ar", String(RATE), "-ac", "1", "-f", "f32le", "-"]);
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}
function audioMatch(source: Float32Array, movie: Float32Array, start: number, position: number, span: number) {
  const from = Math.round(position * RATE);
  const target = Math.round((start + position) * RATE);
  const length = Math.round(span * RATE);
  let energy = 0;
  for (let i = 0; i < length; i++) energy += source[from + i] ** 2;
  expect(energy).toBeGreaterThan(1e-5);
  let correlation = -1, samples = 0, ratio = 0;
  for (let shift = -RATE * 0.035; shift <= RATE * 0.035; shift++) {
    let dot = 0, joinedEnergy = 0;
    for (let i = 0; i < length; i++) {
      const actual = movie[target + shift + i];
      dot += source[from + i] * actual;
      joinedEnergy += actual ** 2;
    }
    const match = dot / Math.sqrt(energy * joinedEnergy);
    if (match > correlation) {
      correlation = match;
      samples = shift;
      ratio = Math.sqrt(joinedEnergy / energy);
    }
  }
  expect(correlation).toBeGreaterThan(0.85);
  expect(Math.abs(samples / RATE)).toBeLessThanOrEqual(0.025);
  expect(ratio).toBeGreaterThan(0.75);
  expect(ratio).toBeLessThan(1.25);
  return { position, correlation, delay: samples / RATE, rmsRatio: ratio };
}

export function verifyJoinedMedia(path: string, sources: string[], plannedLengths: number[], withAudio: boolean) {
  const packets = execFileSync("ffprobe", ["-v", "error", "-show_entries", "packet=stream_index,pts_time,flags",
    "-of", "csv=p=0", path], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const videoPackets: { time: number; key: boolean }[] = [];
  let lastVideo = -1, lastAudio = -1;
  for (const row of packets.trim().split("\n")) {
    const [track, pts, flags] = row.split(",");
    if (track !== "0" && track !== "1") continue;
    const time = Number(pts);
    if (track === "0") {
      if (!(time > lastVideo)) throw new Error(`Non-monotonic video timestamp ${time} after ${lastVideo}`);
      lastVideo = time;
      videoPackets.push({ time, key: flags.startsWith("K") });
    } else {
      if (!(time > lastAudio)) throw new Error(`Non-monotonic audio timestamp ${time} after ${lastAudio}`);
      lastAudio = time;
    }
  }
  if (withAudio) expect(lastAudio).toBeGreaterThan(0);
  else expect(lastAudio).toBe(-1);
  const format = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", path],
    { encoding: "utf8" }));
  expect(format.streams.map((stream: { codec_name: string }) => stream.codec_name)).toEqual(withAudio ? ["vp8", "opus"] : ["vp8"]);
  const duration = Number(format.format.duration);
  const total = plannedLengths.reduce((n, part) => n + part, 0);
  expect(Math.abs(duration - total)).toBeLessThanOrEqual(sources.length * 0.6 + 0.06);
  const frames = frameHashes(path);
  const audio = withAudio ? pcm(path) : undefined;
  let offset = 0;
  const parts = sources.map((source, index) => {
    const picture = frameHashes(source);
    expect(frames.slice(offset, offset + picture.length)).toEqual(picture);
    const first = videoPackets[offset];
    expect(first.key).toBe(true);
    const start = first.time;
    const { duration: reportedDuration, end: sourceEnd, times } = sourceTiming(source);
    expect(times).toHaveLength(picture.length);
    expect(times.every((time, index) => Math.abs(time + start - videoPackets[offset + index].time) <= 0.002)).toBe(true);
    offset += picture.length;
    const length = plannedLengths[index];
    expect(Math.abs(reportedDuration - length)).toBeLessThanOrEqual(0.3);
    const outputLength = (videoPackets[offset]?.time ?? duration) - start;
    expect(outputLength).toBeGreaterThanOrEqual(sourceEnd - 0.02);
    expect(outputLength).toBeLessThanOrEqual(sourceEnd + 0.12);
    const samples = [];
    if (audio) {
      const sound = pcm(source);
      const scenes = length > 20 ? Array.from({ length: Math.floor(length / 20) - 1 }, (_, i) => (i + 1) * 20 + 0.2) : [length / 2 + 0.05];
      const times = [0.2, ...scenes, sound.length / RATE - 0.3];
      for (const time of times) samples.push(audioMatch(sound, audio, start, time, 0.26));
    }
    return { start, outputLength, sourceEnd, reportedDuration, frames: picture.length, samples };
  });
  expect(offset).toBe(frames.length);
  expect(offset).toBe(videoPackets.length);
  return { duration, frames: frames.length, parts, width: format.streams[0].width as number, height: format.streams[0].height as number };
}

export async function checkReopenedMovie(page: Page, path: string, points: number[]) {
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "reopen-verified-single-movie";
    input.hidden = true;
    document.body.append(input);
  });
  const picker = page.locator("#reopen-verified-single-movie");
  await picker.setInputFiles(path);
  return picker.evaluate(async (input: HTMLInputElement, points) => {
    const url = URL.createObjectURL(input.files![0]);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    function event(type: string) {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Reopened movie timed out during ${type}`)), 7000);
        video.addEventListener(type, () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    try {
      const loaded = event("loadeddata");
      video.src = url;
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 22;
      const ctx = canvas.getContext("2d")!;
      const decoded: { time: number; picture: number }[] = [];
      for (const time of points) {
        const seek = event("seeked");
        video.currentTime = time;
        await seek;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        decoded.push({ time: video.currentTime, picture: rgba.reduce((hash, value) => (hash * 31 + value) >>> 0, 0) });
      }
      const beforeJoin = event("seeked");
      video.currentTime = points[1] - 0.04;
      await beforeJoin;
      await video.play();
      while (video.currentTime < points[2]) await event("timeupdate");
      const played = video.currentTime;
      return { duration: video.duration, decoded, played, width: video.videoWidth, height: video.videoHeight };
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      input.remove();
    }
  }, points);
}

export async function downloadAndVerifyMovie(page: Page, info: TestInfo, paths: string[], lengths: number[], withAudio = true) {
  const ready = page.getByRole("status").filter({ hasText: /Movie ready/ });
  const failure = page.locator(".delivery-studio > [role=alert]");
  await expect(ready.or(failure)).toBeVisible({ timeout: 150_000 });
  if (await failure.isVisible()) throw new Error(await failure.innerText());
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Complete Movie", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/-complete\.webm$/);
  const path = info.outputPath(file.suggestedFilename());
  await file.saveAs(path);
  const media = verifyJoinedMedia(path, paths, lengths, withAudio);
  const points = [0.1, ...media.parts.slice(1).flatMap(part => [part.start - 0.05, part.start + 0.25]), media.duration - 0.25];
  const playback = await checkReopenedMovie(page, path, points);
  expect(Math.abs(playback.duration - media.duration)).toBeLessThan(0.05);
  playback.decoded.forEach((frame, index) => expect(frame.time).toBeCloseTo(points[index], 3));
  expect(new Set(playback.decoded.map(frame => frame.picture)).size).toBeGreaterThan(2);
  expect(playback.played).toBeGreaterThanOrEqual(points[2]);
  await info.attach("complete-continuous-movie", { path, contentType: "video/webm" });
  await info.attach("continuous-movie-verification", { body: JSON.stringify({ media, playback }, null, 2), contentType: "application/json" });
  return media;
}
