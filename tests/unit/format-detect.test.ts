import assert from "node:assert/strict";
import { test } from "node:test";

import { detectInputFormat } from "@/lib/format-detect";

test("detects JSON objects", () => {
  assert.equal(detectInputFormat('{"a":1}'), "json");
});

test("detects YAML maps", () => {
  assert.equal(detectInputFormat("foo:\n  bar: 1\n"), "yaml");
});

test("detects INI sections", () => {
  assert.equal(detectInputFormat("[server]\nport=8080\n"), "ini");
});
