import { test, expect } from "@playwright/test";

test("beginner directions open and close in the dashboard and puppet studio", async ({ page }) => {
  await page.goto("./");
  const guide = page.locator("details.category-directions").filter({ has: page.getByText("How to use: Getting started", { exact: true }) });
  await expect(guide).toBeVisible();
  await expect(guide.locator("ol")).toBeHidden();
  await guide.locator("summary").click();
  await expect(guide.locator("ol")).toBeVisible();
  await guide.locator("summary").click();
  await expect(guide.locator("ol")).toBeHidden();
  await page.getByRole("button", { name: "Create a Puppet Character", exact: true }).click();
  const puppet = page.getByRole("dialog").locator("details.category-directions");
  await expect(puppet.locator("ol")).toBeHidden();
  await puppet.locator("summary").click();
  await expect(puppet.locator("ol li")).toHaveCount(3);
  await expect(puppet.locator("ol")).toBeVisible();
  await puppet.locator("summary").click();
  await expect(puppet.locator("ol")).toBeHidden();
});
