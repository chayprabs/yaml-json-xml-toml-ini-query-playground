const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const externalGo = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  ".codex-toolchains",
  "go",
  "bin",
  process.platform === "win32" ? "go.exe" : "go",
);
const localGo = path.join(
  rootDir,
  ".tools",
  "go",
  "bin",
  process.platform === "win32" ? "go.exe" : "go",
);

const candidates = [externalGo, localGo, "go"].filter(
  (candidate, index, all) =>
    candidate &&
    all.indexOf(candidate) === index &&
    (candidate === "go" || existsSync(candidate)),
);
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-go.cjs <go args...>");
  process.exit(1);
}

for (const candidate of candidates) {
  const result = spawnSync(candidate, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    continue;
  }

  process.exit(result.status ?? 0);
}

console.error(
  "Go toolchain not found. Install Go or provide .tools/go or %USERPROFILE%/.codex-toolchains/go.",
);
process.exit(1);
