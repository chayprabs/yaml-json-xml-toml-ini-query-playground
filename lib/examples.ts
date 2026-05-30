import type { EngineType, InputFormat, OutputFormat } from "@/lib/engine-types";

export type Example = {
  description: string;
  engine: EngineType;
  expression: string;
  id: string;
  input: string;
  inputFormat: InputFormat;
  label: string;
  options?: Partial<{ returnRoot: boolean; unstable: boolean }>;
  outputFormat: OutputFormat;
  readFlagsText?: string;
  writeFlagsText?: string;
};

export const examples: Example[] = [
  {
    id: "k8s",
    label: "Kubernetes Deployment — extract name",
    description: "Pull a deployment name from a realistic workload manifest.",
    engine: "yq",
    expression: ".metadata.name",
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: storefront
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: api
          image: ghcr.io/example/storefront-api:1.7.3
          ports:
            - containerPort: 8080`,
  },
  {
    id: "compose",
    label: "Docker Compose — list services",
    description: "List service names from a multi-service Compose stack.",
    engine: "yq",
    expression: ".services | keys",
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `name: storefront
services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
  worker:
    image: node:20-alpine
    command: npm run worker
  redis:
    image: redis:7-alpine`,
  },
  {
    id: "gha",
    label: "GitHub Actions — step uses",
    description: "Inspect reusable actions in a CI workflow file.",
    engine: "yq",
    expression: ".jobs.build.steps[].uses",
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `name: ci
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test`,
  },
  {
    id: "helm-json",
    label: "Helm values to JSON",
    description: "Convert Helm-style values YAML into compact JSON.",
    engine: "yq",
    expression: ".",
    inputFormat: "yaml",
    outputFormat: "json",
    input: `replicaCount: 2
image:
  repository: ghcr.io/example/api
  tag: "1.4.2"
service:
  type: ClusterIP
  port: 8080`,
  },
  {
    id: "ini-read",
    label: "INI config — port lookup",
    description:
      "Read a sectioned INI config natively. INI is only available in selector mode.",
    engine: "dasel",
    expression: "server.http_port",
    inputFormat: "ini",
    outputFormat: "yaml",
    input: `app_mode = production

[server]
http_port = 9999
graceful_timeout = 30
`,
  },
  {
    id: "search-selector",
    label: "search() by field value",
    description:
      "Use a search selector to find matching objects anywhere in the document.",
    engine: "dasel",
    expression: 'search(name == "worker")',
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `services:
  - name: web
    image: nginx:1.27
    replicas: 2
  - name: worker
    image: ghcr.io/example/worker:2.4.1
    replicas: 1
  - name: cron
    image: ghcr.io/example/cron:1.3.0
    replicas: 1`,
  },
  {
    id: "toml-json",
    label: "TOML to JSON",
    description:
      "Convert TOML configuration into JSON with the selector engine.",
    engine: "dasel",
    expression: ".",
    inputFormat: "toml",
    outputFormat: "json",
    input: `title = "Pluck"
[server]
host = "127.0.0.1"
port = 8080
enabled = true`,
  },
  {
    id: "hcl-convert",
    label: "HCL to JSON",
    description:
      "Convert Terraform-style HCL to JSON, a format pair only available in selector mode.",
    engine: "dasel",
    expression: ".",
    inputFormat: "hcl",
    outputFormat: "json",
    input: `resource "aws_s3_bucket" "assets" {
  bucket = "pluck-assets"
  acl    = "private"
}`,
  },
  {
    id: "csv-custom",
    label: "CSV with custom delimiter",
    description: "Use read flags so semicolon-separated CSV parses correctly.",
    engine: "dasel",
    expression: ".",
    inputFormat: "csv",
    outputFormat: "json",
    readFlagsText: "csv-delimiter=;",
    input: `name;region;ready
api;ap-south-1;true
worker;eu-west-1;false`,
  },
  {
    id: "mutate-root",
    label: "Modify and return root",
    description:
      "Apply an assignment selector and return the modified document instead of only the assigned node.",
    engine: "dasel",
    expression: 'service.image = "ghcr.io/example/api:2.1.0"',
    inputFormat: "yaml",
    outputFormat: "json",
    options: {
      returnRoot: true,
    },
    input: `service:
  image: ghcr.io/example/api:1.9.3
  replicas: 3
  region: ap-south-1`,
  },
  {
    id: "statement-vars",
    label: "Variables and statements",
    description:
      "Compose a result with variables and semicolon-separated statements in one selector.",
    engine: "dasel",
    expression: `$primary = services[0].host;
$secondary = services[1].host;
[$primary, $secondary]`,
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `services:
  - name: api
    host: api.internal
  - name: worker
    host: worker.internal`,
  },
];

export function getExamplesForEngine(engine: EngineType): Example[] {
  return examples.filter((example) => example.engine === engine);
}

export function getDefaultExample(engine: EngineType): Example {
  return getExamplesForEngine(engine)[0] ?? examples[0];
}
