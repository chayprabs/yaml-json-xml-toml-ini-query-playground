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

function getCommandStatus(result, label) {
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

function runNodeCommand(label, args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    stdio: "inherit",
    ...options,
  });

  return getCommandStatus(result, label);
}

function main() {
  const execPath = [process.execPath, path.join(__dirname, "go-js-wasm-exec.cjs")]
    .map(quoteExecPart)
    .join(" ");

  setupWasmExec();

  const hostStatus = runNodeCommand("Host Go tests", [
    path.join(__dirname, "run-go.cjs"),
    "test",
    ...packages,
  ]);
  if (hostStatus !== 0) {
    return hostStatus;
  }

  const wasmEnv = {
    ...process.env,
    GOARCH: "wasm",
    GOOS: "js",
  };

  return runNodeCommand(
    "WASM Go tests",
    [path.join(__dirname, "run-go.cjs"), "test", "-exec", execPath, ...packages],
    {
      env: wasmEnv,
    },
  );
}

try {
  process.exitCode = main();
} catch (error) {
  const message =
    error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
