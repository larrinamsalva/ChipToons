import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { starterProject } from "../src/planner";
import { clone } from "../src/model";
import {
  demo,
  backup,
  restore,
  saved,
  voices,
  number,
} from "./production-helpers";
import { longProject, pixel, segmentedProject } from "./creator-fixtures";
const properties = async (page: Page) => {
  const tab = page.getByRole("button", { name: "Edit scene", exact: true });
  if (await tab.isVisible()) await tab.click();
};
async function download(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8"));
}

test("thought wizard goes back, edits a scene outline and saves a recoverable twenty-minute draft", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start with a Thought" }).click();
  await page
    .getByLabel("What’s your story idea?")
    .fill("Pip and Sunny make space for a new friend.");
  await page
    .getByLabel("Cartoon title", { exact: true })
    .fill("Our bigger friendship story");
  await page.getByText("A few more creative choices", { exact: true }).click();
  await page.getByLabel("Episode goal").selectOption("20");
  await page
    .getByRole("button", { name: "Find my story", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit my idea", exact: true }).click();
  await expect(page.getByLabel("Cartoon title", { exact: true })).toHaveValue(
    "Our bigger friendship story",
  );
  await page
    .getByRole("button", { name: "Find my story", exact: true })
    .click();
  await page
    .getByLabel("Scene 1 title", { exact: true })
    .fill("A small invitation");
  await page
    .getByRole("button", { name: "Save Draft · Edit Later", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeAttached();
  await expect(
    page
      .locator(".project-card")
      .filter({ hasText: "Our bigger friendship story" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", {
      name: "Continue Our bigger friendship story",
      exact: true,
    })
    .click();
  await saved(page);
  const p = (await backup(page)).data;
  expect(p.plannedMinutes).toBe(20);
  expect(p.scenes[0].title).toBe("A small invitation");
  expect(p.scenes.reduce((n, s) => n + s.duration, 0)).toBe(60);
  await page
    .getByRole("button", { name: "Story chapters", exact: true })
    .click();
  await expect(page.getByLabel("Target story length")).toHaveValue("20");
  await expect(
    page.getByText("19:00 left toward your goal.", { exact: false }),
  ).toBeVisible();
});

test("guided image import rejects SVG, preserves its source and uses the manually chosen object role", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start with an Image" }).click();
  await page.getByLabel("Guided artwork file").setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg onload='alert(1)'/>"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Guided artwork file").setInputFiles({
    name: "My toy.png",
    mimeType: "image/png",
    buffer: Buffer.from(pixel.split(",")[1], "base64"),
  });
  await page.getByLabel("Artwork name", { exact: true }).fill("Helpful toy");
  await page.getByLabel("Use this artwork as").selectOption("prop");
  await page.getByRole("button", { name: "Next: plan my story" }).click();
  await page
    .getByLabel("What’s your story idea?")
    .fill("The friends take turns putting toys away.");
  await page
    .getByRole("button", { name: "Find my story", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create my storyboard", exact: true })
    .click();
  await saved(page);
  const p = (await backup(page)).data;
  expect(p.creationSource).toBe("image");
  expect(p.assets).toHaveLength(1);
  expect(p.assets[0].dataUrl).toBe(pixel);
  expect(
    p.scenes.every((s) =>
      s.elements.some((e) => e.kind === "art" && e.name === "Helpful toy"),
    ),
  ).toBe(true);
});

test("guided sketch reuses the working drawing studio and returns to manual identity before planning", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start with a Sketch" }).click();
  await page
    .getByRole("button", { name: "Draw my artwork", exact: true })
    .click();
  const box = (await page.locator(".drawing-canvas").boundingBox())!;
  await page.mouse.move(box.x + 65, box.y + 65);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.up();
  await page
    .getByLabel("Character name", { exact: true })
    .fill("Doodle friend");
  await page
    .getByRole("button", { name: "Give my character a story", exact: true })
    .click();
  await expect(page.getByLabel("Artwork name", { exact: true })).toHaveValue(
    "Doodle friend",
  );
  await page.getByRole("button", { name: "Next: plan my story" }).click();
  await page
    .getByLabel("What’s your story idea?")
    .fill("Doodle friend learns to ask for help.");
  await page
    .getByRole("button", { name: "Find my story", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create my storyboard", exact: true })
    .click();
  await saved(page);
  const p = (await backup(page)).data;
  expect(p.creationSource).toBe("sketch");
  expect(p.characters[0].name).toBe("Doodle friend");
  expect(p.assets[0].drawing?.objects.length).toBeGreaterThan(0);
  expect(p.scenes[0].elements[0].animation).toBeUndefined();
});

test("chapter batches preserve existing scene artwork, animation and audio and support undo", async ({
  page,
}) => {
  await demo(page);
  const before = (await backup(page)).data;
  await page
    .getByRole("button", { name: "Story chapters", exact: true })
    .click();
  await page.getByLabel("Target story length").selectOption("15");
  await page.getByLabel("Scenes in this batch").fill("3");
  await page.getByLabel("Seconds per new scene").fill("30");
  await page.getByLabel("Insert new scenes").selectOption("2");
  await page.getByRole("button", { name: "Prepare scene notes" }).click();
  await page
    .getByLabel("New scene 1 title", { exact: true })
    .fill("Listen to a new idea");
  await page
    .getByLabel("New scene 1 learning question")
    .fill("How could everyone have a turn?");
  await page
    .getByRole("button", { name: "Add 3 reviewed scenes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to storyboard", exact: true })
    .click();
  await saved(page);
  const next = (await backup(page)).data;
  expect(next.scenes).toHaveLength(9);
  expect(next.scenes[3].title).toBe("Listen to a new idea");
  expect(next.scenes[3].question).toBe("How could everyone have a turn?");
  expect(
    next.scenes.filter((s) => before.scenes.some((b) => b.id === s.id)),
  ).toEqual(before.scenes);
  expect(next.audioClips).toEqual(before.audioClips);
  expect(next.captions).toEqual(before.captions);
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  await saved(page);
  expect((await backup(page)).data.scenes).toEqual(before.scenes);
});

test("character reference copies appearance on confirmation while protecting positions, acting and library source", async ({
  page,
}) => {
  const p = starterProject();
  p.scenes[0].elements[0].appearance = { shirt: "#123456" };
  p.scenes[1].elements[0].appearance = { shirt: "#abcdef" };
  const before = clone(p);
  await restore(page, p);
  await properties(page);
  await page
    .getByRole("button", { name: "Character reference", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Pip · character reference",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Apply appearance to").selectOption("episode");
  await page
    .getByRole("button", { name: "Apply this appearance…", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel appearance change" }).click();
  await page
    .getByRole("button", { name: "Apply this appearance…", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm appearance change" }).click();
  await page
    .getByRole("button", { name: "Back to scene", exact: true })
    .click();
  await saved(page);
  const next = (await backup(page)).data;
  expect(next.characters).toEqual(before.characters);
  next.scenes.forEach((s, i) => {
    expect(s.elements[0].appearance?.shirt).toBe("#123456");
    expect(s.elements[0].x).toBe(before.scenes[i].elements[0].x);
    expect(s.elements[0].animation).toEqual(
      before.scenes[i].elements[0].animation,
    );
  });
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  await saved(page);
  expect((await backup(page)).data.scenes).toEqual(before.scenes);
});

test("art-library backup restores independent copies and rejects a malformed batch", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Open art library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New character", exact: true })
    .click();
  await page.getByLabel("Artwork name", { exact: true }).fill("Mira backup");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await page
    .getByText("Back up or restore my reusable art", { exact: true })
    .click();
  const file = await download(page, "Download art-library backup");
  await page.getByLabel("Restore art-library backup file").setInputFiles({
    name: "art-library.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Restored 1 artwork copies",
  );
  await page
    .getByRole("searchbox", { name: "Find artwork" })
    .fill("Mira backup");
  await expect(page.locator(".library-card")).toHaveCount(2);
  const bad = { ...file, items: [...file.items, ...file.items] };
  await page.getByLabel("Restore art-library backup file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await expect(page.getByRole("alert")).toContainText("repeats an artwork ID");
  await expect(page.locator(".library-card")).toHaveCount(2);
});

test("a 120-scene twenty-minute project keeps scene navigation and numeric editing responsive", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  const p = longProject(),
    began = Date.now();
  await restore(page, p);
  await expect(page.locator(".scene-thumbnail")).toHaveCount(12);
  const loadMs = Date.now() - began;
  const jump = page.getByLabel("Jump to any scene", { exact: true });
  await jump.selectOption("119");
  await expect(page.locator(".stage-header")).toContainText("SCENE 120 OF 120");
  await expect(page.locator(".scene-thumbnail")).toHaveCount(12);
  await properties(page);
  const start = Date.now();
  await page
    .getByLabel("Scene title", { exact: true })
    .fill("The last kind thought");
  await expect(page.locator(".stage-scene-label")).toHaveText(
    "The last kind thought",
  );
  const editMs = Date.now() - start;
  expect(editMs).toBeLessThan(2000);
  await saved(page);
  const next = (await backup(page)).data;
  expect(next.scenes).toHaveLength(120);
  expect(next.assets).toHaveLength(40);
  expect(next.scenes[119].title).toBe("The last kind thought");
  expect(next.scenes[0]).toEqual(p.scenes[0]);
  await info.attach(`${info.project.name}-long-story-profile`, {
    body: JSON.stringify({
      scenes: 120,
      assets: 40,
      elementsPerScene: 8,
      seconds: 1200,
      visibleThumbnails: 12,
      loadAndImportMs: loadMs,
      numericEditResponseMs: editMs,
    }),
    contentType: "application/json",
  });
});

test("segment cancellation recovers independently and gentle mixing settings survive a backup", async ({
  page,
}) => {
  await restore(page, segmentedProject());
  await voices(page);
  await page
    .getByLabel("Audio clip", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Gentle clip fades", exact: true })
    .click();
  await page.getByLabel("Lower music under recorded voices").check();
  await page
    .getByRole("button", { name: "Back to cartoon", exact: true })
    .click();
  await saved(page);
  const before = (await backup(page)).data;
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await number(page, "Maximum seconds per segment", "4");
  await expect(page.locator(".segment-list>li")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Export segment 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel video export", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await expect(
    page.getByRole("button", { name: "Retry segment 2", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Back to studio", exact: true })
    .click();
  expect((await backup(page)).data).toEqual(before);
  await page
    .getByRole("button", { name: "Finish My Cartoon", exact: true })
    .click();
  await number(page, "Maximum seconds per segment", "4");
  await expect(
    page.getByRole("button", { name: "Retry segment 2", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Retry segment 2", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Segment 2 is ready", exact: true }),
  ).toBeVisible({ timeout: 35000 });
});

test("new chapter, reference and tutorial dialogs support keyboard exit and accessible light/dark layouts", async ({
  page,
}, info) => {
  await demo(page);
  for (const theme of ["light", "dark"]) {
    const toggle = page.getByRole("button", {
      name: `Switch to ${theme} theme`,
      exact: true,
    });
    if (await toggle.isVisible()) await toggle.click();
    for (const name of [
      "Story chapters",
      "Character reference",
      "Guided tutorial",
    ]) {
      if (name === "Character reference") await properties(page);
      await page.getByRole("button", { name, exact: true }).click();
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
      await info.attach(`${info.project.name}-${name}-${theme}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeAttached();
    }
  }
});

test("draft quota failures retain a portable outline and navigation protection until saving recovers", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start with a Thought" }).click();
  await page
    .getByLabel("What’s your story idea?")
    .fill("Our friends practice asking for help.");
  await page
    .getByLabel("Cartoon title", { exact: true })
    .fill("Safe on this screen");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
    (window as unknown as { restorePut: () => void }).restorePut = () => {
      IDBObjectStore.prototype.put = put;
    };
  });
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("storage is full");
  const draft = await download(page, "Download draft backup");
  expect(draft.title).toBe("Safe on this screen");
  expect(draft.scenes).toHaveLength(6);
  await page
    .getByRole("button", { name: "Create my storyboard", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Save failed" }),
  ).toBeVisible();
  const guarded = () =>
    page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(await guarded()).toBe(true);
  await page.evaluate(() =>
    (window as unknown as { restorePut: () => void }).restorePut(),
  );
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await saved(page);
  await expect.poll(guarded).toBe(false);
  expect((await backup(page)).data.title).toBe("Safe on this screen");
});
