# Pluck

Pluck is a fully static Next.js playground for querying, reshaping, and converting configuration documents directly in the browser through Go WebAssembly.

Live tool: [authos.app/tools/pluck](https://authos.app/tools/pluck)

## Features

- Dual-engine browser runtime: `yq` for jq-style expressions and `dasel` for selector-based queries.
- Client-side execution only: no API routes, no database, no server-side evaluation.
- URL hash state sync for shareable sessions.
- Copy output, keyboard shortcuts, syntax highlighting, debounced auto-run, and truncated large-output previews.
- Static export ready for GitHub Pages or Cloudflare Pages.

## Engines

### `yq`

Use `yq` mode when you want jq-style expressions, filtering, mapping, and the existing YAML-first workflow.

### `dasel`

Use `dasel` mode when you want:

- native `ini` and `hcl` support
- dasel selector syntax such as `server.http_port` or `search(name == "worker")`
- write-style selectors such as `service.image = "ghcr.io/example/api:2.1.0"`
- user-defined variables such as `cfg=json:{"region":"ap-south-1"}`
- semicolon-separated statements and variable composition such as `$primary = services[0].host; [$primary]`

Pluck loads both engines eagerly on page load. If one runtime fails to boot, the other engine remains usable and the failed engine is disabled in the UI until refresh.

## Supported Formats

| Format  | yq Input | yq Output | dasel Input | dasel Output |
| ------- | -------- | --------- | ----------- | ------------ |
| `yaml`  | yes      | yes       | yes         | yes          |
| `json`  | yes      | yes       | yes         | yes          |
| `xml`   | yes      | yes       | yes         | yes          |
| `csv`   | yes      | yes       | yes         | yes          |
| `toml`  | yes      | yes       | yes         | yes          |
| `props` | no       | yes       | no          | no           |
| `ini`   | no       | no        | yes         | yes          |
| `hcl`   | no       | no        | yes         | yes          |

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- Go 1.25+ on your `PATH`, in `.tools/go`, or in `%USERPROFILE%/.codex-toolchains/go`
- Bash for `scripts/build-engine.sh`

### Install

```bash
npm install
```

### Build the browser engines

```bash
bash scripts/build-engine.sh
```

This generates:

- `public/engine-yq.wasm`
- `public/engine-yq.wasm.gz`
- `public/engine-dasel.wasm`
- `public/engine-dasel.wasm.gz`
- `public/wasm_exec.js`

If `wasm-opt` is available on your `PATH`, the build script also runs an extra optimization pass on both binaries.

### Start the app

```bash
npm run dev
```

Open the local URL printed by Next.js. Both browser runtimes begin loading immediately on page load.

## Commands

```bash
npm run build:engine  # build and optimize both browser engines
npm run build         # static export through Next.js
npm run build:all     # build both engines, then run the Next.js build
npm run test:go       # Go unit tests for the yq and dasel bridges
npm run test:unit     # TypeScript unit tests
npm run test:e2e      # Playwright browser tests
npm run phase1:audit  # browser-driven functional audit harness
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript typecheck
npm run format:check  # Prettier verification
```

## Static Export

```bash
npm run build:all
```

The exported site is written to `out/`.

Important output files:

- `out/index.html`
- `out/engine-yq.wasm`
- `out/engine-yq.wasm.gz`
- `out/engine-dasel.wasm`
- `out/engine-dasel.wasm.gz`
- `out/wasm_exec.js`

## Deployment

### Cloudflare Pages

```bash
npm run build:all
npx wrangler pages deploy out
```

### GitHub Pages

The Next config automatically applies a repository-name `basePath` during GitHub Actions builds by reading `GITHUB_REPOSITORY`, so the exported app can be published without editing the source for each repository.

## Docker

Use the included `Dockerfile` for a reproducible local environment without installing Go directly on your host:

```bash
docker build -t pluck .
docker run --rm -p 3000:3000 pluck
```

## Built With

Third-party license details are available in [`THIRD_PARTY_LICENSES.txt`](./THIRD_PARTY_LICENSES.txt) and the in-app credits page.
