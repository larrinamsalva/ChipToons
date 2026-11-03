import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { demo, voices, saved, backup, number } from "./production-helpers";
import { builtInSound } from "../src/sounds";
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});
async function enable(page: import("@playwright/test").Page) {
  await voices(page);
  await page
    .getByRole("button", { name: "Enable long-episode audio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Long-episode audio is enabled",
      exact: true,
    }),
  ).toBeVisible();
}
async function packageDownload(page: import("@playwright/test").Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Project backup", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.ctepisode$/);
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 8).toString()).toBe("CTEPKG01");
  return {
    bytes,
    manifest: JSON.parse(
      bytes.subarray(16, 16 + bytes.readUInt32LE(8)).toString(),
    ),
  };
}

test("long audio preserves legacy originals, records locally and restores a complete episode in fresh storage", async ({
  page,
  browser,
}) => {
  await demo(page);
  const before = (await backup(page)).data;
  await enable(page);
  await page
    .getByLabel("Recording name", { exact: true })
    .fill("A private new scene voice");
  await page
    .getByRole("button", { name: "Start microphone recording", exact: true })
    .click();
  await expect(page.locator(".recording-indicator")).toBeVisible();
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
  await page
    .getByRole("button", { name: "Save audio clip", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await saved(page);
  const { bytes, manifest } = await packageDownload(page);
  expect(manifest.project.mediaVersion).toBe(1);
  expect(manifest.files).toHaveLength(6);
  expect(manifest.project.scenes).toEqual(before.scenes);
  expect(
    manifest.project.audioAssets.every(
      (a: { dataUrl: string; file: unknown }) => !a.dataUrl && a.file,
    ),
  ).toBe(true);
  const context = await browser.newContext(),
    other = await context.newPage();
  try {
    await other.goto(page.url());
    await other.getByLabel("Restore project backup file").setInputFiles({
      name: "friendship.ctepisode",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
    await expect(other.locator(".editor")).toBeVisible();
    await saved(other);
    const restored = await packageDownload(other);
    expect(restored.manifest.project.scenes).toEqual(before.scenes);
    expect(
      restored.manifest.files.map((f: { sha256: string }) => f.sha256),
    ).toEqual(manifest.files.map((f: { sha256: string }) => f.sha256));
    await other.reload();
    await other
      .getByRole("button", { name: `Continue ${before.title}`, exact: true })
      .click();
    await expect(other.locator(".editor")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("replacing a file-backed recording keeps earlier originals and scene timing in the complete backup", async ({
  page,
}) => {
  await demo(page);
  await enable(page);
  await page
    .getByLabel("Audio clip", { exact: true })
    .selectOption({ index: 1 });
  await number(page, "Audio fade in (seconds)", "0.2");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Replace selected audio", exact: true })
    .click();
  const source = builtInSound("birds");
  await (
    await chooser
  ).setFiles({
    name: "Original new line.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(source.dataUrl.split(",")[1], "base64"),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "earlier original remains" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await saved(page);
  const p = (await packageDownload(page)).manifest.project;
  expect(p.audioAssets).toHaveLength(6);
  expect(p.audioClips).toHaveLength(5);
  expect(p.audioClips[0].sceneId).toBe(p.scenes[0].id);
});

test("low-storage and interrupted package restoration leave existing projects and recordings intact", async ({
  page,
}) => {
  await demo(page);
  const before = (await backup(page)).data;
  await saved(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator.storage, "estimate", {
      configurable: true,
      value: async () => ({ quota: 1000, usage: 999 }),
    });
  });
  await voices(page);
  await page
    .getByRole("button", { name: "Enable long-episode audio", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "not enough available browser storage" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  expect((await backup(page)).data).toEqual(before);
  await page.reload();
  await page
    .getByRole("button", { name: `Continue ${before.title}`, exact: true })
    .click();
  await enable(page);
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await saved(page);
  const { bytes } = await packageDownload(page);
  await page
    .getByRole("button", {
      name: "Save and return to my cartoons",
      exact: true,
    })
    .click();
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "interrupted.ctepisode",
    mimeType: "application/octet-stream",
    buffer: bytes.subarray(0, bytes.length - 20),
  });
  await expect(page.locator(".toast")).toContainText(
    /interrupted|integrity|missing/i,
  );
  await expect(page.locator(".project-card")).toHaveCount(1);
});

test("long audio and scene readiness controls remain accessible in light and dark modes", async ({
  page,
}, info) => {
  await demo(page);
  await enable(page);
  for (const theme of ["light", "dark"]) {
    await page
      .getByRole("button", { name: "Back to cartoon", exact: true })
      .click();
    const toggle = page.getByRole("button", {
      name: `Switch to ${theme} theme`,
      exact: true,
    });
    if (await toggle.isVisible()) await toggle.click();
    await voices(page);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".modal")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await info.attach(`${info.project.name}-long-voices-${theme}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  }
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await expect(page.getByText(/Episode narration review/)).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".modal")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await info.attach(`${info.project.name}-episode-readiness`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page
    .getByRole("button", { name: "Record or review scene 3", exact: true })
    .click();
  await expect(page.getByLabel("Audio clip", { exact: true })).toHaveValue("");
  await expect(page.getByText(/New scene recordings: scene 3/)).toBeVisible();
});

test("missing stored originals block export and a complete backup restores a separate intact copy", async ({
  page,
}) => {
  await demo(page);
  await enable(page);
  const protection = page.getByRole("button", {
    name: "Request local storage protection",
    exact: true,
  });
  if (await protection.isVisible()) {
    await page.evaluate(() => {
      Object.defineProperty(navigator.storage, "persist", {
        configurable: true,
        value: async () => false,
      });
    });
    await protection.click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "did not grant storage protection" }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await saved(page);
  const { bytes } = await packageDownload(page);
  // Simulate lost browser-local media in this isolated test context.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chiptoons-studio", 3);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("media", "readwrite"),
        store = tx.objectStore("media"),
        r = store.openCursor();
      r.onsuccess = () => {
        r.result?.delete();
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    database.close();
  });
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Missing audio originals:" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export complete cartoon", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Back to studio", exact: true })
    .click();
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "recovered.ctepisode",
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await saved(page);
  expect((await packageDownload(page)).manifest.files).toHaveLength(5);
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export complete cartoon", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("alert").filter({ hasText: "Missing audio originals:" }),
  ).not.toBeAttached();
});
