<!-- Pluck: browser YAML JSON XML TOML CSV INI HCL query converter yq dasel WebAssembly static site -->
<p align="center">
  <a href="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground"><img src="https://img.shields.io/badge/Pluck-open%20source-171717?style=for-the-badge&logo=github&logoColor=white" alt="Pluck open source" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground/actions/workflows/ci.yml"><img src="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
</p>

<h1 align="center">Pluck</h1>

<p align="center"><strong>Multi-format config query &amp; format conversion — 100% in the browser.</strong><br />
Paste YAML, JSON, XML, CSV, TOML, INI, or HCL. Run <a href="https://mikefarah.gitbook.io/yq/">yq</a>-style expressions or <a href="https://daseldocs.tomwright.me/">dasel</a> selectors. No install, no signup, no backend.</p>

<p align="center">
  <a href="./app/privacy/page.tsx">Privacy</a> ·
  <a href="./app/terms/page.tsx">Terms</a> ·
  <a href="./THIRD_PARTY_LICENSES.txt">Third-party licenses</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/WebAssembly-654FF0?style=flat-square&logo=webassembly&logoColor=white" alt="WebAssembly" />
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/yq-expression_engine-111827?style=flat-square" alt="yq" />
  <img src="https://img.shields.io/badge/dasel-selector_engine-111827?style=flat-square" alt="dasel" />
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

**Repository:** [yaml-json-xml-toml-ini-query-playground](https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground) · **Owner:** Chaitanya Prabuddha ([@chayprabs](https://github.com/chayprabs))

---

## Build & run locally

**Prerequisites:** Go **1.25+**, Node.js **18+**, **bash** (Git Bash / WSL on Windows).

```bash
bash scripts/build-engine.sh
npm install
npm run dev
```

Production static site in **`out/`**:

```bash
npm run build
```

Deploy **`out/`** to Cloudflare Pages, GitHub Pages, Vercel, Netlify, or any static CDN.

Example: `npx wrangler pages deploy out/ --project-name=pluck`

---

## Scripts & CI

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | WASM build + static export |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Node unit tests |
| `npm test` | Playwright E2E |

CI: Go verify → WASM build → typecheck → unit + Go tests → ESLint → `next build` → audit → Playwright (Chromium).

---

## Security & privacy

> Your data never leaves your browser. Both engines run locally as WebAssembly. Nothing is sent to a server.

See **`/privacy/`** and **`/terms/`** in the deployed app.

---

## License

**[MIT License](./LICENSE)** — © Chaitanya Prabuddha. Engines: yq (Mike Farah) and dasel (Tom Wright) — see **[THIRD_PARTY_LICENSES.txt](./THIRD_PARTY_LICENSES.txt)**.
