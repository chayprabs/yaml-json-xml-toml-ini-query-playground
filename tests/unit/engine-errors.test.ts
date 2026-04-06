import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEngineError,
  toFriendlyEvaluationErrorMessage,
} from "@/lib/engine-errors";

test("maps parse failures to friendly expression errors", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "bad expression, please check expression syntax",
      "yaml",
      "yq",
    ),
    /expression could not be parsed/i,
  );
});

test("maps internal engine failures to a generic message", () => {
  assert.equal(
    toFriendlyEvaluationErrorMessage(
      "an internal error occurred",
      "json",
      "yq",
    ),
    "An internal error occurred.",
  );
});

test("maps yaml parse failures to an input-specific message", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "yaml: did not find expected key",
      "yaml",
      "yq",
    ),
    /yaml input could not be parsed/i,
  );
});

test("maps dasel selector parse failures to friendly selector errors", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage('invalid input text "["', "yaml", "dasel"),
    /selector could not be parsed/i,
  );
});

// ── Edge cases: error normalization ────────────────────────────────────

test("normalizeEngineError wraps Error instances as-is", () => {
  const error = new Error("test error");
  assert.equal(normalizeEngineError(error), error);
});

test("normalizeEngineError wraps strings into Error", () => {
  const error = normalizeEngineError("string error");
  assert.ok(error instanceof Error);
  assert.equal(error.message, "string error");
});

test("normalizeEngineError wraps non-string/non-Error as unknown", () => {
  const error = normalizeEngineError(42);
  assert.ok(error instanceof Error);
  assert.equal(error.message, "Unknown engine error.");
});

test("normalizeEngineError wraps null as unknown", () => {
  const error = normalizeEngineError(null);
  assert.ok(error instanceof Error);
  assert.equal(error.message, "Unknown engine error.");
});

test("normalizeEngineError wraps undefined as unknown", () => {
  const error = normalizeEngineError(undefined);
  assert.ok(error instanceof Error);
  assert.equal(error.message, "Unknown engine error.");
});

// ── Edge cases: timeout message ────────────────────────────────────────

test("maps execution timeout to friendly timeout message", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "execution timed out after 8s",
      "yaml",
      "yq",
    ),
    /timed out after 8s/i,
  );
});

// ── Edge cases: empty expression / input messages ──────────────────────

test("maps expression-required error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage("expression is required", "yaml", "yq"),
    /expression is required/i,
  );
});

test("maps selector-required error for dasel", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage("selector is required", "yaml", "dasel"),
    /selector is required/i,
  );
});

test("maps input-required error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage("input is required", "yaml", "yq"),
    /input is required/i,
  );
});

// ── Edge cases: unsupported format messages ────────────────────────────

test("maps unsupported input format with supported format list", () => {
  const msg = toFriendlyEvaluationErrorMessage(
    'unsupported input format "hcl"',
    "yaml",
    "yq",
  );
  assert.match(msg, /unsupported input format/i);
  assert.match(msg, /yaml/);
});

test("maps unsupported output format with supported format list", () => {
  const msg = toFriendlyEvaluationErrorMessage(
    'unsupported output format "ini"',
    "yaml",
    "yq",
  );
  assert.match(msg, /unsupported output format/i);
  assert.match(msg, /yaml/);
});

// ── Edge cases: Error: prefix stripping ────────────────────────────────

test("strips Error: prefix from raw messages", () => {
  const msg = toFriendlyEvaluationErrorMessage(
    "Error: something went wrong",
    "yaml",
    "yq",
  );
  assert.equal(msg, "something went wrong");
});

// ── Edge cases: multiline error uses only first line ───────────────────

test("uses only first line of multiline error messages", () => {
  const msg = toFriendlyEvaluationErrorMessage(
    "first line of error\nsecond line details\nthird line",
    "yaml",
    "yq",
  );
  assert.equal(msg, "first line of error");
});

// ── Edge cases: JSON parse failures ────────────────────────────────────

test("maps json invalid character to input parse error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "invalid character 'x' looking for beginning of value",
      "json",
      "yq",
    ),
    /json input could not be parsed/i,
  );
});

// ── Edge cases: XML parse failures ─────────────────────────────────────

test("maps xml syntax error to input parse error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "XML syntax error on line 1: unexpected EOF",
      "xml",
      "yq",
    ),
    /xml input could not be parsed/i,
  );
});

// ── Edge cases: TOML parse failures ────────────────────────────────────

test("maps toml decode error to input parse error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "toml: line 3 (last key \"x\"): expected value but got '='",
      "toml",
      "yq",
    ),
    /toml input could not be parsed/i,
  );
});

// ── Edge cases: CSV parse failures ─────────────────────────────────────

test("maps csv decode error to input parse error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "csv parse error on line 2: wrong number of fields",
      "csv",
      "yq",
    ),
    /csv input could not be parsed/i,
  );
});

// ── Edge cases: yq lexer errors ────────────────────────────────────────

test("maps yq lexer error to expression parse error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "lexer error: unexpected char",
      "yaml",
      "yq",
    ),
    /expression could not be parsed/i,
  );
});

// ── Edge cases: dasel parse selector errors ────────────────────────────

test("maps dasel unexpected token to selector parse error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage("unexpected token", "yaml", "dasel"),
    /selector could not be parsed/i,
  );
});

test("maps dasel unexpected eof to selector parse error", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage("unexpected eof", "yaml", "dasel"),
    /selector could not be parsed/i,
  );
});

// ── Edge cases: unknown error passthrough ──────────────────────────────

test("passes through unrecognized error messages as-is", () => {
  const msg = toFriendlyEvaluationErrorMessage(
    "something completely different happened",
    "yaml",
    "yq",
  );
  assert.equal(msg, "something completely different happened");
});
