[![Live Tool](https://img.shields.io/badge/Live%20Tool-authos.app%2Ftools%2Fpluck-0f172a?style=flat-square)](https://authos.app/tools/pluck) [![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](./LICENSE) [![WebAssembly](https://img.shields.io/badge/Built%20with-WebAssembly-654ff0?style=flat-square)](https://webassembly.org/) [![Engines](https://img.shields.io/badge/engines-yq%20%2B%20dasel-64748b?style=flat-square)](#two-engines-one-tool) [![authos](https://img.shields.io/badge/part%20of-authos-111827?style=flat-square)](https://authos.app)

# Pluck — Online YAML, JSON, XML, CSV, TOML & INI Query Playground

**Try it live → [authos.app/tools/pluck](https://authos.app/tools/pluck)**  
No install. No signup. No server. Runs entirely in your browser.

Pluck is a **multi format config query tool** and **yaml json xml converter browser** experience: paste structured config, run **jq for yaml online**-style **yq** expressions or **dasel selector online**, and export results without a backend. It is a **yaml query playground**, an **online yq playground**, and a **yq playground online** paired with a **dasel playground** in one tab, covering YAML, JSON, XML, CSV, TOML, and native **INI** (plus **HCL** and Java **Properties** output where the engines allow). If you want **json yaml xml online no install**, **parse yaml online free**, or a **yaml query tool no install**, this is the most complete **browser wasm yaml tool** pairing of **yq** and **dasel** shipping today.

## Two Engines. One Tool.

The **yq** engine is the **kubernetes yaml query tool**-style workhorse people reach for when they already think in **jq** and want the same feel for YAML: jq-style paths, filters, and transforms against YAML-heavy sources. In Pluck it reads and writes YAML, JSON, XML, CSV, and TOML, and it can **emit Java `.properties`** as output—ideal when you are prototyping **helm values.yaml editor** flows or grepping a **kubernetes manifest query tool** slice out of a Deployment.

**dasel** adds selector-shaped ergonomics (`server.http_port`, `search(...)`, assignment-style updates) and fills the gaps **yq** does not cover in this WASM build: native **INI** input and output, **HCL** in and out, optional **read flags** (`csv-delimiter=…`, `xml-mode=structured`), **write flags** (for example `hcl-block-format=array`), user **variables** (`cfg=json:{"region":"ap-south-1"}`), **return modified root** after a write selector, and an **unstable** selector mode. Together they cover the messy real world: **kubernetes manifest** and **docker compose yaml query** sessions, **github actions yaml parser**-style inspection, **helm values** blocks, and **INI** application configs you would normally open only in dasel.

| | yq engine | dasel engine |
| --- | --- | --- |
| **Syntax** | jq-style **yq** expressions (see [yq docs](https://mikefarah.gitbook.io/yq/)) | **dasel** selectors, `search()`, assignments, variables (see [dasel docs](https://daseldocs.tomwright.me/)) |
| **Input formats** | YAML, JSON, XML, CSV, TOML | YAML, JSON, XML, CSV, TOML, **INI**, **HCL** |
| **Output formats** | YAML, JSON, XML, CSV, TOML, **Properties** | YAML, JSON, XML, CSV, TOML, **INI**, **HCL** |

## What You Can Do With Pluck

1. **Extract `.metadata.name` from a Kubernetes Deployment**—a practical **kubernetes yaml query tool** / **kubernetes manifest query tool** moment—**without installing yq**.
2. **List Compose service keys** for a quick **docker compose yaml query** before you edit the file.
3. **Inspect `.jobs.*.steps[].uses`** in CI YAML as a lightweight **github actions yaml parser** in the browser.
4. **Convert a Helm `values.yaml` fragment to JSON** when you need JSON beside YAML for another system—a natural **helm values editor online** / **helm values.yaml editor** loop. Try it at **[authos.app/tools/pluck](https://authos.app/tools/pluck)**.
5. **Query an INI config with dasel** when **jq yq browser** stacks skip **INI** entirely—native **INI** is a Pluck differentiator.
6. **Use `search(...)` selectors** to find nodes anywhere in a document—**dasel selector online** workflows without leaving this page.
7. **Convert TOML, XML, or CSV** and chain **toml json yaml converter** or **xml to json yaml converter online** experiments client-side.
8. **Round-trip formats** where the engines agree; use **csv to yaml online**-style conversions when your table lands as CSV.
9. **Tune yq YAML output** with unwrap scalar, suppress document separators, and pretty print when the output format is YAML.
10. **Tune dasel** with read/write flags, variables, “return modified root,” and unstable selectors for advanced **config file transformer online** edits.
11. **Share sessions**: input, selector/expression, formats, and toggles **sync into the URL hash** (with a size guard)—bookmark or paste a link.
12. **Stay in flow**: debounced **auto-run**, **Cmd/Ctrl+Enter** to evaluate, **copy** output, **download** the full result when previews truncate, syntax-highlighted output, per-engine **syntax hints** with doc links, **clear**, **example** presets, engine **status badges**, and an 8s evaluation timeout that restarts a stuck worker—built like a small **yaml browser ide**, not a demo.

## Supported Formats

Pluck is deliberately a **multi engine yaml tool**: you pick **yq** or **dasel**, and the UI only offers format pairs that WASM bridge exposes today.

| Format | Read | Write | yq engine | dasel engine | Notes |
| --- | --- | --- | --- | --- | --- |
| YAML | Yes | Yes | In / out | In / out | **yq**: optional *No document separators* and *Pretty print* for YAML output. |
| JSON | Yes | Yes | In / out | In / out | **yq**: *Unwrap scalar* affects JSON/YAML/Properties output. |
| XML | Yes | Yes | In / out | In / out | Complex XML may not round-trip losslessly; **dasel** read flags can tune XML parsing (`xml-mode=structured`, etc.). |
| CSV | Yes | Yes | In / out | In / out | **dasel** accepts parser flags such as `csv-delimiter=;` via **Read flags**. |
| TOML | Yes | Yes | In / out | In / out | Handy for **toml to json online** and broader **toml json yaml converter** checks. |
| INI | Yes | Yes | — | In / out | **INI** is **dasel**-native here; use it for **ini yaml converter** / **ini to yaml converter** paths **yq** cannot read in this build. |
| Properties | No | Yes | Out only | — | Java **Properties** / `.properties` encoding is **yq** output-only in Pluck. |
| HCL | Yes | Yes | — | In / out | HashiCorp-style **HCL** is **dasel**-only; pair with **write flags** when you need specific HCL shaping. |

## Examples

All samples run in **[Pluck](https://authos.app/tools/pluck)**—open the link, paste the input, set formats, and run.

### yq expressions

#### 1. Kubernetes Deployment — `metadata.name` (**yaml path extractor**)

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

#### 4. Helm-style values → JSON (**yaml transformer browser** / **yaml to json browser tool**)

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

### dasel selectors

#### 5. INI config — port lookup (**jqplay for yaml**-adjacent, but for **INI**)

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

#### 7. TOML → JSON (identity selector)

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

#### 8. HCL → JSON (**dasel**-only path)

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

Both **yq** and **dasel** ship as Go programs compiled to **WebAssembly**, loaded from static files, and executed inside dedicated **web workers** so the page stays responsive. That makes Pluck a **no server yaml query** stack: no API routes evaluate your documents, and nothing is posted to Pluck’s origin for parsing. Treat it as a **client side config parser** and **private yaml editor**—your configs stay on your machine, and after the first load the assets cache like any static app, so it behaves much like an **offline yaml tool** when you are air-gapped. There are no accounts, API keys, or rate limits—just **`jq online playground`-grade immediacy** for structured configs, realized as WASM.

## Run Locally

1. **Prerequisites:** Go **1.21+**, Node.js **18+**, and **bash** (for `scripts/build-engine.sh`; on Windows use Git Bash, WSL, or another bash environment).
2. **Clone** this repository.
3. **Build both WASM engines**: `bash scripts/build-engine.sh` — produces `public/engine-yq.wasm`, `public/engine-dasel.wasm`, optional `.gz` companions, and copies `public/wasm_exec.js` from your Go toolchain (runs `wasm-opt` when available).
4. `npm install`
5. `npm run dev`
6. Open **http://localhost:3000** (default Next.js dev server).

## Deploy Your Own Instance

`npm run build:all` runs `build:engine` then `next build` with static export enabled. The deployable site lands in **`out/`**, including `out/engine-yq.wasm`, `out/engine-dasel.wasm`, `out/wasm_exec.js`, and gzipped WASM when present. Push that folder to **GitHub Pages**, **Cloudflare Pages**, **Vercel**, or any static host—no server runtime required.

## Part of authos

Pluck is one tool in **[authos](https://authos.app)**—a growing collection of free, browser-native developer tools I’m building under my own name, **Chaitanya Prabuddha**. Every **authos** tool runs entirely in your browser, avoids a login wall, and stays open source. If Pluck saved you ten minutes today, browse **[authos.app](https://authos.app)** for the rest—I’m also on X as [@chayprabs](https://x.com/chayprabs).

## Contributing

Issues and PRs are welcome—**Go (WASM)** and **TypeScript (UI)** contributions are both in scope. Most changes touch the bridges under `wasm/yq` and `wasm/dasel`, or the UI under `app/`, `components/`, and `lib/`. Please keep worker timeouts and bridge contracts in mind when you refactor. See **[LICENSE](./LICENSE)**.

## License

MIT. See **[LICENSE](./LICENSE)**. The bundled expression engines (**yq**, **dasel**) are also MIT licensed—verification and bundled text live in **[THIRD_PARTY_LICENSES.txt](./THIRD_PARTY_LICENSES.txt)**.
