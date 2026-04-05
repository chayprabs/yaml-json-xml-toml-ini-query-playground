import { expect, test, type Page } from "@playwright/test";

const PLAYGROUND_READY_TIMEOUT_MS = 60_000;

async function waitForPlaygroundReady(
  page: Page,
  timeout: number = PLAYGROUND_READY_TIMEOUT_MS,
) {
  await page.waitForFunction(
    () => {
      const runButton = document.querySelector('[data-testid="run-button"]');
      return runButton instanceof HTMLButtonElement && !runButton.disabled;
    },
    undefined,
    { timeout },
  );

  await expect(page.getByTestId("loading-indicator")).toContainText(
    "Both browser engines are ready",
    { timeout },
  );
  await expect(page.getByTestId("engine-status-yq")).toContainText("Ready", {
    timeout,
  });
  await expect(page.getByTestId("engine-status-dasel")).toContainText("Ready", {
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

async function setEngine(page: Page, engine: "dasel" | "yq") {
  const toggle = page.getByTestId(`engine-toggle-${engine}`);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
}

async function availableFormats(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => option.textContent ?? ""),
    );
}

async function delayNextEvaluation(
  page: Page,
  delayMs: number,
  engine: "dasel" | "yq" = "yq",
) {
  await page.evaluate(
    async ({ innerDelayMs, innerEngine }) => {
      await window.__engineTestControls?.delayNextEvaluation(
        innerDelayMs,
        innerEngine,
      );
    },
    { innerDelayMs: delayMs, innerEngine: engine },
  );
}

async function panicNextEvaluation(page: Page, engine: "dasel" | "yq" = "yq") {
  await page.evaluate(async (innerEngine) => {
    await window.__engineTestControls?.panicNextEvaluation(innerEngine);
  }, engine);
}

test("page loads with both engines initialized", async ({ page }) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await expect(page.getByTestId("engine-toggle-yq")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("toggle to dasel mode updates formats, presets, and syntax hint", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);

  await setEngine(page, "dasel");

  await expect(page.getByTestId("syntax-hint")).toContainText("dasel selector");
  await expect(page.getByTestId("syntax-hint").locator("a")).toHaveAttribute(
    "href",
    "https://daseldocs.tomwright.me/",
  );
  await expect(page.getByTestId("preset-ini-read")).toBeVisible();
  await expect(page.getByTestId("preset-statement-vars")).toBeVisible();
  await expect(page.getByTestId("preset-k8s")).toHaveCount(0);
  await expect(await availableFormats(page, "input-format")).toContain("ini");
  await expect(await availableFormats(page, "input-format")).toContain("hcl");
  await expect(await availableFormats(page, "output-format")).not.toContain(
    "props",
  );
});

test("INI input works in dasel mode and is unavailable in yq mode", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);

  expect(await availableFormats(page, "input-format")).not.toContain("ini");

  await setEngine(page, "dasel");
  await page.getByTestId("preset-ini-read").click();
  await expect(page.getByTestId("output-content")).toContainText("9999");
});

test("dasel selector syntax works end to end and switching back to yq still works", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  await setEngine(page, "dasel");
  await page.getByTestId("preset-search-selector").click();
  await expect(page.getByTestId("output-content")).toContainText("worker");
  await expect(page.getByTestId("output-content")).toContainText(
    "ghcr.io/example/worker:2.4.1",
  );

  await setEngine(page, "yq");
  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");
  await page.getByTestId("input-format").selectOption("yaml");
  await page.getByTestId("output-format").selectOption("yaml");
  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("output-content")).toContainText("bar");
});

test("dasel write example can return the modified root", async ({ page }) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setEngine(page, "dasel");
  await page.getByTestId("preset-mutate-root").click();
  await expect(page.getByTestId("return-root-toggle")).toBeChecked();
  await expect(page.getByTestId("output-content")).toContainText(
    "ghcr.io/example/api:2.1.0",
  );
});

test("dasel variables work end to end", async ({ page }) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);
  await setEngine(page, "dasel");

  await page.getByTestId("input-editor").fill("");
  await page.getByTestId("expression-input").fill("$cfg.region");
  await page
    .getByTestId("variables-input")
    .fill('cfg=json:{"region":"ap-south-1"}');
  await page.getByTestId("input-format").selectOption("yaml");
  await page.getByTestId("output-format").selectOption("yaml");
  await page.getByTestId("run-button").click();

  await expect(page.getByTestId("output-content")).toContainText("ap-south-1");
});

test("restores state from the URL hash and ignores malformed hashes", async ({
  page,
}) => {
  await page.goto("/#not-a-real-hash");
  await waitForPlaygroundReady(page);
  await expect(page.getByTestId("expression-input")).toHaveValue(
    ".metadata.name",
  );

  await setEngine(page, "dasel");
  await setAutoRun(page, false);
  await page.getByTestId("input-editor").fill("[server]\nhttp_port = 8080\n");
  await page.getByTestId("expression-input").fill("server.http_port");
  await page.getByTestId("input-format").selectOption("ini");
  await page.getByTestId("output-format").selectOption("json");

  await expect
    .poll(async () => decodedHashState(page), {
      timeout: PLAYGROUND_READY_TIMEOUT_MS,
    })
    .toMatchObject({
      autoRun: false,
      engine: "dasel",
      expression: "server.http_port",
      input: "[server]\nhttp_port = 8080\n",
      inputFormat: "ini",
      outputFormat: "json",
    });

  await page.reload();
  await waitForPlaygroundReady(page);
  await expect(page.getByTestId("engine-toggle-dasel")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("expression-input")).toHaveValue(
    "server.http_port",
  );
});

test("surfaces friendly yq and dasel parse errors", async ({ page }) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  await page.getByTestId("expression-input").fill(".foo | [");
  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("error-box")).toContainText(
    "expression could not be parsed",
  );

  await setEngine(page, "dasel");
  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("input-format").selectOption("yaml");
  await page.getByTestId("expression-input").fill("foo[");
  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("error-box")).toContainText(
    "selector could not be parsed",
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
  await delayNextEvaluation(page, 1_200, "yq");
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
  await delayNextEvaluation(page, 1_200, "yq");
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
  await delayNextEvaluation(page, 9_000, "yq");
  await page.getByTestId("run-button").click();

  await expect(page.getByTestId("error-box")).toContainText(
    "Evaluation timed out after 8s",
    { timeout: PLAYGROUND_READY_TIMEOUT_MS },
  );

  await waitForPlaygroundReady(page, PLAYGROUND_READY_TIMEOUT_MS);
  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("output-content")).toContainText("bar");
});

test("recovers from Go panics for both engines without requiring a page reload", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);

  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");
  await panicNextEvaluation(page, "yq");
  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("error-box")).toContainText(
    "An internal error occurred",
  );

  await setEngine(page, "dasel");
  await page.getByTestId("input-editor").fill("[server]\nhttp_port = 9999\n");
  await page.getByTestId("expression-input").fill("server.http_port");
  await page.getByTestId("input-format").selectOption("ini");
  await panicNextEvaluation(page, "dasel");
  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("error-box")).toContainText(
    "An internal error occurred",
  );

  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("output-content")).toContainText("9999");
});

test("keeps yq usable when the dasel wasm binary cannot be fetched", async ({
  page,
  context,
}) => {
  await context.route(/engine-(yq|dasel)\.wasm(\.gz)?$/u, async (route) => {
    if (route.request().url().includes("engine-dasel")) {
      await route.abort("failed");
      return;
    }

    await route.fallback();
  });

  await page.goto("/");
  await expect(page.getByTestId("engine-status-yq")).toContainText("Ready", {
    timeout: PLAYGROUND_READY_TIMEOUT_MS,
  });
  await expect(page.getByTestId("engine-status-dasel")).toContainText(
    "Failed to initialize.",
    {
      timeout: PLAYGROUND_READY_TIMEOUT_MS,
    },
  );
  await expect(page.getByTestId("engine-error-dasel")).toContainText(
    "Failed to load expression engine. Please refresh.",
    {
      timeout: PLAYGROUND_READY_TIMEOUT_MS,
    },
  );
  await expect(page.getByTestId("engine-toggle-dasel")).toBeDisabled();
  await expect(page.getByTestId("run-button")).toBeEnabled();

  await setAutoRun(page, false);
  await page.getByTestId("input-editor").fill("foo: bar\n");
  await page.getByTestId("expression-input").fill(".foo");
  await page.getByTestId("input-format").selectOption("yaml");
  await page.getByTestId("output-format").selectOption("yaml");
  await page.getByTestId("run-button").click();
  await expect(page.getByTestId("output-content")).toContainText("bar");
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
    { timeout: PLAYGROUND_READY_TIMEOUT_MS },
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

test("keyboard submission still works after switching engines", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await waitForPlaygroundReady(page);
  await setAutoRun(page, false);
  await setEngine(page, "dasel");

  await page.getByTestId("input-editor").fill("[server]\nhttp_port = 9999\n");
  await page.getByTestId("expression-input").fill("server.http_port");
  await page.getByTestId("input-format").selectOption("ini");

  if (browserName === "webkit") {
    await page.getByTestId("expression-input").press("Meta+Enter");
  } else {
    await page.getByTestId("expression-input").press("Control+Enter");
  }

  await expect
    .poll(() => outputText(page), {
      timeout: PLAYGROUND_READY_TIMEOUT_MS,
    })
    .toContain("9999");
});
