import { alignment } from "./episode-alignment";
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createEpisodeFixture, inspectEpisodePackage } from "./episode-fixture";
import { planSegments } from "../src/segments";
import { formatSrt, srt, subtitleCues } from "../src/production";
import { downloadAndVerifyMovie } from "./single-movie-proof";
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
    const portableCopy = info.outputPath(
      "downloaded-complete-garden.ctepisode",
    );
    writeFileSync(portableCopy, before.bytes);
    await info.attach("complete-portable-episode", {
      path: portableCopy,
      contentType: "application/octet-stream",
    });
    await restoredPage
      .getByLabel("Restore project backup file")
      .setInputFiles(portableCopy);
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
      { timeout: 40_000 },
    )
    .toBeGreaterThanOrEqual(25);
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
  // Seek distant chapters without decoding the sources between them.
  for (const offset of [600, 1100]) {
    const seek = page.getByRole("slider", {
      name: "Cartoon play position",
      exact: true,
    });
    await seek.fill(String(offset));
    await page
      .getByRole("button", { name: "Play cartoon", exact: true })
      .click();
    await expect
      .poll(async () => Number(await seek.inputValue()), { timeout: 10_000 })
      .toBeGreaterThan(offset + 1);
    await page
      .getByRole("button", { name: "Pause cartoon", exact: true })
      .click();
  }
  const seekDecodes = await page.evaluate(
    () =>
      (
        window as unknown as {
          episodeDecodes: { calls: number; seconds: number };
        }
      ).episodeDecodes,
  );
  expect(seekDecodes.calls).toBeLessThan(12);
  expect(seekDecodes.seconds).toBeLessThan(180);
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
  const deliveryPaths: string[] = [];
  for (const [index, segment] of plan.segments.entries()) {
    const part = index + 1;
    console.info(
      `Rendering original story ${segment.start}–${segment.end}s as part ${part}/10`,
    );
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
    deliveryPaths.push(path);
    await info.attach(`part-${part}-complete-video`, {
      path,
      contentType: "video/webm",
    });
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
    const voiceAlignment = Array.from(
      { length: segment.lastScene - segment.firstScene + 1 },
      (_, i) => segment.firstScene + i,
    ).map((scene) =>
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
      Math.max(...voiceAlignment.map((a) => a.delay)) -
        Math.min(...voiceAlignment.map((a) => a.delay)),
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
  await page.getByRole("button", { name: "Prepare My Complete Episode", exact: true }).click();
  await page.getByLabel("Choose video files", { exact: true }).setInputFiles(deliveryPaths);
  await expect(page.getByRole("status").filter({ hasText: /10 of 10 parts assigned.*Ready for delivery/ }))
    .toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Exact recorded export match", { exact: true })).toHaveCount(10);
  const delivery = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: "Download Episode Delivery Package", exact: true }).click();
  const deliveryZip = info.outputPath("complete-episode-delivery.zip");
  await (await delivery).saveAs(deliveryZip);
  execFileSync("unzip", ["-tq", deliveryZip]);
  const manifestText = execFileSync("unzip", ["-p", deliveryZip, "part-order.json"], { encoding: "utf8" });
  const manifest = JSON.parse(manifestText);
  expect(manifest.seconds).toBe(1200);
  expect(manifest.parts.map((part: { start: number }) => part.start)).toEqual(plan.segments.map(segment => segment.start));
  await page.getByLabel("Choose a delivery package", { exact: true }).setInputFiles(deliveryZip);
  await expect(page.getByRole("heading", { name: "Package checks passed", exact: true })).toBeVisible({ timeout: 60_000 });
  await info.attach("twenty-minute-delivery-manifest", { body: manifestText, contentType: "application/json" });
  await info.attach("twenty-minute-delivery-check", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "Make One Complete Movie", exact: true }).click();
  const movie = await downloadAndVerifyMovie(page, info, deliveryPaths, plan.segments.map(segment => segment.duration));
  expect(movie.parts).toHaveLength(10);
  const movieCaption = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Complete Movie Subtitles", exact: true }).click();
  const movieSrt = await readFile((await (await movieCaption).path())!, "utf8");
  expect(movieSrt.match(/ --> /g)).toHaveLength(original.captions.length);
  const expectedCaptions = plan.segments.flatMap((range, index) => {
    const output = movie.parts[index];
    return subtitleCues(original, range).map(cue => ({
      start: output.start + 0.15 + cue.start, end: output.start + 0.15 + cue.end, text: cue.text,
    }));
  });
  expect(movieSrt).toEqual(formatSrt(expectedCaptions));
  await info.attach("continuous-movie-subtitles", { body: movieSrt, contentType: "application/x-subrip" });
  await page.getByRole("button", { name: "Back to exports", exact: true }).click();
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
    spokenNarrationSeconds: fixture.speechWindows.reduce(
      (n, w) => n + w.end - w.start,
      0,
    ),
    uniqueSources: sourceHashes.length,
    originalBytes: fixture.packageBytes.length,
    scenes: 60,
    chapters: 6,
    captions: original.captions.length,
    previewDecode,
    seekDecodes,
    previewPositions: [0, 600, 1100],
    completePortableRestore: true,
    unchangedSource: true,
    parts: measures,
    continuousMovie: movie,
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
