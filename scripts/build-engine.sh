#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_GO_SCRIPT="$ROOT_DIR/scripts/run-go.cjs"
GZIP_SCRIPT="$ROOT_DIR/scripts/gzip-file.cjs"
SETUP_WASM_EXEC_SCRIPT="$ROOT_DIR/scripts/setup-wasm-exec.cjs"
ROOT_DIR_FOR_NODE="$ROOT_DIR"
RUN_GO_SCRIPT_FOR_NODE="$RUN_GO_SCRIPT"
GZIP_SCRIPT_FOR_NODE="$GZIP_SCRIPT"
SETUP_WASM_EXEC_SCRIPT_FOR_NODE="$SETUP_WASM_EXEC_SCRIPT"
ENGINE_NAMES=("engine-yq" "engine-dasel")

if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif command -v node.exe >/dev/null 2>&1; then
  NODE_BIN="$(command -v node.exe)"
else
  echo "Node.js not found on PATH." >&2
  exit 1
fi

if [[ "$NODE_BIN" == *.exe ]]; then
  if command -v wslpath >/dev/null 2>&1; then
    ROOT_DIR_FOR_NODE="$(wslpath -w "$ROOT_DIR")"
    RUN_GO_SCRIPT_FOR_NODE="$(wslpath -w "$RUN_GO_SCRIPT")"
    GZIP_SCRIPT_FOR_NODE="$(wslpath -w "$GZIP_SCRIPT")"
    SETUP_WASM_EXEC_SCRIPT_FOR_NODE="$(wslpath -w "$SETUP_WASM_EXEC_SCRIPT")"
  elif command -v cygpath >/dev/null 2>&1; then
    ROOT_DIR_FOR_NODE="$(cygpath -w "$ROOT_DIR")"
    RUN_GO_SCRIPT_FOR_NODE="$(cygpath -w "$RUN_GO_SCRIPT")"
    GZIP_SCRIPT_FOR_NODE="$(cygpath -w "$GZIP_SCRIPT")"
    SETUP_WASM_EXEC_SCRIPT_FOR_NODE="$(cygpath -w "$SETUP_WASM_EXEC_SCRIPT")"
  fi
fi

mkdir -p "$ROOT_DIR/public"
rm -f \
  "$ROOT_DIR/public/engine.wasm" \
  "$ROOT_DIR/public/engine.wasm.gz"

pushd "$ROOT_DIR" >/dev/null
GO_VERSION="$("$NODE_BIN" "$RUN_GO_SCRIPT_FOR_NODE" env GOVERSION | tr -d '\r')"
if [[ -z "$GO_VERSION" ]]; then
  echo "Unable to determine the active Go toolchain version." >&2
  exit 1
fi

WASM_EXEC_BASE_URL="https://raw.githubusercontent.com/golang/go/${GO_VERSION}"
if ! curl -fsSL -o public/wasm_exec.js "${WASM_EXEC_BASE_URL}/lib/wasm/wasm_exec.js"; then
  curl -fsSL -o public/wasm_exec.js "${WASM_EXEC_BASE_URL}/misc/wasm/wasm_exec.js"
fi
"$NODE_BIN" "$SETUP_WASM_EXEC_SCRIPT_FOR_NODE" >/dev/null
if [[ "$NODE_BIN" == *.exe ]]; then
  ROOT_DIR_WIN="$ROOT_DIR_FOR_NODE"

  powershell.exe -NoProfile -Command "\
    \$root='$ROOT_DIR_WIN'; \
    \$goCandidates=@((Join-Path \$env:USERPROFILE '.codex-toolchains\\go\\bin\\go.exe'), (Join-Path \$root '.tools\\go\\bin\\go.exe'), 'go.exe'); \
    \$go=\$goCandidates | Where-Object { \$_ -eq 'go.exe' -or (Test-Path \$_) } | Select-Object -First 1; \
    if (-not \$go) { throw 'Go toolchain not found.' }; \
    \$env:GOOS='js'; \
    \$env:GOARCH='wasm'; \
    \$builds=@( \
      @{ Out='public\\engine-yq.wasm'; Pkg='./wasm/yq' }, \
      @{ Out='public\\engine-dasel.wasm'; Pkg='./wasm/dasel' } \
    ); \
    foreach (\$build in \$builds) { \
      & \$go build -ldflags='-s -w' -o (Join-Path \$root \$build.Out) \$build.Pkg; \
    }; \
  "
else
  GOOS=js GOARCH=wasm "$NODE_BIN" "$RUN_GO_SCRIPT_FOR_NODE" build "-ldflags=-s -w" -o "$ROOT_DIR_FOR_NODE/public/engine-yq.wasm" ./wasm/yq
  GOOS=js GOARCH=wasm "$NODE_BIN" "$RUN_GO_SCRIPT_FOR_NODE" build "-ldflags=-s -w" -o "$ROOT_DIR_FOR_NODE/public/engine-dasel.wasm" ./wasm/dasel
fi
popd >/dev/null

for engine_name in "${ENGINE_NAMES[@]}"; do
  wasm_path="$ROOT_DIR/public/${engine_name}.wasm"

  if [[ ! -s "$wasm_path" ]]; then
    echo "${wasm_path} was not created or is empty." >&2
    exit 1
  fi

  if command -v wasm-opt >/dev/null 2>&1; then
    wasm-opt -Oz -o "$wasm_path" "$wasm_path"
    echo "Optimized ${wasm_path} with wasm-opt"
  else
    echo "wasm-opt not found; skipping optional optimization pass for ${engine_name}."
  fi

  wasm_for_node="$wasm_path"
  if [[ "$NODE_BIN" == *.exe ]]; then
    if command -v wslpath >/dev/null 2>&1; then
      wasm_for_node="$(wslpath -w "$wasm_for_node")"
    elif command -v cygpath >/dev/null 2>&1; then
      wasm_for_node="$(cygpath -w "$wasm_for_node")"
    fi
  fi

  "$NODE_BIN" "$GZIP_SCRIPT_FOR_NODE" "$wasm_for_node"
  echo "Built ${wasm_path}"
done
