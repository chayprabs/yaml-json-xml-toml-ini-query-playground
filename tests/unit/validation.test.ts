import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_EXPRESSION_CHARS,
  validateRunRequest,
  VALIDATION_MESSAGES,
} from "@/lib/validation";

test("empty input", () => {
  const r = validateRunRequest("yq", "   ", ".foo", "yaml", "yaml");
  assert.equal(r.ok, false);
  assert.equal(r.message, VALIDATION_MESSAGES.emptyInput);
});

test("empty expression", () => {
  const r = validateRunRequest("yq", "a\n", "  ", "yaml", "yaml");
  assert.equal(r.ok, false);
  assert.equal(r.message, VALIDATION_MESSAGES.emptyExpression);
});

test("input over 2 MB", () => {
  const chunk = "x".repeat(1024);
  const input = chunk.repeat(2_097);
  const r = validateRunRequest("yq", input, ".", "yaml", "yaml");
  assert.equal(r.ok, false);
  assert.equal(r.message, VALIDATION_MESSAGES.inputTooLarge);
});

test("expression over max length", () => {
  const expr = "x".repeat(MAX_EXPRESSION_CHARS + 1);
  const r = validateRunRequest("yq", "a\n", expr, "yaml", "yaml");
  assert.equal(r.ok, false);
  assert.equal(r.message, VALIDATION_MESSAGES.expressionTooLong);
});

test("INI with expression engine", () => {
  const r = validateRunRequest("yq", "[a]\nb=1", ".", "ini", "yaml");
  assert.equal(r.ok, false);
  assert.equal(r.message, VALIDATION_MESSAGES.iniUnsupportedYq);
});

test("HCL with expression engine", () => {
  const r = validateRunRequest("yq", 'a = "b"', ".", "hcl", "yaml");
  assert.equal(r.ok, false);
  assert.equal(r.message, VALIDATION_MESSAGES.hclUnsupportedYq);
});

test("Properties with selector engine", () => {
  const r = validateRunRequest("dasel", "a\n", ".", "yaml", "props");
  assert.equal(r.ok, false);
  assert.equal(r.message, VALIDATION_MESSAGES.propsOutputDasel);
});

test("acceptable request", () => {
  const r = validateRunRequest("yq", "a: 1\n", ".a", "yaml", "yaml");
  assert.equal(r.ok, true);
});
