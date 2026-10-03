import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 4300);

/**
 * Real-browser regression gate. The suite runs against the localized production builds
 * (`npm run build-locale` -> dist/en, dist/pt) served by e2e/serve.mjs, so it exercises
 * exactly what gets deployed. Use `npm run test:e2e` to build and run everything.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/artifacts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/report", open: "never" }]
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] }
    }
  ],
  webServer: {
    command: "node e2e/serve.mjs",
    url: `http://127.0.0.1:${port}/en/`,
    reuseExistingServer: !process.env.CI,
    env: { E2E_PORT: String(port) }
  }
});
