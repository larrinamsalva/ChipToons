import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { starterProject } from "../src/planner";

async function panel(page: Page, name: string) {
  const tab = page.getByRole("button", { name, exact: true });
  if (await tab.isVisible()) await tab.click();
}
async function demo(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Try a demo cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible();
  await panel(page, "Preview");
}
async function saved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "Saved on this device" }),
  ).toBeVisible();
}
async function number(page: Page, name: string, value: string) {
  const input = page.getByRole("spinbutton", { name, exact: true });
  await input.fill(value);
  await input.press("Enter");
}
async function backup(page: Page) {
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Project backup", exact: true })
    .click();
  const path = (await (await download).path())!;
  return { path, data: JSON.parse(await readFile(path, "utf8")) };
}
const track = (page: Page, name: string) =>
  page.locator(".timeline-row").filter({
    has: page.getByRole("button", {
      name: `Select ${name} track`,
      exact: true,
    }),
  });
async function replace(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace animation", exact: true })
    .click();
}
async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  touch: boolean,
) {
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [from],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [to],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  }
}

test("keyframes add, edit, move, duplicate, delete and undo without changing base art", async ({
  page,
}) => {
  await demo(page);
  const row = track(page, "Pip");
  await expect(row.locator(".key-marker")).toHaveCount(5);
  await page
    .getByRole("spinbutton", { name: "Scene time (seconds)", exact: true })
    .fill("1.5");
  await page
    .getByRole("button", { name: "Add keyframe at playhead", exact: true })
    .click();
  await expect(row.locator(".key-marker")).toHaveCount(6);
  await number(page, "Keyframe X", "425");
  await page
    .getByRole("combobox", { name: "Keyframe expression", exact: true })
    .selectOption("excited");
  await page
    .getByRole("combobox", { name: "Keyframe pose", exact: true })
    .selectOption("waving");
  await page
    .getByRole("combobox", { name: "Keyframe mouth", exact: true })
    .selectOption("talking");
  await page
    .getByRole("combobox", { name: "Keyframe heart effect", exact: true })
    .selectOption("helping");
  await expect(
    page.locator(".live-stage [data-element-id]").first(),
  ).toHaveAttribute("transform", /translate\(425 /);
  await page
    .getByRole("button", { name: "Duplicate keyframe", exact: true })
    .click();
  await expect(row.locator(".key-marker")).toHaveCount(7);
  await number(page, "Keyframe time (seconds)", "1.8");
  const marker = page.getByRole("button", {
    name: "Pip keyframe at 1.80 seconds",
    exact: true,
  });
  await marker.press("ArrowRight");
  await expect(
    page.getByRole("spinbutton", {
      name: "Keyframe time (seconds)",
      exact: true,
    }),
  ).toHaveValue("1.9");
  await page
    .getByRole("button", { name: "Delete keyframe", exact: true })
    .click();
  await expect(row.locator(".key-marker")).toHaveCount(6);
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  await expect(row.locator(".key-marker")).toHaveCount(7);
  await page.getByRole("button", { name: "Redo edit", exact: true }).click();
  await expect(row.locator(".key-marker")).toHaveCount(6);
  await saved(page);
  const exported = await backup(page),
    e = exported.data.scenes[0].elements[0];
  expect(e.x).toBe(310);
  expect(
    e.animation.keyframes.find((k: { time: number }) => k.time === 1.5),
  ).toMatchObject({
    x: 425,
    emotion: "excited",
    pose: "waving",
    mouth: "talking",
    heart: "helping",
  });
});

test("action preview is temporary; replacement is confirmed, editable and copyable", async ({
  page,
}) => {
  await demo(page);
  const before = await backup(page);
  await page
    .getByRole("combobox", { name: "Animation action", exact: true })
    .selectOption("jump");
  await number(page, "Action starts (seconds)", "1");
  await number(page, "Action length (seconds)", "2");
  await page
    .getByRole("combobox", { name: "Action speed", exact: true })
    .selectOption("2");
  await page
    .getByRole("button", { name: "Preview action", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Preview only");
  await page
    .getByRole("button", { name: "Pause action preview", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Action preview time", exact: true })
    .fill("1.5");
  await page
    .getByRole("button", { name: "Back to timeline", exact: true })
    .click();
  expect((await backup(page)).data.scenes).toEqual(before.data.scenes);
  await page.getByRole("button", { name: "Apply action", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect((await backup(page)).data.scenes).toEqual(before.data.scenes);
  await page.getByRole("button", { name: "Apply action", exact: true }).click();
  await replace(page);
  const first = (await backup(page)).data.scenes[0].elements[0];
  expect(first.animation.keyframes.at(-1).time).toBe(2);
  await page.getByRole("button", { name: "Copy motion", exact: true }).click();
  await page
    .getByRole("button", { name: "Select Sunny track", exact: true })
    .click();
  await page.getByRole("button", { name: "Paste motion", exact: true }).click();
  await replace(page);
  const copied = (await backup(page)).data.scenes[0].elements;
  expect(copied[1].animation.keyframes).toHaveLength(
    first.animation.keyframes.length,
  );
  expect(copied[1].animation.keyframes[0].id).not.toBe(
    first.animation.keyframes[0].id,
  );
  await page
    .getByRole("button", { name: "Reset animation", exact: true })
    .click();
  await replace(page);
  await expect(track(page, "Sunny").locator(".key-marker")).toHaveCount(0);
  await saved(page);
});

test("camera, background and original door tracks work; deleting a followed object clears its reference", async ({
  page,
}, info) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Select Camera track", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add camera move", exact: true })
    .click();
  await expect(track(page, "Camera").locator(".key-marker")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Choose keyframe", exact: true })
    .selectOption({ index: 1 });
  await number(page, "Camera zoom", "1.5");
  await page
    .getByRole("spinbutton", { name: "Scene time (seconds)", exact: true })
    .fill("5");
  await expect(
    page.locator(".live-stage [data-camera-transform]"),
  ).toHaveAttribute("transform", /scale\(1.25\)/);
  await page
    .getByRole("combobox", { name: "Camera follow", exact: true })
    .selectOption({ label: "Pip" });
  // Direct movement under a transformed camera writes a scene key, not a library/base edit.
  const actor = page.getByRole("button", { name: "Select Pip", exact: true });
  await actor.scrollIntoViewIfNeeded();
  const box = (await actor.boundingBox())!;
  await drag(
    page,
    { x: box.x + box.width / 2, y: box.y + box.height * 0.55 },
    { x: box.x + box.width / 2 + 24, y: box.y + box.height * 0.55 - 8 },
    info.project.name !== "desktop",
  );
  await expect(
    page.getByRole("button", {
      name: "Pip keyframe at 5.00 seconds",
      exact: true,
    }),
  ).toBeAttached();
  const moved = (await backup(page)).data.scenes[0].elements[0];
  expect(moved.x).toBe(310);
  expect(
    moved.animation.keyframes.find((k: { time: number }) => k.time === 5).x,
  ).not.toBe(310);
  await page
    .getByRole("button", { name: "Select Background track", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Background effect", exact: true })
    .selectOption("twinkle");
  await page
    .getByRole("button", { name: "Add gentle background motion", exact: true })
    .click();
  await expect(track(page, "Background").locator(".key-marker")).toHaveCount(2);
  await page
    .getByRole("checkbox", { name: "Enable background motion", exact: true })
    .uncheck();
  await expect(
    page.locator(".live-stage [data-background-motion]"),
  ).toHaveAttribute("data-background-motion", "off");
  await page
    .locator(".editor-toolbar")
    .getByRole("button", { name: "Art library", exact: true })
    .click();
  await page.getByRole("button", { name: "Props", exact: true }).click();
  await page
    .locator(".library-card")
    .filter({ has: page.getByRole("heading", { name: "Door", exact: true }) })
    .getByRole("button", { name: "Add to scene", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to my story", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select Door track", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Animation action", exact: true })
    .selectOption("door");
  await page.getByRole("button", { name: "Apply action", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Scene time (seconds)", exact: true })
    .fill("3");
  const door = (await backup(page)).data.scenes[0].elements.at(-1);
  expect(door.prop).toBe("door");
  expect(door.animation.keyframes.at(-1).openness).toBe(1);
  await page
    .getByRole("button", { name: "Select Camera track", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Camera follow", exact: true })
    .selectOption({ label: "Door" });
  await panel(page, "Edit scene");
  await page
    .getByRole("combobox", { name: "Selected scene object", exact: true })
    .selectOption({ label: "Door" });
  await page
    .getByRole("button", { name: "Remove scene object", exact: true })
    .click();
  const after = (await backup(page)).data.scenes[0];
  expect(after.cameraAnimation.followId).toBeUndefined();
  expect(after.elements.some((e: { prop?: string }) => e.prop === "door")).toBe(
    false,
  );
  await saved(page);
});

test("selected-scene looping, pause and resume keep exact timeline position", async ({
  page,
}) => {
  await demo(page);
  await page.clock.install();
  await page
    .getByRole("combobox", { name: "Preview scope", exact: true })
    .selectOption("scene");
  await page.getByRole("checkbox", { name: "Loop scene", exact: true }).check();
  await page.getByRole("button", { name: "Play cartoon", exact: true }).click();
  await page.clock.runFor(11_000);
  await expect(page.locator(".stage-header")).toContainText("SCENE 1 OF 6");
  await page
    .getByRole("button", { name: "Pause cartoon", exact: true })
    .click();
  const paused = await page
    .getByRole("slider", { name: "Scene playhead", exact: true })
    .inputValue();
  expect(Number(paused)).toBeGreaterThan(0.8);
  expect(Number(paused)).toBeLessThan(1.2);
  await page.clock.runFor(3000);
  await expect(
    page.getByRole("slider", { name: "Scene playhead", exact: true }),
  ).toHaveValue(paused);
  await page
    .getByRole("checkbox", { name: "Loop scene", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Play cartoon", exact: true }).click();
  await page.clock.runFor(10_000);
  await expect(
    page.getByRole("button", { name: "Play cartoon", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Scene playhead", exact: true }),
  ).toHaveValue("10");
  await expect(page.locator(".stage-header")).toContainText("SCENE 1 OF 6");
});

test("animation survives reload and portable restore; v2 and malformed motion imports are safe", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("spinbutton", { name: "Scene time (seconds)", exact: true })
    .fill("2.5");
  await page
    .getByRole("button", { name: "Add keyframe at playhead", exact: true })
    .click();
  await number(page, "Keyframe X", "460");
  await saved(page);
  const before = await backup(page);
  await page.reload();
  await page
    .getByRole("button", {
      name: "Continue A little room for a friend",
      exact: true,
    })
    .click();
  await panel(page, "Preview");
  await expect(
    page.getByRole("button", {
      name: "Pip keyframe at 2.50 seconds",
      exact: true,
    }),
  ).toBeAttached();
  expect((await backup(page)).data.scenes).toEqual(before.data.scenes);
  await page
    .getByRole("button", {
      name: "Save and return to my cartoons",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Restore project backup file")
    .setInputFiles(before.path);
  await saved(page);
  const restored = await backup(page);
  expect(restored.data.scenes).toEqual(before.data.scenes);
  expect(restored.data.assets).toEqual(before.data.assets);
  await page
    .getByRole("button", {
      name: "Save and return to my cartoons",
      exact: true,
    })
    .click();
  const bad = structuredClone(before.data);
  bad.scenes[0].elements[0].animation.keyframes[0].time = -1;
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "bad-motion.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await expect(page.getByRole("status")).toContainText(
    "invalid or unsupported",
  );
  await expect(page.locator(".project-card")).toHaveCount(2);
  const legacy = { ...starterProject("friendship"), schemaVersion: 2 };
  legacy.title = "Version two story";
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await saved(page);
  const migrated = await backup(page);
  expect(migrated.data.schemaVersion).toBe(3);
  expect(migrated.data.scenes).toEqual(legacy.scenes);
});

test("timeline keyboard/touch editing, scrolling and light/dark accessibility", async ({
  page,
}, info) => {
  await demo(page);
  await page
    .getByRole("combobox", { name: "Timeline zoom", exact: true })
    .selectOption("2");
  const scroll = page.getByRole("region", {
    name: "Animation tracks; scroll horizontally to see more time",
    exact: true,
  });
  expect(await scroll.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  await page
    .getByRole("combobox", { name: "Timeline zoom", exact: true })
    .selectOption("1");
  const marker = page.getByRole("button", {
    name: "Pip keyframe at 2.00 seconds",
    exact: true,
  });
  await marker.scrollIntoViewIfNeeded();
  const box = (await marker.boundingBox())!;
  await drag(
    page,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2 + 12, y: box.y + box.height / 2 },
    info.project.name !== "desktop",
  );
  await expect(
    page.getByRole("spinbutton", {
      name: "Keyframe time (seconds)",
      exact: true,
    }),
  ).toHaveValue("2.3");
  await page
    .getByRole("button", { name: "Pip keyframe at 2.30 seconds", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("spinbutton", {
      name: "Keyframe time (seconds)",
      exact: true,
    }),
  ).toHaveValue("2.4");
  await page
    .getByRole("checkbox", { name: "Calmer preview", exact: true })
    .check();
  for (const theme of ["light", "dark"]) {
    const toggle = page.getByRole("button", {
      name: `Switch to ${theme} theme`,
      exact: true,
    });
    if (await toggle.isVisible()) await toggle.click();
    const result = await new AxeBuilder({ page })
      .include(".editor")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator(".animation-heading").scrollIntoViewIfNeeded();
  await info.attach(`${info.project.name}-timeline-dark`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await info.attach(`${info.project.name}-scene`, {
    body: await page.locator(".live-stage").screenshot(),
    contentType: "image/png",
  });
  await saved(page);
});
