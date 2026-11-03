import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Project } from "../src/model";

export async function demo(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Try a demo cartoon" }).click();
  await expect(page.locator(".editor")).toBeVisible();
  await page
    .getByRole("button", { name: "Production step: Preview", exact: true })
    .click();
}
export async function voices(page: Page) {
  await page
    .locator(".editor-toolbar")
    .getByRole("button", { name: "Voices & Sound", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
export async function number(page: Page, name: string, value: string) {
  const input = page.getByRole("spinbutton", { name, exact: true });
  await input.fill(value);
  await input.press("Enter");
}
export async function backup(page: Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Project backup", exact: true })
    .click();
  const path = (await (await pending).path())!;
  return { path, data: JSON.parse(await readFile(path, "utf8")) as Project };
}
export async function restore(page: Page, project: Project) {
  await page.goto("./");
  await page.getByLabel("Restore project backup file").setInputFiles({
    name: "production.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator(".editor")).toBeVisible();
  await page
    .getByRole("button", { name: "Production step: Preview", exact: true })
    .click();
}
export async function saved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "Saved on this device" }),
  ).toBeVisible();
}
