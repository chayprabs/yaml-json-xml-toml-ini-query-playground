const { existsSync, readFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TextDecoder, TextEncoder } = require("node:util");
const { performance } = require("node:perf_hooks");
const { webcrypto } = require("node:crypto");
const { getGoRoot } = require("./setup-wasm-exec.cjs");

const repoRoot = path.resolve(__dirname, "..");
let resolvedGoRoot = process.env.GOROOT ?? "";

if (!resolvedGoRoot) {
  try {
    resolvedGoRoot = getGoRoot();
  } catch {
    resolvedGoRoot = "";
  }
}

if (process.argv.length < 3) {
  process.stderr.write("usage: go-js-wasm-exec [wasm binary] [arguments]\n");
  process.exit(1);
}

const candidates = [
  path.join(resolvedGoRoot, "lib", "wasm", "wasm_exec.js"),
  path.join(resolvedGoRoot, "misc", "wasm", "wasm_exec.js"),
  path.join(
    process.env.USERPROFILE ?? "",
    ".codex-toolchains",
    "go",
    "lib",
    "wasm",
    "wasm_exec.js",
  ),
  path.join(
    process.env.HOME ?? "",
    ".codex-toolchains",
    "go",
    "lib",
    "wasm",
    "wasm_exec.js",
  ),
  path.join(repoRoot, ".tools", "go", "lib", "wasm", "wasm_exec.js"),
];

const wasmExecPath = candidates.find(
  (candidate) => candidate && existsSync(candidate),
);

if (!wasmExecPath) {
  process.stderr.write("wasm_exec.js not found.\n");
  process.exit(1);
}

globalThis.require = require;
globalThis.fs = require("node:fs");
globalThis.path = require("node:path");
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
globalThis.performance ??= performance;
globalThis.crypto ??= webcrypto;

require(wasmExecPath);

const go = new Go();
go.argv = process.argv.slice(2);

// Keep the WASM runtime environment tiny so CI providers with very large
// process environments do not overflow Go's fixed argv/env space.
const preservedEnvKeys = [
  "CI",
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "PWD",
  "TEMP",
  "TMP",
  "TZ",
  "USERPROFILE",
];
const wasmEnv = { TMPDIR: os.tmpdir() };
for (const key of preservedEnvKeys) {
  const value = process.env[key];
  if (typeof value === "string" && value.length > 0) {
    wasmEnv[key] = value;
  }
}

go.env = wasmEnv;
go.exit = process.exit;

WebAssembly.instantiate(readFileSync(process.argv[2]), go.importObject)
  .then((result) => {
    process.on("exit", (code) => {
      if (code === 0 && !go.exited) {
        go._pendingEvent = { id: 0 };
        go._resume();
      }
    });

    return go.run(result.instance);
  })
  .catch((error) => {
    process.stderr.write(`${error}\n`);
    process.exit(1);
  });
