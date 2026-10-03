import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, EXTERNAL_BASE_URL, LOCAL_PORT } from "./e2e/target";

/**
 * Real-browser regression gate. The suite runs against the localized production builds
 * (`npm run build-locale` -> dist/en, dist/pt) served by e2e/serve.mjs, so it exercises
 * exactly what gets deployed. Use `npm run test:e2e` to build and run everything, or
 * `npm run test:e2e:docker` to run the same suite against the Docker image (E2E_BASE_URL).
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
    baseURL: BASE_URL,
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
  // With E2E_BASE_URL set (e.g. the Docker container) the suite targets that server instead.
  webServer: EXTERNAL_BASE_URL ? undefined : {
    command: "node e2e/serve.mjs",
    url: `${BASE_URL}/en/`,
    reuseExistingServer: !process.env.CI,
    env: { E2E_PORT: String(LOCAL_PORT) }
  }
});
