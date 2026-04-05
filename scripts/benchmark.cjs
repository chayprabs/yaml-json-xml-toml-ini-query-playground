const { chromium } = require("@playwright/test");

const baseURL =
  process.env.PLAYGROUND_BASE_URL ?? "http://127.0.0.1:3100/?__bench=1";

function percentile(sortedValues, ratio) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1),
  );

  return sortedValues[index];
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const throttledPage = await browser.newPage();
  const throttledClient = await throttledPage
    .context()
    .newCDPSession(throttledPage);

  await throttledClient.send("Network.enable");
  await throttledClient.send("Network.setCacheDisabled", {
    cacheDisabled: true,
  });
  await throttledClient.send("Network.emulateNetworkConditions", {
    downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8),
    latency: 150,
    offline: false,
    uploadThroughput: Math.round((750 * 1024) / 8),
  });

  try {
    await throttledPage.goto(baseURL, { waitUntil: "domcontentloaded" });
    await throttledPage.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="run-button"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      },
      undefined,
      {
        timeout: 180_000,
      },
    );

    const loadMetrics = await throttledPage.evaluate(async () => {
      const readyMark = performance
        .getEntriesByName("engine:init:ready", "mark")
        .at(-1);
      const placeholderText =
        "Run an expression to see the transformed output here.";

      await new Promise((resolve) => {
        const check = () => {
          const outputNode = document.querySelector(
            '[data-testid="output-content"]',
          );
          const text = outputNode?.textContent?.trim();
          if (text && text !== placeholderText) {
            resolve(text);
            return;
          }

          requestAnimationFrame(check);
        };

        check();
      });
      const firstResultMark = performance.now();

      return {
        firstEvalDurationMs: readyMark
          ? firstResultMark - readyMark.startTime
          : null,
        wasmReadyMs: readyMark?.startTime ?? null,
      };
    });

    await throttledClient.detach();
    await throttledPage.close();

    const benchmarkPage = await browser.newPage();
    await benchmarkPage.goto(baseURL, { waitUntil: "domcontentloaded" });
    await benchmarkPage.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="run-button"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      },
      undefined,
      {
        timeout: 60_000,
      },
    );

    const evaluationMetrics = await benchmarkPage.evaluate(async () => {
      function buildComplexInput() {
        const items = [];

        while (JSON.stringify({ items }).length < 50_000) {
          const index = items.length;
          items.push({
            enabled: index % 2 === 0,
            group: `g${index % 7}`,
            id: index,
            meta: {
              label: `node-${index}`,
              region: `r-${index % 5}`,
              score: index % 11,
            },
            name: `item-${index}`,
          });
        }

        return JSON.stringify({ items });
      }

      async function runSeries(requestFactory) {
        const times = [];

        for (let index = 0; index < 20; index += 1) {
          const request = requestFactory();
          const startedAt = performance.now();
          await window.__engineTestControls?.evaluateDirect(request);
          times.push(performance.now() - startedAt);
        }

        return times;
      }

      const simpleInput = `value: "${"x".repeat(1024)}"\n`;
      const complexInput = buildComplexInput();

      const simpleTimes = await runSeries(() => ({
        expression: ".value",
        input: simpleInput,
        inputFormat: "yaml",
        outputFormat: "yaml",
      }));
      const complexTimes = await runSeries(() => ({
        expression: ".items[] | .name",
        input: complexInput,
        inputFormat: "json",
        outputFormat: "yaml",
      }));

      return {
        complexTimes,
        simpleTimes,
      };
    });

    const simpleSorted = [...evaluationMetrics.simpleTimes].sort(
      (left, right) => left - right,
    );
    const complexSorted = [...evaluationMetrics.complexTimes].sort(
      (left, right) => left - right,
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          baseURL,
          complex: {
            p50: percentile(complexSorted, 0.5),
            p95: percentile(complexSorted, 0.95),
            runs: evaluationMetrics.complexTimes,
          },
          firstEvaluationAfterReadyMs: loadMetrics.firstEvalDurationMs,
          simple: {
            p50: percentile(simpleSorted, 0.5),
            p95: percentile(simpleSorted, 0.95),
            runs: evaluationMetrics.simpleTimes,
          },
          wasmReadyMs: loadMetrics.wasmReadyMs,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
