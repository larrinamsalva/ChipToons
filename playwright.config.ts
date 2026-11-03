import { defineConfig } from "@playwright/test";

const externalUrl = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalUrl || "http://127.0.0.1:4173/ChipToons/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: "**/video-export-proof.spec.ts",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "phone",
      testIgnore: "**/video-export-proof.spec.ts",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet",
      testIgnore: "**/video-export-proof.spec.ts",
      use: {
        browserName: "chromium",
        viewport: { width: 810, height: 1080 },
        hasTouch: true,
      },
    },
    {
      name: "media-export",
      testMatch: "**/video-export-proof.spec.ts",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: externalUrl
    ? undefined
    : {
        command: "npm run preview -- --port 4173 --strictPort",
        url: "http://127.0.0.1:4173/ChipToons/",
        reuseExistingServer: !process.env.CI,
      },
});
