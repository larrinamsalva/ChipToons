import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { builtInSound } from "../src/sounds";
import {
  demo,
  voices,
  number,
  backup,
  restore,
  saved,
} from "./production-helpers";

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});
declare global {
  interface Window {
    __mic: MediaStream[];
    __audioStarts: {
      offset: number;
      when: number;
      now: number;
      duration: number;
    }[];
    __audioContexts: AudioContext[];
  }
}
const wav = () => ({
  name: "my-original.wav",
  mimeType: "audio/wav",
  buffer: Buffer.from(builtInSound("melody").dataUrl.split(",")[1], "base64"),
});

test("upload, character assignment, trim, mixer, reload and portable restore preserve originals", async ({
  page,
}) => {
  await demo(page);
  await voices(page);
  const originalAudio = page.getByLabel("Original audio source", {
    exact: true,
  });
  await originalAudio.evaluate((el: HTMLAudioElement) => el.play());
  await expect
    .poll(() =>
      originalAudio.evaluate((el: HTMLAudioElement) => el.currentTime),
    )
    .toBeGreaterThan(0.05);
  await originalAudio.evaluate((el: HTMLAudioElement) => el.pause());
  await page
    .getByRole("combobox", { name: "New audio category", exact: true })
    .selectOption("dialogue");
  await page
    .getByRole("combobox", { name: "Voice for character", exact: true })
    .selectOption({ label: "Pip" });
  await page.getByLabel("Upload audio file").setInputFiles(wav());
  await page
    .getByRole("textbox", { name: "New audio name", exact: true })
    .fill("My recorded welcome");
  await page
    .getByRole("button", { name: "Save audio clip", exact: true })
    .click();
  await number(page, "Trim start (seconds)", "1");
  await number(page, "Trim end (seconds)", "3");
  await number(page, "Clip start (seconds)", "2");
  await number(page, "Audio fade in (seconds)", ".3");
  await page
    .getByRole("slider", { name: "Audio clip volume", exact: true })
    .fill("0.5");
  await page
    .getByRole("slider", { name: "music mixer level", exact: true })
    .fill("0.25");
  await page
    .getByRole("checkbox", { name: "Mute selected clip", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Mute selected clip", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await saved(page);
  const before = await backup(page),
    clip = before.data.audioClips.at(-1)!;
  expect(clip).toMatchObject({
    name: "My recorded welcome",
    category: "dialogue",
    characterId: before.data.characters[0].id,
    trimStart: 1,
    trimEnd: 3,
    start: 2,
    duration: 2,
    volume: 0.5,
    fadeIn: 0.3,
    muted: false,
  });
  expect(
    before.data.audioAssets
      .find((a) => a.id === clip.assetId)
      ?.dataUrl.split(",")[1],
  ).toBe(wav().buffer.toString("base64"));
  expect(before.data.mixer.music).toBe(0.25);
  await page.reload();
  await page
    .getByRole("button", {
      name: "Continue A little room for a friend",
      exact: true,
    })
    .click();
  expect((await backup(page)).data.audioClips).toEqual(before.data.audioClips);
  await restore(page, before.data);
  const after = await backup(page);
  expect(after.data.audioAssets).toEqual(before.data.audioAssets);
  expect(after.data.audioClips).toEqual(before.data.audioClips);
  expect(after.data.scenes).toEqual(before.data.scenes);
  await voices(page);
  await page
    .getByRole("combobox", { name: "Audio clip", exact: true })
    .selectOption(clip.id);
  await page
    .getByRole("button", { name: "Remove clip from timeline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  expect((await backup(page)).data.audioAssets).toEqual(
    before.data.audioAssets,
  );
});

test("microphone starts explicitly, records real fake-device audio and releases tracks on stop and close", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__mic = [];
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      window.__mic.push(stream);
      return stream;
    };
  });
  await demo(page);
  await voices(page);
  expect(await page.evaluate(() => window.__mic.length)).toBe(0);
  await page
    .getByRole("textbox", { name: "Recording name", exact: true })
    .fill("Local microphone test");
  await page
    .getByRole("button", { name: "Start microphone recording", exact: true })
    .click();
  await expect(page.locator(".recording-indicator")).toContainText(
    "microphone is on",
  );
  await expect
    .poll(async () =>
      Number(
        (await page.locator(".recording-indicator").innerText()).match(
          /([\d.]+)s/,
        )![1],
      ),
    )
    .toBeGreaterThan(0.6);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save audio clip", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__mic.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Save audio clip", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start microphone recording", exact: true })
    .click();
  await expect(page.locator(".recording-indicator")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.__mic.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
  ).toBe(true);
  const result = await backup(page),
    asset = result.data.audioAssets.at(-1)!;
  expect(asset.mime).toBe("audio/wav");
  expect(asset.duration).toBeGreaterThan(0.5);
  expect(asset.name).toBe("Local microphone test");
});

test("permission denial and invalid files give useful recovery without losing the cartoon", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Microphone permission denied", "NotAllowedError");
    };
  });
  await demo(page);
  const before = await backup(page);
  await voices(page);
  await page
    .getByRole("button", { name: "Start microphone recording", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /permission.*denied/i }),
  ).toBeVisible();
  await page.getByLabel("Upload audio file").setInputFiles({
    name: "disguised.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from('<svg onload="alert(1)"/>'),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "contents do not match" }),
  ).toBeVisible();
  await page.getByLabel("Upload audio file").setInputFiles({
    name: "broken.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("RIFF0000WAVEbad-media"),
  });
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /cannot decode|metadata|decod/i }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  expect((await backup(page)).data.audioAssets).toEqual(
    before.data.audioAssets,
  );
});

test("real audio preview follows seek, pause/resume and scene boundaries with continuous music", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__audioStarts = [];
    window.__audioContexts = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      if (!window.__audioContexts.includes(this))
        window.__audioContexts.push(this);
      const node = create.call(this),
        start = node.start.bind(node);
      node.start = (when = 0, offset = 0, duration?: number) => {
        window.__audioStarts.push({
          offset,
          when,
          now: node.context.currentTime,
          duration: node.buffer?.duration ?? 0,
        });
        start(when, offset, duration);
      };
      return node;
    };
  });
  await demo(page);
  await page
    .getByRole("slider", { name: "Cartoon play position", exact: true })
    .fill("9.7");
  await page.getByRole("button", { name: "Play cartoon", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause cartoon", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".stage-header")).toContainText("SCENE 2 OF 6");
  await page
    .getByRole("button", { name: "Pause cartoon", exact: true })
    .click();
  const paused = Number(
    await page
      .getByRole("slider", { name: "Cartoon play position", exact: true })
      .inputValue(),
  );
  const music = await page.evaluate(() =>
    window.__audioStarts.find((a) => Math.abs(a.duration - 8) < 0.02),
  );
  expect(music?.offset).toBeCloseTo(1.7, 1);
  expect(music!.when - music!.now).toBeGreaterThanOrEqual(0.08);
  await page
    .getByRole("slider", { name: "Cartoon play position", exact: true })
    .fill("17");
  await expect(page.locator(".caption-overlay")).toContainText(
    "Would you like to play",
  );
  await page.getByRole("button", { name: "Play cartoon", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause cartoon", exact: true }),
  ).toBeVisible();
  const pip = await page.evaluate(() =>
    window.__audioStarts
      .filter((a) => a.duration > 2.7 && a.duration < 3)
      .at(-1),
  );
  expect(pip?.offset).toBeCloseTo(1.6, 1);
  await page
    .getByRole("button", { name: "Pause cartoon", exact: true })
    .click();
  expect(paused).toBeGreaterThan(10);
  await page.getByRole("button", { name: "Play cartoon", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause cartoon", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause cartoon", exact: true })
    .click();
  const final = Number(
    await page
      .getByRole("slider", { name: "Cartoon play position", exact: true })
      .inputValue(),
  );
  expect(final).toBeGreaterThanOrEqual(17);
  expect(final).toBeLessThan(18);
});

test("caption timing, text drafting, SRT and keyboard clip movement use the existing timeline", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", {
      name: "Edit narration clip A kind hello",
      exact: true,
    })
    .press("ArrowRight");
  await voices(page);
  await expect(
    page.getByRole("spinbutton", { name: "Clip start (seconds)", exact: true }),
  ).toHaveValue("0.5");
  await page
    .getByRole("button", { name: "Timed captions", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Caption words", exact: true })
    .fill("Kindness makes room.");
  await number(page, "Caption begins (seconds)", "1");
  await number(page, "Caption ends (seconds)", "3");
  await page
    .getByRole("button", {
      name: "Generate this scene’s captions",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Replace caption track", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel caption replacement", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download SRT subtitles", exact: true })
    .click();
  expect(await readFile((await (await pending).path())!, "utf8")).toContain(
    "00:00:01,000 --> 00:00:03,000\nKindness makes room.",
  );
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Scene time (seconds)", exact: true })
    .fill("2");
  await expect(page.locator(".caption-overlay")).toContainText(
    "Kindness makes room.",
  );
  await page
    .getByRole("spinbutton", { name: "Scene time (seconds)", exact: true })
    .fill("3");
  await expect(page.locator(".caption-overlay")).not.toBeAttached();
});

test("export cancellation and encoder failure preserve all media and allow backup", async ({
  page,
}) => {
  await demo(page);
  const before = await backup(page);
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Export complete cartoon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel video export", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel video export", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await expect(
    page.getByRole("button", { name: "Download completed video", exact: true }),
  ).not.toBeAttached();
  await page
    .getByRole("button", { name: "Back to studio", exact: true })
    .click();
  expect((await backup(page)).data).toEqual(before.data);
  await page.evaluate(() => {
    MediaRecorder.prototype.start = () => {
      throw new Error("Encoder test failure");
    };
  });
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Export complete cartoon", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Encoder test failure");
  await page
    .getByRole("button", { name: "Back to studio", exact: true })
    .click();
  expect((await backup(page)).data).toEqual(before.data);
});

test("unsupported encoders preserve project and SRT downloads", async ({
  page,
}) => {
  await page.addInitScript(() => {
    MediaRecorder.isTypeSupported = () => false;
  });
  await demo(page);
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export complete cartoon", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("does not provide");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download portable project", exact: true })
    .click();
  const p = JSON.parse(await readFile((await (await pending).path())!, "utf8"));
  expect(p.audioAssets).toHaveLength(5);
});

test("responsive voices, captions and finish panels remain accessible in both themes", async ({
  page,
}, info) => {
  await demo(page);
  for (const theme of ["light", "dark"]) {
    const toggle = page.getByRole("button", {
      name: `Switch to ${theme} theme`,
      exact: true,
    });
    if (await toggle.isVisible()) await toggle.click();
    await voices(page);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await info.attach(`${info.project.name}-voices-${theme}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page
      .getByRole("button", { name: "Timed captions", exact: true })
      .click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Back to cartoon", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Finish My Cartoon", exact: true })
      .click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await info.attach(`${info.project.name}-finish-${theme}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page
      .getByRole("button", { name: "Back to studio", exact: true })
      .click();
  }
});

test("audio sources survive storage quota failure and retry", async ({
  page,
}) => {
  await demo(page);
  await saved(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await voices(page);
  await page
    .getByRole("button", { name: "Friendly notification", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /storage is full/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  const current = (await backup(page)).data;
  expect(current.audioClips).toHaveLength(6);
  await restore(page, current);
  await saved(page);
  expect((await backup(page)).data.audioClips).toHaveLength(6);
});
