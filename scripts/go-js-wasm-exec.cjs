const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

const candidates = [
  path.join(
    process.env.USERPROFILE ?? "",
    ".codex-toolchains",
    "go",
    "lib",
    "wasm",
    "wasm_exec_node.js",
  ),
  path.join(repoRoot, ".tools", "go", "lib", "wasm", "wasm_exec_node.js"),
];

const wasmExecNode = candidates.find(
  (candidate) => candidate && existsSync(candidate),
);

if (!wasmExecNode) {
  process.stderr.write("wasm_exec_node.js not found.\n");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--stack-size=8192", wasmExecNode, ...process.argv.slice(2)],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
