#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -x "$ROOT_DIR/.tools/go/bin/go.exe" ]]; then
  GO_BIN="$ROOT_DIR/.tools/go/bin/go.exe"
elif command -v go >/dev/null 2>&1; then
  GO_BIN="$(command -v go)"
else
  echo "Go toolchain not found. Expected $ROOT_DIR/.tools/go/bin/go.exe or go on PATH." >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/public"

pushd "$ROOT_DIR" >/dev/null
if [[ "$GO_BIN" == *.exe ]]; then
  GO_BIN_WIN="$GO_BIN"
  ROOT_DIR_WIN="$ROOT_DIR"

  if command -v cygpath >/dev/null 2>&1; then
    GO_BIN_WIN="$(cygpath -w "$GO_BIN")"
    ROOT_DIR_WIN="$(cygpath -w "$ROOT_DIR")"
  elif command -v wslpath >/dev/null 2>&1; then
    GO_BIN_WIN="$(wslpath -w "$GO_BIN")"
    ROOT_DIR_WIN="$(wslpath -w "$ROOT_DIR")"
  fi

  powershell.exe -NoProfile -Command "\$env:GOOS='js'; \$env:GOARCH='wasm'; & '$GO_BIN_WIN' build -ldflags='-s -w' -o '$ROOT_DIR_WIN\\public\\yq.wasm' ./wasm"

  GOROOT_WIN="$("$GO_BIN" env GOROOT | tr -d '\r')"
  powershell.exe -NoProfile -Command "\$goroot='$GOROOT_WIN'; \$root='$ROOT_DIR_WIN'; \$candidates=@((Join-Path \$goroot 'lib\\wasm\\wasm_exec.js'), (Join-Path \$goroot 'misc\\wasm\\wasm_exec.js')); \$src=\$candidates | Where-Object { Test-Path \$_ } | Select-Object -First 1; if (-not \$src) { throw \"wasm_exec.js not found under GOROOT: \$goroot\" }; Copy-Item -Path \$src -Destination (Join-Path \$root 'public\\wasm_exec.js') -Force"
else
  GOOS=js GOARCH=wasm "$GO_BIN" build -ldflags="-s -w" -o "$ROOT_DIR/public/yq.wasm" ./wasm
  GOROOT="$("$GO_BIN" env GOROOT)"
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
popd >/dev/null

if [[ ! -s "$ROOT_DIR/public/yq.wasm" ]]; then
  echo "public/yq.wasm was not created or is empty." >&2
  exit 1
fi

if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Oz -o "$ROOT_DIR/public/yq.wasm" "$ROOT_DIR/public/yq.wasm"
  echo "Optimized public/yq.wasm with wasm-opt"
else
  echo "wasm-opt not found; skipping optional optimization pass."
fi

node "$ROOT_DIR/scripts/gzip-file.cjs" "$ROOT_DIR/public/yq.wasm"

echo "Built $ROOT_DIR/public/yq.wasm"
