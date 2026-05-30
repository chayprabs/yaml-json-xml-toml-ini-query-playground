# Pluck — PRD traceability matrix

Maps the Product Requirements Document to this repository. **Status:** Implemented | Gap | N/A.

| §         | Requirement summary                                          | Status        | Evidence                                                                                                                                               |
| --------- | ------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1         | Multi-format query/conversion, browser-only, yq + dasel WASM | Implemented   | [`../lib/engine-types.ts`](../lib/engine-types.ts), [`../lib/engine.ts`](../lib/engine.ts)                                                             |
| 2–3       | Problem / users                                              | N/A           | Product copy in [`../app/page.tsx`](../app/page.tsx), [`../README.md`](../README.md)                                                                   |
| 4.1       | Client-side only, workers, no API/telemetry                  | Implemented   | [`../app/layout.tsx`](../app/layout.tsx), [`../lib/engine-worker.ts`](../lib/engine-worker.ts)                                                         |
| 4.2       | File structure (illustrative split)                          | Implemented\* | UI consolidated in [`../components/PluckPlayground.tsx`](../components/PluckPlayground.tsx) (\*behavioral parity, not file names)                      |
| 4.3–4.4   | WASM build, 8s timeout, worker lifecycle                     | Implemented   | `../scripts/build-engine.sh`, [`../lib/engine.ts`](../lib/engine.ts) `EVALUATION_TIMEOUT_MS`                                                           |
| 5–6       | Input/output format matrix                                   | Implemented   | [`../lib/engine-types.ts`](../lib/engine-types.ts)                                                                                                     |
| 7         | Engine-specific features & toggles                           | Implemented   | [`../components/PluckPlayground.tsx`](../components/PluckPlayground.tsx), [`../lib/playground-state.ts`](../lib/playground-state.ts)                   |
| 8.1       | Input panel, limits, messages                                | Implemented   | `PluckPlayground.tsx`, [`../lib/validation.ts`](../lib/validation.ts)                                                                                  |
| 8.2       | Expression bar, auto-run 600ms, Run, shortcut                | Implemented   | `PluckPlayground.tsx`, [`../lib/playground-state.ts`](../lib/playground-state.ts)                                                                      |
| 8.3       | Engine controls collapsible, placeholders                    | Implemented   | `PluckPlayground.tsx` `<details>`                                                                                                                      |
| 8.4       | Output, 50k truncate, copy/download, errors, Running…        | Implemented   | [`../lib/output.ts`](../lib/output.ts), [`../lib/errorDisplay.ts`](../lib/errorDisplay.ts)                                                             |
| 8.5       | Status badges: Loading, Ready, Running, Error, Timeout       | Implemented   | `engineEvalBadge` + init errors in `PluckPlayground.tsx`                                                                                               |
| 8.6       | Syntax hints + doc links                                     | Implemented   | [`../lib/playground-state.ts`](../lib/playground-state.ts) `ENGINE_SYNTAX_HINTS`                                                                       |
| 8.7       | Nine presets                                                 | Implemented   | [`../lib/examples.ts`](../lib/examples.ts), Playwright                                                                                                 |
| 8.8       | Clear: empty input/expression/output, keep engine/formats    | Implemented   | `clearPlayground` in `PluckPlayground.tsx`                                                                                                             |
| 9         | User flow / validation before worker                         | Implemented   | `validateRunRequest`, `runGate`                                                                                                                        |
| 10        | Validation messages (exact copy)                             | Implemented   | [`../lib/validation.ts`](../lib/validation.ts) `VALIDATION_MESSAGES`                                                                                   |
| 11        | URL hash, LZ, 4000 guard, restore state, copy link           | Implemented   | [`../lib/urlState.ts`](../lib/urlState.ts), `copy-link-button` in `PluckPlayground.tsx`                                                                |
| 12        | CSP, sanitisation, XSS, WASM isolation                       | Implemented   | [`../app/layout.tsx`](../app/layout.tsx), [`../public/_headers`](../public/_headers), `OutputSyntax`                                                   |
| 13        | Limits table                                                 | Implemented   | [`../lib/validation.ts`](../lib/validation.ts), [`../lib/playground-state.ts`](../lib/playground-state.ts), [`../lib/urlState.ts`](../lib/urlState.ts) |
| 14.1      | Cache headers incl. worker scripts                           | Implemented   | [`../public/_headers`](../public/_headers) `/yq-worker.js`, `/dasel-worker.js`                                                                         |
| 14.2–14.3 | Gzip WASM fetch, no server cache                             | Implemented   | [`../lib/engine-worker.ts`](../lib/engine-worker.ts)                                                                                                   |
| 15.3      | Main-page privacy notice                                     | Implemented   | [`../app/page.tsx`](../app/page.tsx) `privacy-notice`                                                                                                  |
| 15.4–15.5 | `/privacy`, `/terms`                                         | Implemented   | [`../app/privacy/page.tsx`](../app/privacy/page.tsx), [`../app/terms/page.tsx`](../app/terms/page.tsx)                                                 |
| 16        | License, third-party, credits, footer ©                      | Implemented   | `../LICENSE`, `../THIRD_PARTY_LICENSES.txt`, [`../app/credits/page.tsx`](../app/credits/page.tsx), [`../app/page.tsx`](../app/page.tsx)                |
| 17–19     | Build, CI, deploy                                            | Implemented   | `../package.json`, [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml), `../wrangler.toml`                                                    |
| 20        | Limits enforcement map                                       | Implemented   | See §13 files                                                                                                                                          |
| 21        | Error sanitisation, WASM load message on badge               | Implemented   | [`../lib/errorDisplay.ts`](../lib/errorDisplay.ts), [`../lib/engine-worker.ts`](../lib/engine-worker.ts), badge text in `PluckPlayground.tsx`          |
| 22        | Non-goals                                                    | N/A           | —                                                                                                                                                      |
| 23        | Open decisions                                               | N/A           | Document only                                                                                                                                          |

## Tests

| Area                | Tests                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| Validation messages | [`../tests/unit/validation.test.ts`](../tests/unit/validation.test.ts) |
| E2E / engines       | [`../tests/playground.spec.ts`](../tests/playground.spec.ts)           |
