import { defineConfig, devices } from "@playwright/test";

const host = process.env.PLAYGROUND_HOST ?? "127.0.0.1";
const port = process.env.PLAYGROUND_PORT ?? "3000";
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath =
  process.env.GITHUB_ACTIONS === "true" && repoName ? `/${repoName}` : "";
const baseURL =
  process.env.PLAYGROUND_BASE_URL ?? `http://${host}:${port}${basePath}`;

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
    timeout: 300_000,
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
