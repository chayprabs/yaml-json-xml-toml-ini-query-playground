import { test } from "@playwright/test";

const PLAYGROUND_READY_TIMEOUT_MS = 60_000;

if (process.env.CI) {
  test("CI diagnostic captures readiness state before the main suite", async ({
    page,
  }) => {
    await page.goto("/");

    try {
      await page.waitForFunction(
        () => {
          const runButton = document.querySelector(
            '[data-testid="run-button"]',
          );
          return runButton instanceof HTMLButtonElement && !runButton.disabled;
        },
        undefined,
        { timeout: PLAYGROUND_READY_TIMEOUT_MS },
      );
    } catch (error) {
      const snapshot = await page.evaluate(() => {
        const text = (testId: string) =>
          document
            .querySelector(`[data-testid="${testId}"]`)
            ?.textContent?.trim() ?? null;

        return {
          daselStatus: text("engine-status-dasel"),
          errorBox: text("error-box"),
          loadingIndicator: text("loading-indicator"),
          runButtonDisabled:
            document.querySelector('[data-testid="run-button"]') instanceof
            HTMLButtonElement
              ? (
                  document.querySelector(
                    '[data-testid="run-button"]',
                  ) as HTMLButtonElement
                ).disabled
              : null,
          userAgent: navigator.userAgent,
          webdriver: navigator.webdriver,
          yqStatus: text("engine-status-yq"),
        };
      });

      throw new Error(
        `CI readiness diagnostic timed out after ${PLAYGROUND_READY_TIMEOUT_MS}ms. Snapshot: ${JSON.stringify(
          snapshot,
        )}. Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}
