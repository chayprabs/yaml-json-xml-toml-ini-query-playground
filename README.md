# Prabuddha Engine

Prabuddha Engine is a fully static Next.js playground for querying, reshaping, and converting structured documents directly in the browser through Go WebAssembly.

## Features

- Input support for `yaml`, `json`, `xml`, `csv`, and `toml`
- Output support for `yaml`, `json`, `xml`, `csv`, `toml`, and `props`
- Client-side execution only: no API routes, no database, no server-side evaluation
- URL hash state sync for shareable sessions
- Copy output, keyboard shortcuts, syntax highlighting, and debounced auto-run
- Static export that can be deployed to GitHub Pages or Cloudflare Pages

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

### Build the browser engine

```bash
bash scripts/build-engine.sh
```

This generates:

- `public/engine.wasm`
- `public/engine.wasm.gz`
- `public/wasm_exec.js`

If `wasm-opt` is available on your `PATH`, the build script also runs an extra optimization pass.

### Start the app

```bash
npm run dev
```

Open the local URL printed by Next.js. The browser runtime starts loading immediately on page load.

## Commands

```bash
npm run build:engine  # build and optimize the browser engine
npm run build         # static export through Next.js
npm run build:all     # build the engine, then run the Next.js build
npm run test:go       # Go unit tests for the browser bridge
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
- `out/engine.wasm`
- `out/engine.wasm.gz`
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
docker build -t prabuddha-engine .
docker run --rm -p 3000:3000 prabuddha-engine
```

## Built With

Third-party license details are available in [`THIRD_PARTY_LICENSES.txt`](./THIRD_PARTY_LICENSES.txt) and the in-app credits page.
