import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultState,
  decodeHashState,
  encodeHashState,
} from "@/lib/playground-state";

test("round-trips playground state through the URL hash encoder", () => {
  const state = {
    ...createDefaultState(),
    expression: ".foo",
    input: "foo: bar\n",
    outputFormat: "json" as const,
  };

  const encoded = encodeHashState(state);
  const decoded = decodeHashState(encoded);

  assert.deepEqual(decoded, state);
});

test("ignores malformed hash state", () => {
  assert.equal(decodeHashState("#not-valid-base64"), null);
});

test("drops unsupported formats from decoded state", () => {
  const invalidPayload = Buffer.from(
    JSON.stringify({
      expression: ".foo",
      input: "foo: bar\n",
      inputFormat: "invalid",
      outputFormat: "also-invalid",
    }),
    "utf8",
  )
    .toString("base64url")
    .replace(/=/gu, "");

  assert.deepEqual(decodeHashState(invalidPayload), {
    expression: ".foo",
    input: "foo: bar\n",
  });
});
