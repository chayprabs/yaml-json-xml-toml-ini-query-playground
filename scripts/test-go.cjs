const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { setupWasmExec } = require("./setup-wasm-exec.cjs");

const rootDir = path.resolve(__dirname, "..");
const packages = ["./wasm/yq", "./wasm/dasel"];

function quoteExecPart(value) {
  if (!/[\s'"]/.test(value)) {
    return value;
  }

  if (!value.includes("'")) {
    return `'${value}'`;
  }

  if (!value.includes('"')) {
    return `"${value}"`;
  }

  throw new Error(`Cannot quote exec argument: ${value}`);
}

function getExitCode(result, label) {
  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number") {
    return result.status;
  }

  if (result.signal) {
    throw new Error(`${label} exited from signal ${result.signal}.`);
  }

  return 0;
}

const execPath = [process.execPath, path.join(__dirname, "go-js-wasm-exec.cjs")]
  .map(quoteExecPart)
  .join(" ");

setupWasmExec();

const hostResult = spawnSync(
  process.execPath,
  [path.join(__dirname, "run-go.cjs"), "test", ...packages],
  {
    cwd: rootDir,
    stdio: "inherit",
  },
);

const hostStatus = getExitCode(hostResult, "Host Go tests");
if (hostStatus !== 0) {
  process.exitCode = hostStatus;
} else {
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

  process.exitCode = getExitCode(wasmResult, "WASM Go tests");
}
