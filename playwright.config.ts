import { defineConfig, devices } from "@playwright/test";

const host = process.env.PLAYGROUND_HOST ?? "127.0.0.1";
const port = process.env.PLAYGROUND_PORT ?? "3000";
const baseURL = process.env.PLAYGROUND_BASE_URL ?? `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
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
  ],
});
