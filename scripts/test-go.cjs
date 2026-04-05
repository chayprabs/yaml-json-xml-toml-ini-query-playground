const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const execWrapperWindows = path.join(__dirname, "go-js-wasm-exec.cmd");
const packages = ["./wasm/yq", "./wasm/dasel"];

function resolveGoWasmExec() {
  const gorootResult = spawnSync(
    process.execPath,
    [path.join(__dirname, "run-go.cjs"), "env", "GOROOT"],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (gorootResult.status !== 0) {
    process.stderr.write(gorootResult.stderr || "Failed to resolve GOROOT.\n");
    process.exit(gorootResult.status ?? 1);
  }

  const goroot = gorootResult.stdout.trim();
  const candidates = [
    path.join(goroot, "lib", "wasm", "go_js_wasm_exec"),
    path.join(goroot, "misc", "wasm", "go_js_wasm_exec"),
  ];

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    process.stderr.write(`go_js_wasm_exec not found under GOROOT: ${goroot}\n`);
    process.exit(1);
  }

  return match;
}

const execPath =
  process.platform === "win32" ? execWrapperWindows : resolveGoWasmExec();

const hostResult = spawnSync(
  process.execPath,
  [path.join(__dirname, "run-go.cjs"), "test", ...packages],
  {
    cwd: rootDir,
    stdio: "inherit",
  },
);

if (hostResult.status !== 0) {
  process.exit(hostResult.status ?? 1);
}

const wasmEnv = {
  ...process.env,
  GOARCH: "wasm",
  GOOS: "js",
};

const wasmResult = spawnSync(
  process.execPath,
  [path.join(__dirname, "run-go.cjs"), "test", "-exec", execPath, ...packages],
  {
    cwd: rootDir,
    env: wasmEnv,
    stdio: "inherit",
  },
);

process.exit(wasmResult.status ?? 1);
