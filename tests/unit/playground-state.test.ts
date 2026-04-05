import assert from "node:assert/strict";
import test from "node:test";

import {
  canAutoRun,
  createEngineEvaluateOptions,
  createDefaultState,
  createRunSnapshot,
  decodeHashState,
  encodeHashState,
  normalizeFormatsForEngine,
  parseFlagMap,
  parseVariableMap,
  serializeRunSnapshot,
  supportsNoDoc,
  supportsPrettyPrint,
  supportsUnwrapScalar,
  MAX_SHAREABLE_HASH_LENGTH,
} from "@/lib/playground-state";

test("round-trips playground state through the URL hash encoder", () => {
  const state = {
    ...createDefaultState(),
    engine: "dasel" as const,
    expression: ".foo",
    input: "foo: bar\n",
    readFlagsText: "xml-mode=structured",
    returnRoot: true,
    outputFormat: "json" as const,
    variablesText: 'cfg=json:{"region":"ap-south-1"}',
    writeFlagsText: "hcl-block-format=array",
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
      engine: "invalid",
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

test("parses dasel flag text into key-value maps", () => {
  assert.deepEqual(parseFlagMap("csv-delimiter=;\nxml-mode=structured"), {
    "csv-delimiter": ";",
    "xml-mode": "structured",
  });
});

test("parses dasel variable text into key-value maps", () => {
  assert.deepEqual(parseVariableMap('cfg=json:{"region":"ap-south-1"}'), {
    cfg: 'json:{"region":"ap-south-1"}',
  });
});

test("builds dasel evaluate options from the run snapshot", () => {
  const options = createEngineEvaluateOptions({
    ...createDefaultState(),
    engine: "dasel",
    expression: "server.http_port",
    input: "[server]\nhttp_port=9999\n",
    inputFormat: "ini",
    outputFormat: "yaml",
    readFlagsText: "xml-mode=structured",
    returnRoot: true,
    unstable: true,
    variablesText: 'cfg=json:{"region":"ap-south-1"}',
    writeFlagsText: "hcl-block-format=array",
  });

  assert.deepEqual(options, {
    readFlags: {
      "xml-mode": "structured",
    },
    returnRoot: true,
    unstable: true,
    variables: {
      cfg: 'json:{"region":"ap-south-1"}',
    },
    writeFlags: {
      "hcl-block-format": "array",
    },
  });
});

// ── Edge cases: hash encoding ──────────────────────────────────────────

test("decodeHashState returns null for empty string", () => {
  assert.equal(decodeHashState(""), null);
  assert.equal(decodeHashState("#"), null);
  assert.equal(decodeHashState("   "), null);
});

test("decodeHashState returns null for non-JSON base64", () => {
  const encoded = Buffer.from("not json", "utf8").toString("base64url");
  assert.equal(decodeHashState(encoded), null);
});

test("decodeHashState returns null for base64-encoded non-object", () => {
  const encoded = Buffer.from('"just a string"', "utf8").toString("base64url");
  assert.equal(decodeHashState(encoded), null);
});

test("decodeHashState returns null for base64-encoded array", () => {
  const encoded = Buffer.from("[1,2,3]", "utf8").toString("base64url");
  assert.equal(decodeHashState(encoded), null);
});

test("decodeHashState preserves unicode content", () => {
  const state = {
    ...createDefaultState(),
    input: "名前: テスト\n",
    expression: ".名前",
  };
  const encoded = encodeHashState(state);
  const decoded = decodeHashState(encoded);
  assert.equal(decoded?.input, "名前: テスト\n");
  assert.equal(decoded?.expression, ".名前");
});

test("decodeHashState ignores unknown keys and preserves known ones", () => {
  const payload = {
    engine: "yq",
    expression: ".foo",
    unknownKey: "should be dropped",
    anotherUnknown: 42,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64url")
    .replace(/=/gu, "");
  const decoded = decodeHashState(encoded);
  assert.equal(decoded?.engine, "yq");
  assert.equal(decoded?.expression, ".foo");
  assert.equal((decoded as Record<string, unknown>).unknownKey, undefined);
});

test("decodeHashState rejects non-boolean for boolean fields", () => {
  const payload = {
    autoRun: "yes",
    noDoc: 1,
    prettyPrint: null,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64url")
    .replace(/=/gu, "");
  const decoded = decodeHashState(encoded);
  assert.equal(decoded?.autoRun, undefined);
  assert.equal(decoded?.noDoc, undefined);
  assert.equal(decoded?.prettyPrint, undefined);
});

// ── Edge cases: format normalization ───────────────────────────────────

test("normalizeFormatsForEngine falls back for unsupported formats", () => {
  const state = {
    ...createDefaultState(),
    engine: "yq" as const,
    inputFormat: "hcl" as const,
    outputFormat: "hcl" as const,
  };
  const normalized = normalizeFormatsForEngine(state);
  assert.equal(normalized.inputFormat, "yaml");
  assert.equal(normalized.outputFormat, "yaml");
});

test("normalizeFormatsForEngine keeps supported formats unchanged", () => {
  const state = {
    ...createDefaultState(),
    engine: "dasel" as const,
    inputFormat: "hcl" as const,
    outputFormat: "ini" as const,
  };
  const normalized = normalizeFormatsForEngine(state);
  assert.equal(normalized.inputFormat, "hcl");
  assert.equal(normalized.outputFormat, "ini");
});

// ── Edge cases: canAutoRun ─────────────────────────────────────────────

test("canAutoRun returns false for empty expression", () => {
  const snapshot = createRunSnapshot({
    ...createDefaultState(),
    expression: "",
  });
  assert.equal(canAutoRun(snapshot), false);
});

test("canAutoRun returns false for whitespace-only expression", () => {
  const snapshot = createRunSnapshot({
    ...createDefaultState(),
    expression: "   \n  ",
  });
  assert.equal(canAutoRun(snapshot), false);
});

test("canAutoRun returns false for yq with empty input", () => {
  const snapshot = createRunSnapshot({
    ...createDefaultState(),
    engine: "yq",
    expression: ".foo",
    input: "",
  });
  assert.equal(canAutoRun(snapshot), false);
});

test("canAutoRun returns true for dasel with empty input", () => {
  const snapshot = createRunSnapshot({
    ...createDefaultState(),
    engine: "dasel",
    expression: "$cfg.region",
    input: "",
    inputFormat: "yaml",
    outputFormat: "yaml",
  });
  assert.equal(canAutoRun(snapshot), true);
});

// ── Edge cases: toggle support functions ───────────────────────────────

test("supportsNoDoc only for yq + yaml output", () => {
  assert.equal(supportsNoDoc("yq", "yaml"), true);
  assert.equal(supportsNoDoc("yq", "json"), false);
  assert.equal(supportsNoDoc("dasel", "yaml"), false);
});

test("supportsPrettyPrint only for yq + yaml output", () => {
  assert.equal(supportsPrettyPrint("yq", "yaml"), true);
  assert.equal(supportsPrettyPrint("yq", "json"), false);
  assert.equal(supportsPrettyPrint("dasel", "yaml"), false);
});

test("supportsUnwrapScalar for yq yaml/json/props only", () => {
  assert.equal(supportsUnwrapScalar("yq", "yaml"), true);
  assert.equal(supportsUnwrapScalar("yq", "json"), true);
  assert.equal(supportsUnwrapScalar("yq", "props"), true);
  assert.equal(supportsUnwrapScalar("yq", "xml"), false);
  assert.equal(supportsUnwrapScalar("yq", "csv"), false);
  assert.equal(supportsUnwrapScalar("dasel", "yaml"), false);
});

// ── Edge cases: createRunSnapshot strips engine-specific fields ────────

test("createRunSnapshot zeroes yq-only fields for dasel engine", () => {
  const snapshot = createRunSnapshot({
    ...createDefaultState(),
    engine: "dasel",
    noDoc: true,
    prettyPrint: true,
    unwrapScalar: true,
    inputFormat: "yaml",
    outputFormat: "yaml",
  });
  assert.equal(snapshot.noDoc, false);
  assert.equal(snapshot.prettyPrint, false);
  assert.equal(snapshot.unwrapScalar, false);
});

test("createRunSnapshot zeroes dasel-only fields for yq engine", () => {
  const snapshot = createRunSnapshot({
    ...createDefaultState(),
    engine: "yq",
    returnRoot: true,
    unstable: true,
    readFlagsText: "csv-delimiter=;",
    writeFlagsText: "hcl-block-format=array",
    variablesText: "cfg=json:{}",
  });
  assert.equal(snapshot.returnRoot, false);
  assert.equal(snapshot.unstable, false);
  assert.equal(snapshot.readFlagsText, "");
  assert.equal(snapshot.writeFlagsText, "");
  assert.equal(snapshot.variablesText, "");
});

// ── Edge cases: parseFlagMap ───────────────────────────────────────────

test("parseFlagMap handles empty string", () => {
  assert.deepEqual(parseFlagMap(""), {});
});

test("parseFlagMap handles comma-separated flags", () => {
  assert.deepEqual(parseFlagMap("a=1,b=2"), { a: "1", b: "2" });
});

test("parseFlagMap throws on missing value", () => {
  assert.throws(() => parseFlagMap("novalue"), /Invalid dasel flag/);
});

test("parseFlagMap throws on trailing equals", () => {
  assert.throws(() => parseFlagMap("key="), /Invalid dasel flag/);
});

test("parseFlagMap throws on leading equals", () => {
  assert.throws(() => parseFlagMap("=value"), /Invalid dasel flag/);
});

// ── Edge cases: parseVariableMap ───────────────────────────────────────

test("parseVariableMap handles empty string", () => {
  assert.deepEqual(parseVariableMap(""), {});
});

test("parseVariableMap handles multi-line variables", () => {
  assert.deepEqual(parseVariableMap("a=1\nb=2"), { a: "1", b: "2" });
});

test("parseVariableMap preserves format:value syntax", () => {
  assert.deepEqual(parseVariableMap('cfg=json:{"x":1}'), {
    cfg: 'json:{"x":1}',
  });
});

test("parseVariableMap throws on missing value", () => {
  assert.throws(() => parseVariableMap("novalue"), /Invalid dasel variable/);
});

// ── Edge cases: serializeRunSnapshot determinism ───────────────────────

test("serializeRunSnapshot produces identical output for identical snapshots", () => {
  const state = createDefaultState();
  const a = serializeRunSnapshot(createRunSnapshot(state));
  const b = serializeRunSnapshot(createRunSnapshot(state));
  assert.equal(a, b);
});

// ── Edge cases: MAX_SHAREABLE_HASH_LENGTH ──────────────────────────────

test("encodeHashState with large input exceeds MAX_SHAREABLE_HASH_LENGTH", () => {
  const state = {
    ...createDefaultState(),
    input: "x".repeat(5000),
  };
  const encoded = encodeHashState(state);
  assert.ok(encoded.length > MAX_SHAREABLE_HASH_LENGTH);
});

// ── Edge cases: yq evaluate options from snapshot ──────────────────────

test("builds yq evaluate options from the run snapshot", () => {
  const options = createEngineEvaluateOptions({
    ...createDefaultState(),
    engine: "yq",
    expression: ".foo",
    noDoc: true,
    prettyPrint: true,
    unwrapScalar: false,
    outputFormat: "yaml",
  });
  assert.deepEqual(options, {
    noDoc: true,
    prettyPrint: true,
    unwrapScalar: false,
  });
});
