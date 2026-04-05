import assert from "node:assert/strict";
import test from "node:test";

import {
  getHighlightLanguage,
  OUTPUT_HIGHLIGHT_THRESHOLD,
  OUTPUT_TRUNCATION_THRESHOLD,
  prepareOutput,
} from "@/lib/output";

test("keeps smaller output intact and highlightable", () => {
  const prepared = prepareOutput("hello");

  assert.equal(prepared.displayOutput, "hello");
  assert.equal(prepared.fullOutput, "hello");
  assert.equal(prepared.highlightEnabled, true);
  assert.equal(prepared.truncated, false);
});

test("disables highlighting before truncation for large output", () => {
  const prepared = prepareOutput("x".repeat(OUTPUT_HIGHLIGHT_THRESHOLD + 1));

  assert.equal(prepared.truncated, false);
  assert.equal(prepared.highlightEnabled, false);
});

test("truncates extremely large output and reports the hidden size", () => {
  const fullOutput = "x".repeat(OUTPUT_TRUNCATION_THRESHOLD + 25);
  const prepared = prepareOutput(fullOutput);

  assert.equal(prepared.truncated, true);
  assert.equal(prepared.displayOutput.length, OUTPUT_TRUNCATION_THRESHOLD);
  assert.equal(prepared.truncatedCharacters, 25);
});

// ── Edge cases: empty output ───────────────────────────────────────────

test("handles empty string output", () => {
  const prepared = prepareOutput("");
  assert.equal(prepared.displayOutput, "");
  assert.equal(prepared.fullOutput, "");
  assert.equal(prepared.highlightEnabled, true);
  assert.equal(prepared.truncated, false);
  assert.equal(prepared.truncatedCharacters, 0);
});

// ── Edge cases: boundary values ────────────────────────────────────────

test("output exactly at highlight threshold keeps highlighting enabled", () => {
  const prepared = prepareOutput("x".repeat(OUTPUT_HIGHLIGHT_THRESHOLD));
  assert.equal(prepared.highlightEnabled, true);
  assert.equal(prepared.truncated, false);
});

test("output exactly at truncation threshold is not truncated", () => {
  const prepared = prepareOutput("x".repeat(OUTPUT_TRUNCATION_THRESHOLD));
  assert.equal(prepared.truncated, false);
  assert.equal(prepared.displayOutput.length, OUTPUT_TRUNCATION_THRESHOLD);
});

test("output one char over truncation threshold is truncated", () => {
  const prepared = prepareOutput("x".repeat(OUTPUT_TRUNCATION_THRESHOLD + 1));
  assert.equal(prepared.truncated, true);
  assert.equal(prepared.truncatedCharacters, 1);
});

// ── Edge cases: fullOutput always contains the complete output ─────────

test("fullOutput preserves complete content even when truncated", () => {
  const content = "a".repeat(OUTPUT_TRUNCATION_THRESHOLD + 500);
  const prepared = prepareOutput(content);
  assert.equal(prepared.fullOutput, content);
  assert.equal(prepared.fullOutput.length, OUTPUT_TRUNCATION_THRESHOLD + 500);
});

// ── Edge cases: unicode output ─────────────────────────────────────────

test("handles unicode output correctly", () => {
  const prepared = prepareOutput("中文テスト 🎉");
  assert.equal(prepared.displayOutput, "中文テスト 🎉");
  assert.equal(prepared.highlightEnabled, true);
});

// ── Edge cases: getHighlightLanguage mapping ───────────────────────────

test("maps yaml to yaml", () => {
  assert.equal(getHighlightLanguage("yaml"), "yaml");
});

test("maps json to json", () => {
  assert.equal(getHighlightLanguage("json"), "json");
});

test("maps xml to xml", () => {
  assert.equal(getHighlightLanguage("xml"), "xml");
});

test("maps toml to toml", () => {
  assert.equal(getHighlightLanguage("toml"), "toml");
});

test("maps ini to ini", () => {
  assert.equal(getHighlightLanguage("ini"), "ini");
});

test("maps props to properties", () => {
  assert.equal(getHighlightLanguage("props"), "properties");
});

test("maps csv to plaintext", () => {
  assert.equal(getHighlightLanguage("csv"), "plaintext");
});

test("maps hcl to plaintext", () => {
  assert.equal(getHighlightLanguage("hcl"), "plaintext");
});
