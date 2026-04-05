import { expect, test, type Page } from "@playwright/test";

async function waitForPlaygroundReady(page: Page, timeout: number = 30_000) {
  await page.waitForFunction(
    () => {
      const runButton = document.querySelector('[data-testid="run-button"]');
      return runButton instanceof HTMLButtonElement && !runButton.disabled;
    },
    undefined,
    {
      timeout,
    },
  );

  await expect(page.getByTestId("loading-indicator")).toContainText("ready", {
    timeout,
  });
}

async function outputText(page: Page) {
  return page
    .getByTestId("output-content")
    .evaluate((element) => element.textContent ?? "");
}

async function decodedHashState(page: Page) {
  return page.evaluate(() => {
    const normalizedHash = window.location.hash.replace(/^#/u, "").trim();
    if (!normalizedHash) {
      return null;
    }

    try {
      const padded = normalizedHash
        .replace(/-/gu, "+")
        .replace(/_/gu, "/")
        .padEnd(Math.ceil(normalizedHash.length / 4) * 4, "=");
      const decodedBinary = atob(padded);
      const bytes = Uint8Array.from(decodedBinary, (character) =>
        character.charCodeAt(0),
      );
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  });
}

async function setAutoRun(page: Page, enabled: boolean) {
  const toggle = page.getByTestId("auto-run-toggle");
  const isChecked = await toggle.isChecked();

  if (isChecked !== enabled) {
    await toggle.click();
  }
}

async function delayNextEvaluation(page: Page, delayMs: number) {
  await page.evaluate(async (innerDelayMs) => {
    await window.__engineTestControls?.delayNextEvaluation(innerDelayMs);
  }, delayMs);
}

async function panicNextEvaluation(page: Page) {
  await page.evaluate(async () => {
    await window.__engineTestControls?.panicNextEvaluation();
  });
}

test("evaluates the default preset once the worker-backed engine is ready", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await page.getByTestId("preset-k8s").click();

  await expect(page.getByTestId("output-content")).toContainText(
    "my-deployment",
  );
});

test("restores state from the URL hash and ignores malformed hashes", async ({
  page,
}) => {
  await page.goto("/#not-a-real-hash");
  await waitForPlaygroundReady(page);

  await expect(page.getByTestId("expression-input")).toHaveValue(
    ".metadata.name",
  );

  await setAutoRun(page, false);
  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");
  await page.getByTestId("output-format").selectOption("json");

  await expect
    .poll(async () => decodedHashState(page))
    .toMatchObject({
      autoRun: false,
      expression: ".foo",
      input: "foo: bar\n",
      outputFormat: "json",
    });

  await page.reload();
  await waitForPlaygroundReady(page);
  await expect(page.getByTestId("expression-input")).toHaveValue(".foo");
  await expect(page.getByTestId("input-editor")).toHaveValue("foo: bar\n");
  await expect(page.getByTestId("output-format")).toHaveValue("json");
});

test("surfaces friendly parse errors for invalid expressions", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);
  await page.getByTestId("expression-input").fill(".foo | [");
  await page.getByTestId("run-button").click();

  await expect(page.getByTestId("error-box")).toContainText(
    "expression could not be parsed",
  );
});

test("clearing while an evaluation is running prevents stale output from reappearing", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");
  await delayNextEvaluation(page, 1_200);
  await page.getByTestId("run-button").click();
  await page.getByTestId("clear-button").click();

  await expect(page.getByTestId("expression-input")).toHaveValue("");
  await expect(page.getByTestId("input-editor")).toHaveValue("");

  await waitForPlaygroundReady(page);
  await expect(page.getByTestId("output-content")).toContainText(
    "Run an expression",
  );
});

test("changing formats during a running evaluation queues and applies the latest snapshot", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");
  await delayNextEvaluation(page, 1_200);
  await page.getByTestId("run-button").click();

  await page
    .getByTestId("input-editor")
    .fill('{"name":"pixel","region":"ap-south-1"}');
  await page.getByTestId("input-format").selectOption("json");
  await page.getByTestId("output-format").selectOption("yaml");
  await page.getByTestId("expression-input").fill(".name");

  if (browserName === "webkit") {
    await page.getByTestId("expression-input").press("Meta+Enter");
  } else {
    await page.getByTestId("expression-input").press("Control+Enter");
  }

  await waitForPlaygroundReady(page);
  await expect(page.getByTestId("output-content")).toContainText("pixel");
});

test("times out slow evaluations, restarts the worker, and remains usable", async ({
  page,
}) => {
  test.slow();

  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");
  await delayNextEvaluation(page, 9_000);
  await page.getByTestId("run-button").click();

  await expect(page.getByTestId("error-box")).toContainText(
    "Evaluation timed out after 8s",
    { timeout: 20_000 },
  );

  await waitForPlaygroundReady(page, 20_000);
  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("output-content")).toContainText("bar");
});

test("recovers from Go panics without requiring a page reload", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");
  await panicNextEvaluation(page);
  await page.getByTestId("run-button").click();

  await expect(page.getByTestId("error-box")).toContainText(
    "An internal error occurred",
  );

  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("output-content")).toContainText("bar");
});

test("shows a refresh message when the wasm binary cannot be fetched", async ({
  page,
  context,
}) => {
  await context.route(/engine\.wasm(\.gz)?$/u, async (route) => {
    await route.abort("failed");
  });

  await page.goto("/");
  await expect(page.getByTestId("error-box")).toContainText(
    "Failed to load expression engine. Please refresh.",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("run-button")).toBeDisabled();
});

test("shows a compatibility message when WebAssembly is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__engineTestBootstrapOptions = {
      disableWebAssembly: true,
    };
  });

  await page.goto("/");
  await expect(page.getByTestId("error-box")).toContainText(
    "WebAssembly is not supported in this browser",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("run-button")).toBeDisabled();
});

test("truncates extremely large output and offers a full-result download", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  const largeValue = "x".repeat(62_000);
  await page.getByTestId("input-editor").fill(`value: ${largeValue}\n`);
  await page.getByTestId("expression-input").fill(".value");

  await expect(page.getByTestId("share-warning")).toContainText(
    "too large to keep in the URL",
  );

  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("truncation-notice")).toContainText(
    "Output truncated",
  );

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("download-output-button").click(),
  ]);

  expect(await download.failure()).toBeNull();
});

test("keyboard submission still works after the worker refactor", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");

  if (browserName === "webkit") {
    await page.getByTestId("expression-input").press("Meta+Enter");
  } else {
    await page.getByTestId("expression-input").press("Control+Enter");
  }

  await expect.poll(() => outputText(page)).toContain("bar");
});
