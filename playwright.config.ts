import { defineConfig, devices } from "@playwright/test";

const host = process.env.PLAYGROUND_HOST ?? "127.0.0.1";
const port = process.env.PLAYGROUND_PORT ?? "3000";
const baseURL = process.env.PLAYGROUND_BASE_URL ?? `http://${host}:${port}`;

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
    command: `npm run dev -- --hostname ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
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
