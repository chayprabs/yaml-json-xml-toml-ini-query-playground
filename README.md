[![Live Tool](https://img.shields.io/badge/Live%20Tool-authos.app%2Ftools%2Fpluck-0f172a?style=flat-square)](https://authos.app/tools/pluck) [![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](./LICENSE) [![WebAssembly](https://img.shields.io/badge/Built%20with-WebAssembly-654ff0?style=flat-square)](https://webassembly.org/) [![authos](https://img.shields.io/badge/part%20of-authos-111827?style=flat-square)](https://authos.app)

# Pluck — Online YAML, JSON, XML, CSV, TOML & INI Query Playground

**Try it live → [authos.app/tools/pluck](https://authos.app/tools/pluck)**
No install. No signup. No server. Runs entirely in your browser.

Pluck is a **multi-format config query tool** and **format converter** that runs entirely in the browser. Paste structured config, run **expressions** or **selectors**, and export results without a backend. It is a **YAML query playground**, a **JSON/XML/CSV/TOML converter**, and a native **INI** and **HCL** tool in one tab — covering every format you encounter in config files, Kubernetes manifests, Docker Compose stacks, CI workflows, and Terraform definitions.

## Two Engines. One Tool.

Pluck ships two complementary engines, each compiled to WebAssembly and running in a dedicated web worker:

|                    | Expression engine                                                                                               | Selector engine                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Syntax**         | jq-style expressions — paths, filters, and transforms (see [expression docs](https://mikefarah.gitbook.io/yq/)) | Dot-path selectors, `search()`, assignments, variables (see [selector docs](https://daseldocs.tomwright.me/)) |
| **Input formats**  | YAML, JSON, XML, CSV, TOML                                                                                      | YAML, JSON, XML, CSV, TOML, **INI**, **HCL**                                                                  |
| **Output formats** | YAML, JSON, XML, CSV, TOML, **Properties**                                                                      | YAML, JSON, XML, CSV, TOML, **INI**, **HCL**                                                                  |

The **Expression engine** is the workhorse for jq-style queries against YAML-heavy sources: Kubernetes manifests, Helm values, Docker Compose files, and CI workflow YAML. It reads and writes YAML, JSON, XML, CSV, and TOML, and can emit Java `.properties` as output.

The **Selector engine** adds dot-path ergonomics (`server.http_port`, `search(...)`, assignment-style updates) and fills the format gaps: native **INI** input and output, **HCL** in and out, optional **read flags** (`csv-delimiter=;`, `xml-mode=structured`), **write flags** (`hcl-block-format=array`), user **variables** (`cfg=json:{"region":"ap-south-1"}`), **return modified root** after a write selector, and an **unstable** selector mode.

## What You Can Do With Pluck

1. **Extract `.metadata.name` from a Kubernetes Deployment** — a practical YAML query moment — without installing anything.
2. **List Compose service keys** for a quick audit before editing a Docker Compose file.
3. **Inspect `.jobs.*.steps[].uses`** in CI YAML as a lightweight GitHub Actions inspector in the browser.
4. **Convert a Helm `values.yaml` fragment to JSON** when you need JSON beside YAML for another system. Try it at **[authos.app/tools/pluck](https://authos.app/tools/pluck)**.
5. **Query an INI config** with the selector engine when expression-based tools skip INI entirely — native INI is a Pluck differentiator.
6. **Use `search(...)` selectors** to find nodes anywhere in a document without leaving the page.
7. **Convert TOML, XML, or CSV** and chain format conversion experiments client-side.
8. **Round-trip formats** where the engines agree; use CSV-to-YAML conversions when your table lands as CSV.
9. **Tune expression output** with unwrap scalar, suppress document separators, and pretty print when the output format is YAML.
10. **Tune selector output** with read/write flags, variables, "return modified root," and unstable selectors for advanced config edits.
11. **Share sessions**: input, expression, formats, and toggles **sync into the URL hash** (with a size guard) — bookmark or paste a link.
12. **Stay in flow**: debounced **auto-run**, **Cmd/Ctrl+Enter** to evaluate, **copy** output, **download** the full result when previews truncate, syntax-highlighted output, per-engine **syntax hints** with doc links, **clear**, **example** presets, engine **status badges**, and an 8s evaluation timeout that restarts a stuck worker.

## Supported Formats

| Format     | Read | Write | Expression engine | Selector engine | Notes                                                                                          |
| ---------- | ---- | ----- | ----------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| YAML       | Yes  | Yes   | In / out          | In / out        | Expression mode: optional _No document separators_ and _Pretty print_ for YAML output.         |
| JSON       | Yes  | Yes   | In / out          | In / out        | Expression mode: _Unwrap scalar_ affects JSON/YAML/Properties output.                          |
| XML        | Yes  | Yes   | In / out          | In / out        | Complex XML may not round-trip losslessly; selector mode read flags can tune XML parsing.      |
| CSV        | Yes  | Yes   | In / out          | In / out        | Selector mode accepts parser flags such as `csv-delimiter=;` via **Read flags**.               |
| TOML       | Yes  | Yes   | In / out          | In / out        | Handy for TOML-to-JSON and broader format conversion checks.                                   |
| INI        | Yes  | Yes   | —                 | In / out        | INI is selector-engine-native; use it for INI-to-YAML paths the expression engine cannot read. |
| Properties | No   | Yes   | Out only          | —               | Java Properties / `.properties` encoding is expression-mode output-only in Pluck.              |
| HCL        | Yes  | Yes   | —                 | In / out        | HashiCorp-style HCL is selector-engine-only; pair with write flags for specific HCL shaping.   |

## Examples

All samples run in **[Pluck](https://authos.app/tools/pluck)** — open the link, paste the input, set formats, and run.

### Expression examples

#### 1. Kubernetes Deployment — `metadata.name`

**Input (YAML)**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: storefront
spec:
  replicas: 3
```

**Expression**

```text
.metadata.name
```

**Output (YAML)**

```yaml
my-deployment
```

#### 2. Docker Compose — list service keys

**Input (YAML)**

```yaml
name: storefront
services:
  web:
    image: nginx:1.27
  worker:
    image: node:20-alpine
```

**Expression**

```text
.services | keys
```

**Output (YAML)**

```yaml
- web
- worker
```

#### 3. GitHub Actions — step `uses` strings

**Input (YAML)**

```yaml
name: ci
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm test
```

**Expression**

```text
.jobs.build.steps[].uses
```

**Output (YAML)**

```yaml
- actions/checkout@v4
- actions/setup-node@v4
```

#### 4. Helm-style values to JSON

**Input (YAML)**

```yaml
replicaCount: 2
image:
  repository: ghcr.io/example/api
  tag: "2.4.1"
service:
  type: ClusterIP
  port: 80
```

**Expression**

```text
.
```

**Output (JSON)**

```json
{
  "replicaCount": 2,
  "image": {
    "repository": "ghcr.io/example/api",
    "tag": "2.4.1"
  },
  "service": {
    "type": "ClusterIP",
    "port": 80
  }
}
```

### Selector examples

#### 5. INI config — port lookup

**Input (INI)**

```ini
app_mode = production

[server]
http_port = 9999
graceful_timeout = 30
```

**Selector**

```text
server.http_port
```

**Output (YAML)**

```yaml
9999
```

#### 6. `search()` by field value

**Input (YAML)**

```yaml
services:
  - name: web
    image: nginx:1.27
  - name: worker
    image: ghcr.io/example/worker:2.4.1
```

**Selector**

```text
search(name == "worker")
```

**Output (YAML)**

```yaml
name: worker
image: ghcr.io/example/worker:2.4.1
```

#### 7. TOML to JSON (identity selector)

**Input (TOML)**

```toml
[app]
name = "pluck"
port = 8080
```

**Selector**

```text
.
```

**Output (JSON)**

```json
{
  "app": {
    "name": "pluck",
    "port": 8080
  }
}
```

#### 8. HCL to JSON

**Input (HCL)**

```hcl
resource "aws_s3_bucket" "assets" {
  bucket = "pluck-assets"
  acl    = "private"
}
```

**Selector**

```text
.
```

**Output (JSON)**

```json
{
  "resource": {
    "aws_s3_bucket": {
      "assets": {
        "bucket": "pluck-assets",
        "acl": "private"
      }
    }
  }
}
```

## Private by Design — Runs Entirely in Your Browser

Both engines ship as Go programs compiled to **WebAssembly**, loaded from static files, and executed inside dedicated **web workers** so the page stays responsive. No API routes evaluate your documents, and nothing is posted to the server for parsing. Your configs stay on your machine, and after the first load the assets cache like any static app. There are no accounts, API keys, or rate limits.

## Run Locally

1. **Prerequisites:** Go **1.21+**, Node.js **18+**, and **bash** (for `scripts/build-engine.sh`; on Windows use Git Bash, WSL, or another bash environment).
2. **Clone** this repository.
3. **Build both WASM engines**: `bash scripts/build-engine.sh` — produces `public/engine-yq.wasm`, `public/engine-dasel.wasm`, optional `.gz` companions, and copies `public/wasm_exec.js` from your Go toolchain (runs `wasm-opt` when available).
4. `npm install`
5. `npm run dev`
6. Open **http://localhost:3000** (default Next.js dev server).

## Deploy Your Own Instance

`npm run build:all` runs `build:engine` then `next build` with static export enabled. The deployable site lands in **`out/`**, including both WASM engine files, `wasm_exec.js`, and gzipped WASM when present. Push that folder to **GitHub Pages**, **Cloudflare Pages**, **Vercel**, or any static host — no server runtime required.

## Under the Hood

Pluck's expression engine is powered by [yq](https://github.com/mikefarah/yq) (MIT) and the selector engine is powered by [dasel](https://github.com/TomWright/dasel) (MIT). Both are compiled to WebAssembly from Go source under `wasm/yq` and `wasm/dasel`. The TypeScript UI lives under `app/`, `components/`, and `lib/`.

## Part of authos

Pluck is one tool in **[authos](https://authos.app)** — a growing collection of free, browser-native developer tools I'm building under my own name, **Chaitanya Prabuddha**. Every **authos** tool runs entirely in your browser, avoids a login wall, and stays open source. If Pluck saved you ten minutes today, browse **[authos.app](https://authos.app)** for the rest — I'm also on X as [@chayprabs](https://x.com/chayprabs).

## Contributing

Issues and PRs are welcome — **Go (WASM)** and **TypeScript (UI)** contributions are both in scope. Most changes touch the bridges under `wasm/yq` and `wasm/dasel`, or the UI under `app/`, `components/`, and `lib/`. Please keep worker timeouts and bridge contracts in mind when you refactor. See **[LICENSE](./LICENSE)**.

## License

MIT. See **[LICENSE](./LICENSE)**. The bundled expression engines are also MIT licensed — verification and bundled text live in **[THIRD_PARTY_LICENSES.txt](./THIRD_PARTY_LICENSES.txt)**.
