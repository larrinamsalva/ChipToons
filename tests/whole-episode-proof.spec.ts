import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createEpisodeFixture, inspectEpisodePackage } from "./episode-fixture";
import { planSegments } from "../src/segments";
import { srt } from "../src/production";
import { saved } from "./production-helpers";

// Dedicated real-time proof. Run npm run test:episode (about 23 minutes), not a skipped test.
function pcm(path: string | Buffer) {
  return execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      typeof path === "string" ? path : "pipe:0",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "8000",
      "-f",
      "f32le",
      "pipe:1",
    ],
    {
      input: typeof path === "string" ? undefined : path,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
}
function alignment(reference: Buffer, movie: Buffer, sceneOffset: number) {
  const sampleStart = 8000,
    count = 16000;
  let best = { correlation: -1, delay: 0 };
  // Compare actual speech waveform to decoded Opus; low original music remains mixed in.
  for (let lag = -800; lag <= 4800; lag += 8) {
    const start = Math.round(sceneOffset * 8000) + sampleStart + lag;
    if (start < 0 || (start + count) * 4 > movie.length) continue;
    let dot = 0,
      a2 = 0,
      b2 = 0;
    for (let j = 0; j < count; j += 4) {
      const a = reference.readFloatLE((sampleStart + j) * 4),
        b = movie.readFloatLE((start + j) * 4);
      dot += a * b;
      a2 += a * a;
      b2 += b * b;
    }
    const correlation = dot / Math.sqrt(a2 * b2 || 1);
    if (correlation > best.correlation)
      best = { correlation, delay: lag / 8000 };
  }
  return best;
}
async function completeBackup(page: import("@playwright/test").Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Project backup", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.ctepisode$/);
  const bytes = await readFile((await download.path())!);
  return { bytes, manifest: inspectEpisodePackage(bytes) };
}

test("a complete twenty-minute narrated episode survives reload, portable restoration and all ten genuine WebM parts", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(29 * 60_000);
  const directory = info.outputPath("episode");
  mkdirSync(directory, { recursive: true });
  const fixture = createEpisodeFixture(directory),
    original = fixture.project;
  expect(
    original.audioAssets.filter((a) => a.name.startsWith("Original narration")),
  ).toHaveLength(60);
  expect(new Set(original.audioAssets.map((a) => a.file!.sha256)).size).toBe(
    original.audioAssets.length,
  );
  expect(
    original.audioAssets.slice(0, 60).reduce((n, a) => n + a.duration, 0),
  ).toBe(1200);
  const sourceHashes = original.audioAssets.map((a) => a.file!.sha256);
  await page.addInitScript(() => {
    const originalDecode = AudioContext.prototype.decodeAudioData;
    const counters = { calls: 0, seconds: 0 };
    Object.assign(window, { episodeDecodes: counters });
    AudioContext.prototype.decodeAudioData = async function (
      bytes: ArrayBuffer,
    ) {
      const buffer = await originalDecode.call(this, bytes);
      counters.calls++;
      counters.seconds += buffer.duration;
      return buffer;
    };
  });
  await page.goto("./");
  await page
    .getByLabel("Restore project backup file")
    .setInputFiles(fixture.path);
  await expect(page.locator(".editor")).toBeVisible({ timeout: 30_000 });
  await saved(page);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { episodeDecodes: { calls: number } })
          .episodeDecodes.calls,
    ),
  ).toBe(0);
  const before = await completeBackup(page);
  expect(before.manifest.project.scenes).toEqual(original.scenes);
  expect(
    before.manifest.files.map((f: { sha256: string }) => f.sha256),
  ).toEqual(sourceHashes);
  await page.reload();
  await page
    .getByRole("button", { name: `Continue ${original.title}`, exact: true })
    .click();
  await expect(page.locator(".editor")).toBeVisible();
  expect((await completeBackup(page)).manifest.project.audioClips).toEqual(
    original.audioClips,
  );
  const context = await browser.newContext(),
    restoredPage = await context.newPage();
  try {
    await restoredPage.goto(page.url());
    await restoredPage
      .getByLabel("Restore project backup file")
      .setInputFiles({
        name: "complete-garden.ctepisode",
        mimeType: "application/octet-stream",
        buffer: before.bytes,
      });
    await expect(restoredPage.locator(".editor")).toBeVisible({
      timeout: 30_000,
    });
    const restored = await completeBackup(restoredPage);
    expect(restored.manifest.project.id).not.toBe(before.manifest.project.id);
    expect(restored.manifest.project.scenes).toEqual(original.scenes);
    expect(restored.manifest.project.audioClips).toEqual(original.audioClips);
    expect(restored.manifest.project.captions).toEqual(original.captions);
    expect(
      restored.manifest.files.map((f: { sha256: string }) => f.sha256),
    ).toEqual(sourceHashes);
  } finally {
    await context.close();
  }
  await page
    .getByRole("button", { name: "Production step: Preview", exact: true })
    .click();
  // Exercise windowed preview across its first prefetch boundary, with actual sound.
  await page.getByRole("checkbox", { name: "Sound", exact: true }).check();
  await page.getByRole("button", { name: "Play cartoon", exact: true }).click();
  await expect
    .poll(
      async () => {
        const text = await page.locator(".time-display").innerText();
        return Number(text.match(/(\d+):(\d+)/)?.[2] ?? 0);
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(10);
  await page
    .getByRole("button", { name: "Pause cartoon", exact: true })
    .click();
  const previewDecode = await page.evaluate(
    () =>
      (
        window as unknown as {
          episodeDecodes: { calls: number; seconds: number };
        }
      ).episodeDecodes,
  );
  expect(previewDecode.calls).toBeGreaterThan(0);
  expect(previewDecode.calls).toBeLessThan(8);
  expect(previewDecode.seconds).toBeLessThan(120);
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await expect(
    page.getByText(/60\/60 scenes with assigned voices/),
  ).toBeVisible();
  const plan = planSegments(original, 120);
  expect(plan.oversized).toEqual([]);
  expect(plan.segments).toHaveLength(10);
  const measures = [];
  for (const [index, segment] of plan.segments.entries()) {
    const part = index + 1;
    if (index === 0) {
      await page
        .getByRole("button", { name: "Export segment 1", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Cancel this segment", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Cancel this segment", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Retry segment 1", exact: true }),
      ).toBeEnabled();
    }
    const button = page.getByRole("button", {
      name: `${index === 0 ? "Retry" : "Export"} segment ${part}`,
      exact: true,
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(
      page.getByRole("heading", {
        name: `Segment ${part} is ready`,
        exact: true,
      }),
    ).toBeVisible({ timeout: 160_000 });
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `Download segment ${part}`, exact: true })
      .click();
    const movie = await pending,
      path = info.outputPath(
        `garden-part-${String(part).padStart(2, "0")}.webm`,
      );
    expect(movie.suggestedFilename()).toContain(
      `part-${String(part).padStart(2, "0")}-scenes-${segment.firstScene + 1}-${segment.lastScene + 1}`,
    );
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
      ),
      picture = probe.streams.find(
        (s: { codec_type: string }) => s.codec_type === "video",
      ),
      audio = probe.streams.find(
        (s: { codec_type: string }) => s.codec_type === "audio",
      ),
      decoded = pcm(path);
    expect(picture).toMatchObject({
      codec_name: "vp8",
      width: 800,
      height: 450,
    });
    expect(audio).toMatchObject({ codec_name: "opus" });
    expect(Number(probe.format.duration)).toBeGreaterThanOrEqual(119.9);
    expect(Number(probe.format.duration)).toBeLessThan(121);
    expect(Number(picture.nb_read_frames)).toBeGreaterThan(120 * 8);
    let energy = 0;
    for (let j = 0; j < decoded.length; j += 4)
      energy += decoded.readFloatLE(j) ** 2;
    const rms = Math.sqrt(energy / (decoded.length / 4));
    expect(rms).toBeGreaterThan(0.005);
    const voiceAlignment = [segment.firstScene, segment.lastScene].map(
      (scene) =>
        alignment(
          pcm(fixture.originals.get(original.audioAssets[scene].id)!),
          decoded,
          (scene - segment.firstScene) * 20,
        ),
    );
    for (const match of voiceAlignment) {
      expect(match.correlation).toBeGreaterThan(0.7);
      expect(Math.abs(match.delay)).toBeLessThan(0.3);
    }
    expect(
      Math.abs(voiceAlignment[0].delay - voiceAlignment[1].delay),
    ).toBeLessThan(0.06);
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
      .map((s) => s.split(",").at(-1));
    expect(new Set(hashes).size).toBeGreaterThan(60);
    const subtitle = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `Segment ${part} subtitles`, exact: true })
      .click();
    const captionText = await readFile(
      (await (await subtitle).path())!,
      "utf8",
    );
    expect(captionText).toBe(srt(original, segment));
    const frame = info.outputPath(`garden-part-${part}-decoded.png`);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      path,
      "-ss",
      "1",
      "-frames:v",
      "1",
      frame,
    ]);
    await info.attach(`part-${part}-frame`, {
      path: frame,
      contentType: "image/png",
    });
    await info.attach(`part-${part}-complete-video`, {
      path,
      contentType: "video/webm",
    });
    measures.push({
      part,
      scenes: [segment.firstScene + 1, segment.lastScene + 1],
      storyStart: segment.start,
      storyEnd: segment.end,
      duration: Number(probe.format.duration),
      frames: Number(picture.nb_read_frames),
      rms,
      voiceAlignment,
      distinctFrames: new Set(hashes).size,
    });
    await page
      .getByRole("button", { name: "Close segment preview", exact: true })
      .click();
  }
  await info.attach("twenty-minute-finish", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page
    .getByRole("button", { name: "Back to studio", exact: true })
    .click();
  const after = await completeBackup(page);
  expect(after.manifest.project).toEqual(before.manifest.project);
  expect(after.manifest.files).toEqual(before.manifest.files);
  const measurements = {
    title: original.title,
    logicalSeconds: 1200,
    originalNarrationSeconds: 1200,
    uniqueSources: sourceHashes.length,
    originalBytes: fixture.packageBytes.length,
    scenes: 60,
    chapters: 6,
    captions: original.captions.length,
    previewDecode,
    completePortableRestore: true,
    unchangedSource: true,
    parts: measures,
  };
  writeFileSync(
    info.outputPath("twenty-minute-proof.json"),
    JSON.stringify(measurements, null, 2),
  );
  await info.attach("twenty-minute-proof", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  });
});
