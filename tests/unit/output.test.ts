import assert from "node:assert/strict";
import test from "node:test";

import {
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
