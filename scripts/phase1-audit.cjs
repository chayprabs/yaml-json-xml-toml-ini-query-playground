const { chromium } = require("playwright");

const host = process.env.PLAYGROUND_HOST ?? "127.0.0.1";
const port = process.env.PLAYGROUND_PORT ?? "3000";
const BASE_URL = process.env.PLAYGROUND_BASE_URL ?? `http://${host}:${port}`;

function normalize(value) {
  return String(value).replace(/\r\n/g, "\n").trim();
}

function pretty(value) {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return JSON.stringify(value, null, 2);
}

function logResult(results, id, label, pass, actual, expected) {
  const status = pass ? "PASS" : "FAIL";
  const line = `${status} ${id}. ${label}\n  actual: ${pretty(actual)}\n  expected: ${pretty(expected)}`;
  console.log(line);
  results.push({ id, label, pass, actual, expected });
}

function isOrderedScalarSequence(actual, expectedValues) {
  const normalized = normalize(actual);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "---")
    .map((line) => line.replace(/^- /, "").trim().replace(/^"|"$/g, ""));

  return JSON.stringify(lines) === JSON.stringify(expectedValues);
}

function friendlyHasText(message, needle) {
  return normalize(message).toLowerCase().includes(needle.toLowerCase());
}

async function evaluateInBrowser(
  page,
  input,
  expression,
  inputFormat = "yaml",
  outputFormat = "yaml",
) {
  return page.evaluate(
    ({ innerInput, innerExpression, innerInputFormat, innerOutputFormat }) => {
      try {
        const value = window.engineEvaluate(
          innerInput,
          innerExpression,
          innerInputFormat,
          innerOutputFormat,
        );
        return { ok: true, value };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    {
      innerInput: input,
      innerExpression: expression,
      innerInputFormat: inputFormat,
      innerOutputFormat: outputFormat,
    },
  );
}

async function timedEvaluateInBrowser(
  page,
  input,
  expression,
  inputFormat = "yaml",
  outputFormat = "yaml",
) {
  return page.evaluate(
    ({ innerInput, innerExpression, innerInputFormat, innerOutputFormat }) => {
      const startedAt = performance.now();
      try {
        const value = window.engineEvaluate(
          innerInput,
          innerExpression,
          innerInputFormat,
          innerOutputFormat,
        );
        return { ok: true, value, durationMs: performance.now() - startedAt };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: performance.now() - startedAt,
        };
      }
    },
    {
      innerInput: input,
      innerExpression: expression,
      innerInputFormat: inputFormat,
      innerOutputFormat: outputFormat,
    },
  );
}

async function setPlayground(
  page,
  { input, expression, inputFormat, outputFormat },
) {
  if (typeof input === "string") {
    await page.getByTestId("input-editor").fill(input);
  }

  if (typeof expression === "string") {
    await page.getByTestId("expression-input").fill(expression);
  }

  if (typeof inputFormat === "string") {
    await page.getByTestId("input-format").selectOption(inputFormat);
  }

  if (typeof outputFormat === "string") {
    await page.getByTestId("output-format").selectOption(outputFormat);
  }
}

async function getOutputText(page) {
  return page
    .getByTestId("output-content")
    .evaluate((element) => element.textContent ?? "");
}

async function ensureAutoRun(page, enabled) {
  const toggle = page.getByTestId("auto-run-toggle");
  const isChecked = await toggle.isChecked();

  if (isChecked !== enabled) {
    await toggle.click();
  }
}

async function waitForPlaygroundIdle(page) {
  await page
    .getByTestId("run-button")
    .waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="run-button"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
}

async function runUiEvaluation(page, state) {
  await waitForPlaygroundIdle(page);
  await ensureAutoRun(page, false);
  await setPlayground(page, state);
  await page.getByTestId("run-button").click();
  await waitForPlaygroundIdle(page);

  const hasError = (await page.getByTestId("error-box").count()) > 0;
  const output = await getOutputText(page);
  const error = hasError ? await page.getByTestId("error-box").innerText() : "";

  return { output, error };
}

async function waitForReady(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(() => typeof window.engineEvaluate === "function");
  await page
    .getByTestId("loading-indicator")
    .waitFor({ state: "detached", timeout: 30000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  try {
    await waitForReady(page);

    const yamlSimple = await evaluateInBrowser(page, "foo: bar\n", ".foo");
    logResult(
      results,
      1,
      "YAML scalar lookup",
      yamlSimple.ok && normalize(yamlSimple.value) === "bar",
      yamlSimple.ok ? yamlSimple.value : yamlSimple.error,
      "bar",
    );

    const yamlDeep = await evaluateInBrowser(
      page,
      "a:\n  b:\n    c: 42",
      ".a.b.c",
    );
    logResult(
      results,
      2,
      "YAML nested lookup",
      yamlDeep.ok && normalize(yamlDeep.value) === "42",
      yamlDeep.ok ? yamlDeep.value : yamlDeep.error,
      "42",
    );

    const yamlItems = await evaluateInBrowser(
      page,
      "items:\n  - x\n  - y",
      ".items[]",
    );
    logResult(
      results,
      3,
      "YAML array iteration",
      yamlItems.ok && isOrderedScalarSequence(yamlItems.value, ["x", "y"]),
      yamlItems.ok ? yamlItems.value : yamlItems.error,
      "x\\ny",
    );

    const yamlKeys = await evaluateInBrowser(
      page,
      "x: 1\ny: 2\nz: 3",
      ". | keys",
    );
    logResult(
      results,
      4,
      "YAML keys",
      yamlKeys.ok && isOrderedScalarSequence(yamlKeys.value, ["x", "y", "z"]),
      yamlKeys.ok ? yamlKeys.value : yamlKeys.error,
      '["x","y","z"] or yaml list form',
    );

    const yamlAdd = await evaluateInBrowser(
      page,
      "x: 1\ny: 2\nz: 3",
      ".x + .y",
    );
    logResult(
      results,
      5,
      "YAML addition",
      yamlAdd.ok && normalize(yamlAdd.value) === "3",
      yamlAdd.ok ? yamlAdd.value : yamlAdd.error,
      "3",
    );

    const yamlMultiDoc = await evaluateInBrowser(page, "a: 1\n---\na: 2", ".a");
    const yamlMultiDocPass =
      yamlMultiDoc.ok &&
      (normalize(yamlMultiDoc.value) === "1\n---\n2" ||
        isOrderedScalarSequence(yamlMultiDoc.value, ["1", "2"]));
    logResult(
      results,
      6,
      "YAML multi-document handling",
      yamlMultiDocPass,
      yamlMultiDoc.ok ? yamlMultiDoc.value : yamlMultiDoc.error,
      "1\\n---\\n2 (or equivalent separate outputs)",
    );

    const yamlUpcase = await evaluateInBrowser(
      page,
      "name: test",
      ".name | upcase",
    );
    logResult(
      results,
      7,
      "YAML string function",
      yamlUpcase.ok && normalize(yamlUpcase.value) === "TEST",
      yamlUpcase.ok ? yamlUpcase.value : yamlUpcase.error,
      "TEST",
    );

    const yamlLength = await evaluateInBrowser(
      page,
      "list:\n  - 1\n  - 2",
      ".list | length",
    );
    logResult(
      results,
      8,
      "YAML length",
      yamlLength.ok && normalize(yamlLength.value) === "2",
      yamlLength.ok ? yamlLength.value : yamlLength.error,
      "2",
    );

    const yamlBadExpression = await evaluateInBrowser(
      page,
      "foo: bar",
      "totally invalid ???",
    );
    logResult(
      results,
      9,
      "Invalid expression surfaces error",
      !yamlBadExpression.ok && normalize(yamlBadExpression.error).length > 0,
      yamlBadExpression.ok ? yamlBadExpression.value : yamlBadExpression.error,
      "error message, no crash",
    );

    const yamlEmptyInput = await evaluateInBrowser(page, "", ".foo");
    logResult(
      results,
      10,
      "Empty YAML input is handled clearly",
      !yamlEmptyInput.ok && normalize(yamlEmptyInput.error).length > 0,
      yamlEmptyInput.ok ? yamlEmptyInput.value : yamlEmptyInput.error,
      "graceful error, not blank output",
    );

    const jsonName = await evaluateInBrowser(
      page,
      '{"name":"alice"}',
      ".name",
      "json",
      "yaml",
    );
    logResult(
      results,
      11,
      "JSON to YAML scalar",
      jsonName.ok && normalize(jsonName.value) === "alice",
      jsonName.ok ? jsonName.value : jsonName.error,
      "alice",
    );

    const jsonAdd = await evaluateInBrowser(
      page,
      '{"a":1,"b":2}',
      ".a + .b",
      "json",
      "yaml",
    );
    logResult(
      results,
      12,
      "JSON arithmetic",
      jsonAdd.ok && normalize(jsonAdd.value) === "3",
      jsonAdd.ok ? jsonAdd.value : jsonAdd.error,
      "3",
    );

    const jsonArray = await evaluateInBrowser(
      page,
      "[1,2,3]",
      ".[]",
      "json",
      "yaml",
    );
    logResult(
      results,
      13,
      "JSON array expansion",
      jsonArray.ok && isOrderedScalarSequence(jsonArray.value, ["1", "2", "3"]),
      jsonArray.ok ? jsonArray.value : jsonArray.error,
      "1\\n2\\n3",
    );

    const jsonNull = await evaluateInBrowser(
      page,
      '{"x": null}',
      ".x",
      "json",
      "yaml",
    );
    logResult(
      results,
      14,
      "JSON null scalar",
      jsonNull.ok && normalize(jsonNull.value) === "null",
      jsonNull.ok ? jsonNull.value : jsonNull.error,
      "null",
    );

    const jsonBadInput = await evaluateInBrowser(
      page,
      "not json at all",
      ".",
      "json",
      "yaml",
    );
    logResult(
      results,
      15,
      "Bad JSON input shows parse error",
      !jsonBadInput.ok && friendlyHasText(jsonBadInput.error, "json"),
      jsonBadInput.ok ? jsonBadInput.value : jsonBadInput.error,
      "parse error surfaced to UI",
    );

    const xmlName = await evaluateInBrowser(
      page,
      "<root><name>engine</name></root>",
      ".root.name",
      "xml",
      "yaml",
    );
    logResult(
      results,
      16,
      "XML element lookup",
      xmlName.ok && normalize(xmlName.value) === "engine",
      xmlName.ok ? xmlName.value : xmlName.error,
      "engine",
    );

    const xmlJson = await evaluateInBrowser(
      page,
      "<root><name>engine</name></root>",
      ".",
      "xml",
      "json",
    );
    let xmlJsonPass = false;
    let xmlJsonActual = xmlJson.ok ? xmlJson.value : xmlJson.error;
    if (xmlJson.ok) {
      try {
        const parsed = JSON.parse(xmlJson.value);
        xmlJsonPass = parsed.root && parsed.root.name === "engine";
        xmlJsonActual = parsed;
      } catch (error) {
        xmlJsonActual = error instanceof Error ? error.message : String(error);
      }
    }
    logResult(
      results,
      17,
      "XML to JSON conversion",
      xmlJsonPass,
      xmlJsonActual,
      'valid JSON object with root.name = "engine"',
    );

    const csvNames = await evaluateInBrowser(
      page,
      "name,age\nalice,30\nbob,25",
      ".[] | .name",
      "csv",
      "yaml",
    );
    logResult(
      results,
      18,
      "CSV row decoding",
      csvNames.ok && isOrderedScalarSequence(csvNames.value, ["alice", "bob"]),
      csvNames.ok ? csvNames.value : csvNames.error,
      "alice\\nbob",
    );

    const tomlPort = await evaluateInBrowser(
      page,
      "[server]\nport = 8080",
      ".server.port",
      "toml",
      "yaml",
    );
    logResult(
      results,
      19,
      "TOML lookup",
      tomlPort.ok && normalize(tomlPort.value) === "8080",
      tomlPort.ok ? tomlPort.value : tomlPort.error,
      "8080",
    );

    const roundTripYaml = `service:\n  name: api\n  ports:\n    - 80\n    - 443\n  labels:\n    tier: backend\n    active: true\n`;
    const yamlToJson = await evaluateInBrowser(
      page,
      roundTripYaml,
      ".",
      "yaml",
      "json",
    );
    const yamlBackToYaml = yamlToJson.ok
      ? await evaluateInBrowser(page, yamlToJson.value, ".", "json", "yaml")
      : { ok: false, error: yamlToJson.error };
    const yamlOriginalCanonical = await evaluateInBrowser(
      page,
      roundTripYaml,
      ".",
      "yaml",
      "json",
    );
    const yamlRoundtripCanonical = yamlBackToYaml.ok
      ? await evaluateInBrowser(page, yamlBackToYaml.value, ".", "yaml", "json")
      : { ok: false, error: yamlBackToYaml.error };
    let yamlRoundtripPass = false;
    let yamlRoundtripActual = yamlRoundtripCanonical.ok
      ? yamlRoundtripCanonical.value
      : yamlRoundtripCanonical.error;
    if (yamlOriginalCanonical.ok && yamlRoundtripCanonical.ok) {
      yamlRoundtripPass =
        JSON.stringify(JSON.parse(yamlOriginalCanonical.value)) ===
        JSON.stringify(JSON.parse(yamlRoundtripCanonical.value));
      yamlRoundtripActual = {
        original: JSON.parse(yamlOriginalCanonical.value),
        roundtrip: JSON.parse(yamlRoundtripCanonical.value),
      };
    }
    logResult(
      results,
      20,
      "YAML -> JSON -> YAML structural equality",
      yamlRoundtripPass,
      yamlRoundtripActual,
      "structural equality preserved",
    );

    const roundTripJson =
      '{"service":{"name":"api","ports":[80,443],"labels":{"tier":"backend","active":true}}}';
    const jsonToYaml = await evaluateInBrowser(
      page,
      roundTripJson,
      ".",
      "json",
      "yaml",
    );
    const jsonBackToJson = jsonToYaml.ok
      ? await evaluateInBrowser(page, jsonToYaml.value, ".", "yaml", "json")
      : { ok: false, error: jsonToYaml.error };
    let jsonRoundtripPass = false;
    let jsonRoundtripActual = jsonBackToJson.ok
      ? jsonBackToJson.value
      : jsonBackToJson.error;
    if (jsonBackToJson.ok) {
      jsonRoundtripPass =
        JSON.stringify(JSON.parse(roundTripJson)) ===
        JSON.stringify(JSON.parse(jsonBackToJson.value));
      jsonRoundtripActual = {
        original: JSON.parse(roundTripJson),
        roundtrip: JSON.parse(jsonBackToJson.value),
      };
    }
    logResult(
      results,
      21,
      "JSON -> YAML -> JSON structural equality",
      jsonRoundtripPass,
      jsonRoundtripActual,
      "structural equality preserved",
    );

    const comboInputs = {
      yaml: {
        input:
          "items:\n  - name: alice\n    age: 30\n  - name: bob\n    age: 25\n",
        expression: ".items",
      },
      json: {
        input: '{"items":[{"name":"alice","age":30},{"name":"bob","age":25}]}',
        expression: ".items",
      },
      xml: {
        input:
          "<root><item><name>alice</name><age>30</age></item><item><name>bob</name><age>25</age></item></root>",
        expression: ".root.item",
      },
      csv: { input: "name,age\nalice,30\nbob,25\n", expression: "." },
      toml: {
        input:
          '[[item]]\nname = "alice"\nage = 30\n\n[[item]]\nname = "bob"\nage = 25\n',
        expression: ".item",
      },
    };
    const comboResults = [];
    let comboCrash = false;
    for (const inputFormat of Object.keys(comboInputs)) {
      for (const outputFormat of [
        "yaml",
        "json",
        "xml",
        "csv",
        "toml",
        "props",
      ]) {
        const combo = comboInputs[inputFormat];
        const result = await evaluateInBrowser(
          page,
          combo.input,
          combo.expression,
          inputFormat,
          outputFormat,
        );
        comboResults.push({
          inputFormat,
          outputFormat,
          status: result.ok ? "valid output" : "error",
          detail: result.ok
            ? normalize(result.value).slice(0, 120)
            : normalize(result.error),
        });
        if (!result.ok && normalize(result.error).length === 0) {
          comboCrash = true;
        }
      }
    }
    logResult(
      results,
      22,
      "All format combinations return output or surfaced errors without crashing",
      !comboCrash,
      comboResults,
      "valid output or clear surfaced error for each 5x6 combination",
    );

    const largeInput = ["root:"];
    for (let index = 0; index < 900; index += 1) {
      largeInput.push(`  item_${index}:`);
      largeInput.push(`    enabled: true`);
      largeInput.push(`    label: "value_${index}"`);
      largeInput.push(`    nested:`);
      largeInput.push(`      count: ${index}`);
      largeInput.push(`      name: "node_${index}"`);
    }
    const largeYaml = `${largeInput.join("\n")}\n`;
    const largeResult = await timedEvaluateInBrowser(
      page,
      largeYaml,
      ".root.item_899.nested.name",
    );
    logResult(
      results,
      23,
      "Large YAML completes under 3 seconds",
      largeResult.ok &&
        normalize(largeResult.value) === "node_899" &&
        largeResult.durationMs < 3000,
      largeResult,
      'value "node_899" in under 3000ms',
    );

    const quotedExpression = await evaluateInBrowser(
      page,
      "foo: bar\n",
      '.foo | select(. == "bar")',
    );
    logResult(
      results,
      24,
      "Expression with quotes survives JS transport",
      quotedExpression.ok && normalize(quotedExpression.value) === "bar",
      quotedExpression.ok ? quotedExpression.value : quotedExpression.error,
      "bar",
    );

    const unicodeResult = await evaluateInBrowser(
      page,
      'name: "中文 عربي 😀"\n',
      ".name",
    );
    logResult(
      results,
      25,
      "Unicode content is preserved",
      unicodeResult.ok && normalize(unicodeResult.value) === "中文 عربي 😀",
      unicodeResult.ok ? unicodeResult.value : unicodeResult.error,
      "中文 عربي 😀",
    );

    const anchorsResult = await evaluateInBrowser(
      page,
      "base: &base\n  name: core\n  enabled: true\ncopy: *base\n",
      ".copy.name",
    );
    logResult(
      results,
      26,
      "YAML anchors and aliases resolve correctly",
      anchorsResult.ok && normalize(anchorsResult.value) === "core",
      anchorsResult.ok ? anchorsResult.value : anchorsResult.error,
      "core",
    );

    const windowsLineEndings = await evaluateInBrowser(
      page,
      "foo: bar\r\nbaz: qux\r\n",
      ".baz",
    );
    logResult(
      results,
      27,
      "Windows line endings are handled",
      windowsLineEndings.ok && normalize(windowsLineEndings.value) === "qux",
      windowsLineEndings.ok
        ? windowsLineEndings.value
        : windowsLineEndings.error,
      "qux",
    );

    const noInputUi = await runUiEvaluation(page, {
      input: "",
      expression: ".foo",
      inputFormat: "yaml",
      outputFormat: "yaml",
    });
    const noInputPass =
      normalize(noInputUi.error).length > 0 &&
      friendlyHasText(noInputUi.error, "input");
    logResult(
      results,
      28,
      "Clicking Run with no input shows a clear message",
      noInputPass,
      noInputUi,
      "clear input-related UI error",
    );

    const noExpressionUi = await runUiEvaluation(page, {
      input: "foo: bar\n",
      expression: "",
      inputFormat: "yaml",
      outputFormat: "yaml",
    });
    const noExpressionPass =
      normalize(noExpressionUi.error).length > 0 &&
      friendlyHasText(noExpressionUi.error, "expression");
    logResult(
      results,
      29,
      "Clicking Run with no expression shows a clear message",
      noExpressionPass,
      noExpressionUi,
      "clear expression-related UI error",
    );

    await waitForPlaygroundIdle(page);
    await setPlayground(page, {
      input: "foo: bar\n",
      expression: ".foo",
      inputFormat: "yaml",
      outputFormat: "yaml",
    });
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="run-button"]');
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error("Run button not found");
      }

      for (let index = 0; index < 10; index += 1) {
        button.click();
      }
    });
    await waitForPlaygroundIdle(page);
    const rapidFireOutput = await page
      .getByTestId("output-content")
      .evaluate((element) => element.textContent ?? "");
    const rapidFireError =
      (await page.getByTestId("error-box").count()) > 0
        ? await page.getByTestId("error-box").innerText()
        : "";
    const rapidFirePass =
      normalize(rapidFireOutput) === "bar" && normalize(rapidFireError) === "";
    logResult(
      results,
      30,
      "Rapid Run clicks do not create races or duplicate output",
      rapidFirePass,
      { output: rapidFireOutput, error: rapidFireError },
      'single stable output "bar" and no error',
    );
  } finally {
    await page.close();
    await browser.close();
  }

  const failed = results.filter((result) => !result.pass);
  console.log(
    `\nPhase 1 summary: ${results.length - failed.length}/${results.length} passed.`,
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
