const { copyFileSync, existsSync, mkdirSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const runGoScript = path.join(__dirname, "run-go.cjs");
const sourcePath = path.join(rootDir, "public", "wasm_exec.js");

function getGoRoot() {
  const result = spawnSync(process.execPath, [runGoScript, "env", "GOROOT"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const goroot = result.stdout.trim();
  if (!goroot) {
    throw new Error("Unable to resolve GOROOT.");
  }

  return goroot;
}

function resolveDestinationPath(goroot) {
  const libPath = path.join(goroot, "lib", "wasm");
  if (existsSync(libPath)) {
    return path.join(libPath, "wasm_exec.js");
  }

  const miscPath = path.join(goroot, "misc", "wasm");
  if (existsSync(miscPath)) {
    return path.join(miscPath, "wasm_exec.js");
  }

  return path.join(libPath, "wasm_exec.js");
}

function setupWasmExec() {
  const destinationPath = resolveDestinationPath(getGoRoot());
  if (!existsSync(sourcePath)) {
    if (existsSync(destinationPath)) {
      return destinationPath;
    }

    throw new Error(
      `wasm_exec.js not found at ${sourcePath}. Generate or download it before running Go WASM commands.`,
    );
  }

  mkdirSync(path.dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
  return destinationPath;
}

if (require.main === module) {
  process.stdout.write(`${setupWasmExec()}\n`);
}

module.exports = { getGoRoot, setupWasmExec };
