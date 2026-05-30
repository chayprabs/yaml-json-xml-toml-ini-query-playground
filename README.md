<!-- Pluck: browser YAML JSON XML TOML CSV INI HCL query converter yq dasel WebAssembly static site -->
<p align="center">
  <a href="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground"><img src="https://img.shields.io/badge/Pluck-open%20source-171717?style=for-the-badge&logo=github&logoColor=white" alt="Pluck open source" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground/actions/workflows/ci.yml"><img src="https://img.shields.io/badge/CI-passing-22c55e?style=for-the-badge" alt="CI status" /></a>
</p>

<h1 align="center">Pluck</h1>

<p align="center"><strong>Multi-format config query &amp; format conversion — 100% in the browser.</strong><br />
Paste YAML, JSON, XML, CSV, TOML, INI, or HCL. Run <a href="https://mikefarah.gitbook.io/yq/">yq</a>-style expressions or <a href="https://daseldocs.tomwright.me/">dasel</a> selectors. No install, no signup, no backend.</p>

---

## Features (complete product)

| Category        | What you get                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Engines**     | yq (expressions) + dasel (selectors) in WebAssembly, each in its own worker                              |
| **Formats**     | YAML, JSON, XML, CSV, TOML; dasel adds INI & HCL; yq adds Properties output                              |
| **Input**       | Paste, **drag-and-drop**, or **open file** (up to 2 MB); **syntax highlighting**; format **auto-detect** |
| **Query**       | **Multiline** expression/selector field; presets; engine toggles; dasel flags & variables                |
| **Output**      | Highlighted result, copy, download; 50k preview cap with full download                                   |
| **Share**       | URL hash workspace (LZ-compressed, 4k guard); copy link                                                  |
| **CLI**         | **Copy CLI command** equivalent for yq/dasel                                                             |
| **Reliability** | 8s timeout, worker restart, **Retry** on engine load failure, both engines **preloaded**                 |
| **Privacy**     | No upload, no analytics; CSP + static export only                                                        |

---

## Quick start

```bash
bash scripts/build-engine.sh   # requires Go 1.25+
npm install
npm run dev                    # http://localhost:3000
```

Production build outputs static files in `out/`:

```bash
npm run build
npx wrangler pages deploy out/ --project-name=pluck   # optional
```

---

## Architecture

- **Next.js** static export (`output: 'export'`) — no API routes
- Go → WASM: `public/engine-yq.wasm`, `public/engine-dasel.wasm`
- Evaluation in **web workers** only; main thread stays responsive
- URL state in `#state=…` (client-side hash, never sent as request body)

---

## Limits

| Item               |               Value |
| ------------------ | ------------------: |
| Input max          |                2 MB |
| Input warning      |              500 KB |
| Expression max     |         2,000 chars |
| Evaluation timeout |                 8 s |
| URL hash max       | 4,000 chars encoded |

---

## Scripts & CI

| Script                 | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `npm run build`        | WASM + static site                              |
| `npm run test:unit`    | Node unit tests                                 |
| `npm run test:go`      | Go bridge + WASM tests                          |
| `npm test`             | Playwright E2E (Chromium)                       |
| `npm run phase1:audit` | 30-case yq engine matrix (needs running server) |

CI on every push to `main`: Go verify → WASM build → typecheck → Go tests → unit tests → Prettier → ESLint → `next build` → audit → Playwright.

Optional **Deploy** workflow (`.github/workflows/deploy.yml`) publishes `out/` to Cloudflare Pages when `CLOUDFLARE_API_TOKEN` is configured.

---

## Legal

- [Privacy policy](./app/privacy/page.tsx) · [Terms](./app/terms/page.tsx)
- [Third-party licenses](./THIRD_PARTY_LICENSES.txt) (yq, dasel)
- MIT — © Chaitanya Prabuddha

---

**Repository:** [github.com/chayprabs/yaml-json-xml-toml-ini-query-playground](https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground)
