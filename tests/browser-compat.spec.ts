import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demo, backup, saved } from "./production-helpers";
import { segmentedProject } from "./creator-fixtures";
import { restore } from "./production-helpers";

test("wizard draft, chapter navigation and keyboard scene editing work across browser engines", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start with a Thought" }).click();
  await page
    .getByLabel("What’s your story idea?")
    .fill("Friends ask a trusted grown-up before sharing personal details.");
  await page
    .getByLabel("Cartoon title", { exact: true })
    .fill("A safe little pause");
  await page
    .getByRole("button", { name: "Find my story", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save Draft · Edit Later", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeAttached();
  await page.reload();
  await page
    .getByRole("button", { name: "Continue A safe little pause", exact: true })
    .click();
  await saved(page);
  await page
    .getByRole("button", { name: "Story chapters", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: /^02 / }).click();
  const edit = page.getByRole("button", { name: "Edit scene", exact: true });
  if (await edit.isVisible()) await edit.click();
  await page.getByLabel("Scene title", { exact: true }).fill("Stop and ask");
  await page.getByLabel("Chapter", { exact: true }).selectOption("challenge");
  await saved(page);
  const p = (await backup(page)).data;
  expect(p.scenes[1].title).toBe("Stop and ask");
  expect(p.scenes[1].chapter).toBe("challenge");
  await page.reload();
  await page
    .getByRole("button", { name: "Continue A safe little pause", exact: true })
    .click();
  await expect(page.locator(".editor")).toBeVisible();
});

test("finish detects actual encoder capabilities while preserving portable project and subtitle downloads", async ({
  page,
}, info) => {
  await restore(page, segmentedProject());
  await saved(page);
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await expect(page.getByLabel("Video export format")).toBeVisible();
  const formats = await page
    .getByLabel("Video export format")
    .locator('option[value^="video/"]')
    .count();
  const complete = page.getByRole("button", {
    name: "Export complete cartoon",
    exact: true,
  });
  if (formats) await expect(complete).toBeEnabled();
  else {
    await expect(complete).toBeDisabled();
    await expect(
      page.getByRole("status").filter({ hasText: "does not provide" }),
    ).toBeVisible();
  }
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download portable project", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  const captions = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download SRT subtitles", exact: true })
    .click();
  expect((await captions).suggestedFilename()).toMatch(/\.srt$/);
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
  await info.attach(`${info.project.name}-encoder-capabilities`, {
    body: JSON.stringify({
      webmFormatCount: formats,
      fullExportAvailable: !!formats,
    }),
    contentType: "application/json",
  });
  await info.attach(`${info.project.name}-finish`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("original art library and tutorial remain readable and keyboard accessible in dark mode", async ({
  page,
}) => {
  await demo(page);
  const dark = page.getByRole("button", {
    name: "Switch to dark theme",
    exact: true,
  });
  if (await dark.isVisible()) await dark.click();
  await page
    .getByRole("button", { name: "Guided tutorial", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Make your first friendship cartoon",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open art library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Your little library of big possibilities.",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".modal")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeAttached();
});

test("file-backed originals and complete package recovery work with portable checksums across browser engines", async ({
  page,
}) => {
  const { voices } = await import("./production-helpers"),
    { readFile } = await import("node:fs/promises"),
    { inspectEpisodePackage } = await import("./episode-fixture");
  page.on("console", (m) => {
    if (m.text().includes("IndexedDB")) console.info(m.text());
  });
  await demo(page);
  await saved(page);
  await page.evaluate(() => {
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      try {
        const request = originalAdd.apply(this, args);
        request.addEventListener("error", () =>
          console.info(
            "IndexedDB add failed",
            request.error?.name,
            request.error?.message,
          ),
        );
        return request;
      } catch (e) {
        console.info("IndexedDB add threw", String(e));
        throw e;
      }
    };
    Object.defineProperty(crypto, "subtle", {
      configurable: true,
      value: undefined,
    });
  });
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
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await saved(page);
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Project backup", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.ctepisode$/);
  const bytes = await readFile((await download.path())!),
    manifest = inspectEpisodePackage(bytes);
  expect(manifest.files).toHaveLength(5);
  expect(manifest.project.mediaVersion).toBe(1);
  await page
    .getByRole("button", {
      name: "Save and return to my cartoons",
      exact: true,
    })
    .click();
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "voices.ctepisode",
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await expect(page.locator(".editor")).toBeVisible();
  await saved(page);
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await expect(page.getByText(/Episode narration review/)).toBeVisible();
  await expect(
    page.getByText("Checking local audio originals…"),
  ).not.toBeAttached();
  await expect(page.getByText(/Missing audio originals:/)).not.toBeAttached();
});
