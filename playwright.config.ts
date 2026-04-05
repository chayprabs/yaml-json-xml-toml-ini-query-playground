import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYGROUND_BASE_URL ?? "http://127.0.0.1:3000";
const webServerCommand =
  process.platform === "win32"
    ? "node scripts/serve-static.cjs"
    : "exec node scripts/serve-static.cjs";
const reuseExistingServer =
  !process.env.CI || process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  retries: 0,
  reporter: "list",
  use: {
    actionTimeout: 15_000,
    baseURL,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  webServer: {
    command: webServerCommand,
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 5_000,
    },
    stderr: "pipe",
    stdout: "pipe",
    url: "http://127.0.0.1:3000",
    reuseExistingServer,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
