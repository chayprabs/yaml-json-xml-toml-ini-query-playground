import assert from "node:assert/strict";
import { test } from "node:test";

import { truncateInputToMaxBytes, getInputByteSize, MAX_INPUT_BYTES } from "@/lib/validation";

test("truncateInputToMaxBytes caps shared-link payloads", () => {
  const huge = "x".repeat(MAX_INPUT_BYTES + 50_000);
  const { text, truncated } = truncateInputToMaxBytes(huge);

  assert.equal(truncated, true);
  assert.ok(getInputByteSize(text) <= MAX_INPUT_BYTES);
});
