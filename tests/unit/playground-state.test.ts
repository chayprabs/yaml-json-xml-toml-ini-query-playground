import assert from "node:assert/strict";
import test from "node:test";

import {
  createEngineEvaluateOptions,
  createDefaultState,
  decodeHashState,
  encodeHashState,
  parseFlagMap,
  parseVariableMap,
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
