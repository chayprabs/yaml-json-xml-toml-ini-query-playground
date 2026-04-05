#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_GO_SCRIPT="$ROOT_DIR/scripts/run-go.cjs"
GZIP_SCRIPT="$ROOT_DIR/scripts/gzip-file.cjs"
ROOT_DIR_FOR_NODE="$ROOT_DIR"
RUN_GO_SCRIPT_FOR_NODE="$RUN_GO_SCRIPT"
GZIP_SCRIPT_FOR_NODE="$GZIP_SCRIPT"
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
  elif command -v cygpath >/dev/null 2>&1; then
    ROOT_DIR_FOR_NODE="$(cygpath -w "$ROOT_DIR")"
    RUN_GO_SCRIPT_FOR_NODE="$(cygpath -w "$RUN_GO_SCRIPT")"
    GZIP_SCRIPT_FOR_NODE="$(cygpath -w "$GZIP_SCRIPT")"
  fi
fi

mkdir -p "$ROOT_DIR/public"
rm -f \
  "$ROOT_DIR/public/engine.wasm" \
  "$ROOT_DIR/public/engine.wasm.gz"

pushd "$ROOT_DIR" >/dev/null
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
    \$goroot=& \$go env GOROOT; \
    \$candidates=@((Join-Path \$goroot 'lib\\wasm\\wasm_exec.js'), (Join-Path \$goroot 'misc\\wasm\\wasm_exec.js')); \
    \$src=\$candidates | Where-Object { Test-Path \$_ } | Select-Object -First 1; \
    if (-not \$src) { throw \"wasm_exec.js not found under GOROOT: \$goroot\" }; \
    Copy-Item -Path \$src -Destination (Join-Path \$root 'public\\wasm_exec.js') -Force;\
  "
else
  GOOS=js GOARCH=wasm "$NODE_BIN" "$RUN_GO_SCRIPT_FOR_NODE" build "-ldflags=-s -w" -o "$ROOT_DIR_FOR_NODE/public/engine-yq.wasm" ./wasm/yq
  GOOS=js GOARCH=wasm "$NODE_BIN" "$RUN_GO_SCRIPT_FOR_NODE" build "-ldflags=-s -w" -o "$ROOT_DIR_FOR_NODE/public/engine-dasel.wasm" ./wasm/dasel
  GOROOT="$("$NODE_BIN" "$RUN_GO_SCRIPT_FOR_NODE" env GOROOT | tr -d '\r')"
fi
popd >/dev/null

if [[ "$NODE_BIN" == *.exe ]]; then
  :
elif [[ "$GOROOT" == [A-Za-z]:* ]]; then
  ROOT_DIR_WIN="$ROOT_DIR"

  if command -v cygpath >/dev/null 2>&1; then
    ROOT_DIR_WIN="$(cygpath -w "$ROOT_DIR")"
  elif pwd -W >/dev/null 2>&1; then
    ROOT_DIR_WIN="$(cd "$ROOT_DIR" && pwd -W)"
  fi

  powershell.exe -NoProfile -Command "\$goroot='$GOROOT'; \$root='$ROOT_DIR_WIN'; \$candidates=@((Join-Path \$goroot 'lib\\wasm\\wasm_exec.js'), (Join-Path \$goroot 'misc\\wasm\\wasm_exec.js')); \$src=\$candidates | Where-Object { Test-Path \$_ } | Select-Object -First 1; if (-not \$src) { throw \"wasm_exec.js not found under GOROOT: \$goroot\" }; Copy-Item -Path \$src -Destination (Join-Path \$root 'public\\wasm_exec.js') -Force"
else
  GOROOT_PATH="${GOROOT//\\//}"
  WASM_EXEC_SRC="$GOROOT_PATH/lib/wasm/wasm_exec.js"

  if [[ ! -f "$WASM_EXEC_SRC" ]]; then
    WASM_EXEC_SRC="$GOROOT_PATH/misc/wasm/wasm_exec.js"
  fi

  if [[ ! -f "$WASM_EXEC_SRC" ]]; then
    echo "wasm_exec.js not found under GOROOT: $GOROOT" >&2
    exit 1
  fi

  cp "$WASM_EXEC_SRC" "$ROOT_DIR/public/wasm_exec.js"
fi

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
