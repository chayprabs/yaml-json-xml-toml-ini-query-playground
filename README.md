<!-- Pluck: browser YAML JSON XML TOML CSV INI HCL query converter yq dasel WebAssembly static site -->
<p align="center">
  <a href="https://authos.app/tools/pluck"><img src="https://img.shields.io/badge/Pluck-authos.app%2Ftools%2Fpluck-0f172a?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Open Pluck live demo" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground/actions/workflows/ci.yml"><img src="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
</p>

<h1 align="center">Pluck</h1>

<p align="center"><strong>Multi-format config query &amp; format conversion — 100% in the browser.</strong><br />
Paste YAML, JSON, XML, CSV, TOML, INI, or HCL. Run <a href="https://mikefarah.gitbook.io/yq/">yq</a>-style expressions or <a href="https://daseldocs.tomwright.me/">dasel</a> selectors. No install, no signup, no backend.</p>

<p align="center">
  <a href="https://authos.app/tools/pluck"><strong>authos.app/tools/pluck</strong></a> ·
  <a href="./app/privacy/page.tsx">Privacy</a> ·
  <a href="./app/terms/page.tsx">Terms</a> ·
  <a href="./app/credits/page.tsx">Credits</a> ·
  <a href="./THIRD_PARTY_LICENSES.txt">Third-party licenses</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/WebAssembly-654FF0?style=flat-square&logo=webassembly&logoColor=white" alt="WebAssembly" />
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/yq-expression_engine-111827?style=flat-square&logo=github&logoColor=white" alt="yq" />
  <img src="https://img.shields.io/badge/dasel-selector_engine-111827?style=flat-square&logo=github&logoColor=white" alt="dasel" />
  <img src="https://img.shields.io/badge/Playwright-E23F96?style=flat-square&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Cloudflare_Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages" />
  <img src="https://img.shields.io/badge/Static_export-no_server-22c55e?style=flat-square" alt="Static export" />
</p>

---

## What is Pluck?

**Pluck** is a free, open-source **YAML query playground**, **JSON path / filter tool**, and **config format converter** for teams who work with Kubernetes manifests, Helm values, Docker Compose, GitHub Actions YAML, Terraform HCL, TOML, INI, XML, and CSV — without installing CLI tools or sending documents to a server.

| You need… | Pluck gives you… |
|-----------|-------------------|
| **jq-style queries on YAML/JSON** | **Expression engine** ([yq](https://github.com/mikefarah/yq)) in WebAssembly |
| **Dot paths, `search()`, INI, HCL** | **Selector engine** ([dasel](https://github.com/TomWright/dasel)) in WebAssembly |
| **A tab that never uploads your config** | Full evaluation in **dedicated web workers** + static hosting only |
| **Shareable workspace links** | **LZ-string** compressed state in the URL **hash** (with a size guard) |

**Repository:** `yaml-json-xml-toml-ini-query-playground` · **Suite:** [Authos](https://authos.app) · **Owner:** Chaitanya Prabuddha ([@chayprabs](https://github.com/chayprabs))

---

## Table of contents

- [Live demo](#live-demo)
- [Why Pluck (problem & audience)](#why-pluck-problem--audience)
- [Architecture (client-side only)](#architecture-client-side-only)
- [Engines at a glance](#engines-at-a-glance)
- [Input & output formats](#input--output-formats)
- [UI features (PRD-aligned)](#ui-features-prd-aligned)
- [Limits & throttling](#limits--throttling)
- [Security & privacy](#security--privacy)
- [Build & run locally](#build--run-locally)
- [Deploy (static `out/`)](#deploy-static-out)
- [Scripts & CI](#scripts--ci)
- [FAQ](#faq)
- [Suggested GitHub topics (SEO)](#suggested-github-topics-seo)
- [License & attribution](#license--attribution)

---

## Live demo

**[https://authos.app/tools/pluck](https://authos.app/tools/pluck)**

---

## Why Pluck (problem & audience)

| Who | Why they use Pluck |
|-----|-------------------|
| **Platform / backend engineers** | Query Kubernetes YAML, Compose, CI YAML without `yq`/`dasel` installed |
| **DevOps / SRE** | Inspect TOML, INI, HCL; quick conversions beside Terraform or service configs |
| **API & config developers** | Validate JSON shapes; flip between YAML ↔ JSON ↔ TOML in one UI |
| **Anyone with sensitive configs** | Nothing is uploaded — evaluation stays in your browser tab |

---

## Architecture (client-side only)

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS** UI, **`output: 'export'`** — no API routes.
- Two Go programs compile with **`GOOS=js GOARCH=wasm`** to **`public/engine-yq.wasm`** and **`public/engine-dasel.wasm`** (built by `scripts/build-engine.sh`; not committed).
- **`public/wasm_exec.js`** is copied from your local Go toolchain and must match the Go version used to build the WASM.
- Each engine runs in its **own Web Worker**; the main thread stays responsive.
- **Optional** `.wasm.gz` assets + client-side gzip decompress when supported (see worker fetch logic in the codebase).
- **No** analytics, telemetry, or error reporting that exfiltrates document content.

---

## Engines at a glance

| | **Expression (yq)** | **Selector (dasel)** |
|---|---------------------|----------------------|
| **Style** | jq-style expressions (paths, filters, `select`, etc.) | Dot paths, `search()`, assignments, variables |
| **Docs** | [yq documentation](https://mikefarah.gitbook.io/yq/) | [dasel documentation](https://daseldocs.tomwright.me/) |
| **Input** | YAML, JSON, XML, CSV, TOML | YAML, JSON, XML, CSV, TOML, **INI**, **HCL** |
| **Output** | YAML, JSON, XML, CSV, TOML, **Properties** (`.properties`) | YAML, JSON, XML, CSV, TOML, **INI**, **HCL** |
| **Extra UI** | Unwrap scalar, no YAML doc separators, pretty-print (JSON output) | Read/write flags, variables, return modified root, unstable selectors |

---

## Input & output formats

| Format | Expression engine | Selector engine | Notes |
|--------|:-----------------:|:---------------:|-------|
| **YAML** | in / out | in / out | Multi-doc YAML supported in expression mode |
| **JSON** | in / out | in / out | |
| **XML** | in / out | in / out | Complex XML may not round-trip losslessly |
| **CSV** | in / out | in / out | Selector: e.g. `csv-delimiter=;` via read flags |
| **TOML** | in / out | in / out | |
| **INI** | — | in / out | INI is **selector-only** |
| **HCL** | — | in / out | HCL is **selector-only** |
| **Properties** | **out only** | — | Java `.properties` — **expression-only** output |

---

## UI features (PRD-aligned)

- **Input panel** — paste text, format picker, char/byte counter, **500 KB** warning, **2 MB** hard reject.
- **Expression bar** — single-line query, engine toggle, output format, **Run**, **Cmd/Ctrl+Enter**, **auto-run** (600 ms debounce), expression max **2000** characters.
- **Engine controls** (collapsible) — yq toggles; dasel read/write flags, variables, return root, unstable mode.
- **Output panel** — syntax-highlighted plain text (no unsafe HTML for engine output), copy, download `output.{ext}`, **50 000** char display cap with truncation notice, **Running…** state.
- **Status badges** — per-engine loading / ready / running / error / timeout.
- **Syntax hints** — static copy + links to official engine docs.
- **Presets** — one-click examples (Kubernetes name, Compose keys, GHA `uses`, Helm→JSON, INI port, `search()`, TOML/HCL/CSV samples, etc.).
- **Clear** — clears input, query, and output without changing engine defaults.
- **URL hash** — `#state=…` sync (300 ms debounce); suppressed when encoded state **> 4000** characters with on-page notice.
- **Footer** — required privacy sentence, © MIT, links to `/privacy/`, `/terms/`, `/credits/`, `/third-party-licenses/`.

---

## Limits & throttling

| What | Value |
|------|------:|
| Auto-run debounce | 600 ms |
| URL hash sync debounce | 300 ms |
| Evaluation timeout | 8 s (worker restarted on timeout) |
| Input (hard max) | 2 MB |
| Input (warning) | 500 KB |
| Expression / selector length | 2 000 chars |
| Output display | 50 000 chars (full result still copy/download) |
| Encoded URL state | 4 000 chars max before sync suppressed |

---

## Security & privacy

- **CSP** via `<meta http-equiv="Content-Security-Policy">` in the app layout and **`public/_headers`** for hosts that honor it (e.g. Cloudflare Pages).
- **No** `dangerouslySetInnerHTML` for engine output; syntax highlighting uses safe paths.
- **Workers** cannot touch `document`, cookies, or `localStorage` for your pasted data.
- **Privacy policy** in-app and at **`/privacy/`**; **terms** at **`/terms/`**.

> Your data never leaves your browser. Both engines run locally as WebAssembly. Nothing is sent to a server.

---

## Build & run locally

**Prerequisites:** Go **1.21+**, Node.js **18+**, **bash** (Git Bash / WSL on Windows). Optional: **wasm-opt** (Binaryen) for smaller WASM.

```bash
bash scripts/build-engine.sh   # builds WASM + copies wasm_exec.js from $(go env GOROOT)
npm install
npm run dev                    # http://localhost:3000
```

Production build (static site in **`out/`**):

```bash
npm run build                  # build:engine && next build
```

---

## Deploy (static `out/`)

Deploy **`out/`** to **Cloudflare Pages** (primary target), **GitHub Pages**, **Vercel**, **Netlify**, or any static CDN. No Node server required at runtime.

Example (Wrangler): `npx wrangler pages deploy out/ --project-name=pluck` (see `wrangler.toml` if present).

---

## Scripts & CI

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | WASM build + static export |
| `npm run build:engine` | `bash scripts/build-engine.sh` only |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Node unit tests |
| `npm test` | Playwright E2E |

CI (`.github/workflows/ci.yml`): checkout → Go → Node → `go mod verify` → build engines → `npm ci` → typecheck → unit tests → ESLint → `next build` → `npm audit --audit-level=high` → Playwright (Chromium).

---

## FAQ

<details>
<summary><strong>Does Pluck upload my YAML, JSON, or secrets to a server?</strong></summary>

**No.** Parsing and evaluation happen in **WebAssembly inside web workers** in your browser. The app is a **static site**; there are no API routes that receive your document. The only normal network traffic is loading HTML/JS/CSS/WASM from your host (CDN). Optional URL **hash** sharing keeps state in the fragment (client-side); it is not sent as an HTTP request body to your app.
</details>

<details>
<summary><strong>What is the difference between the Expression engine and the Selector engine?</strong></summary>

**Expression** uses **yq**-style jq-like expressions (great for Kubernetes YAML, pipeline transforms, and **Properties** output). **Selector** uses **dasel** (dot paths, `search()`, variables, read/write flags) and is the only mode that accepts **INI** and **HCL** input.
</details>

<details>
<summary><strong>Why is the Run button disabled for INI when I use the expression engine?</strong></summary>

INI (and HCL) are **not supported** as input for yq in this product. Switch to the **selector engine**. The UI shows: *The expression engine does not support INI input. Switch to the selector engine.* (and the analogous message for HCL.)
</details>

<details>
<summary><strong>Why can’t I pick “Properties” as output in selector mode?</strong></summary>

**Properties** output is **expression-engine only**. Switch to the expression engine or pick another output format. Message: *Properties output is only available in the expression engine.*
</details>

<details>
<summary><strong>What happens if evaluation takes too long?</strong></summary>

Each run has an **8 second** timeout. The worker is **terminated and restarted**. You’ll see: *Evaluation timed out after 8 seconds. The engine has been restarted.* The next run uses a fresh worker.
</details>

<details>
<summary><strong>Can I share my workspace with a colleague?</strong></summary>

Yes — state syncs into the **URL hash** after edits (debounced). If the encoded state exceeds **4000** characters, URL sync stops and the UI explains that the workspace is too large for a link; use download/copy instead.
</details>

<details>
<summary><strong>What engines and licenses are bundled?</strong></summary>

- **yq** — Copyright (c) 2017 Mike Farah — MIT — [github.com/mikefarah/yq](https://github.com/mikefarah/yq)  
- **dasel** — Copyright (c) 2020 Tom Wright — MIT — [github.com/TomWright/dasel](https://github.com/TomWright/dasel)  

Full text: **[THIRD_PARTY_LICENSES.txt](./THIRD_PARTY_LICENSES.txt)**. App license: **[LICENSE](./LICENSE)** (MIT, Chaitanya Prabuddha).
</details>

<details>
<summary><strong>Where are privacy and terms?</strong></summary>

In the deployed app: **`/privacy/`** and **`/terms/`**. Source: `app/privacy/page.tsx`, `app/terms/page.tsx`.
</details>

<details>
<summary><strong>Is this the same as running yq or dasel on my laptop?</strong></summary>

Same **engines**, same general syntax, but running inside **Go’s WASM runtime** in the browser. Edge cases or version skew can differ from a specific CLI release; treat output as indicative and verify in your pipeline when it matters.
</details>

---

## Suggested GitHub topics (SEO)

Add these **repository topics** on GitHub (**Settings → General → Topics**) so discoverability matches how people search:

`yaml` `json` `xml` `toml` `csv` `ini` `hcl` `properties` `kubernetes` `helm` `docker-compose` `github-actions` `terraform` `config-management` `devops` `sre` `webassembly` `wasm` `golang` `yq` `dasel` `jq` `query` `static-site` `nextjs` `typescript` `react` `tailwindcss` `cloudflare-pages` `privacy` `offline-first` `browser-tools` `authos` `pluck`

---

## License & attribution

- **Pluck** and this repository: **[MIT License](./LICENSE)** — © Chaitanya Prabuddha.
- **Engines:** yq (Mike Farah) and dasel (Tom Wright) — see **[THIRD_PARTY_LICENSES.txt](./THIRD_PARTY_LICENSES.txt)**.
- **Runtime:** [WebAssembly](https://webassembly.org/).

Contributions welcome via issues and pull requests.
