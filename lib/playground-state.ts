import {
  INPUT_FORMATS,
  OUTPUT_FORMATS,
  type InputFormat,
  type OutputFormat,
} from "@/lib/engine-types";

export type Example = {
  id: string;
  label: string;
  description: string;
  expression: string;
  input: string;
  inputFormat: InputFormat;
  outputFormat: OutputFormat;
};

export type PlaygroundState = {
  autoRun: boolean;
  expression: string;
  input: string;
  inputFormat: InputFormat;
  noDoc: boolean;
  outputFormat: OutputFormat;
  prettyPrint: boolean;
  unwrapScalar: boolean;
};

export type RunSnapshot = Omit<PlaygroundState, "autoRun">;

export const HASH_SYNC_DELAY_MS = 250;
export const AUTO_RUN_DELAY_MS = 600;
export const MAX_SHAREABLE_HASH_LENGTH = 4_000;

const hashEncoder = new TextEncoder();
const hashDecoder = new TextDecoder();

export const examples: Example[] = [
  {
    id: "k8s",
    label: "Kubernetes deployment",
    description: "Pull a deployment name from a realistic workload manifest.",
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
    label: "Docker Compose services",
    description: "List service names from a multi-service Compose stack.",
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
    label: "GitHub Actions workflow",
    description: "Inspect reusable actions in a CI workflow file.",
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
    id: "json-select",
    label: "Large JSON entries",
    description: "Filter object entries with values above a threshold.",
    expression: ". | to_entries | .[] | select(.value > 100)",
    inputFormat: "json",
    outputFormat: "yaml",
    input: `{
  "bronze": 24,
  "silver": 118,
  "gold": 340,
  "platinum": 99
}`,
  },
  {
    id: "yaml-array",
    label: "YAML array names",
    description: "Map over a simple YAML array and print the names.",
    expression: ".[] | .name",
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `- name: Ada
  role: engineer
- name: Grace
  role: architect
- name: Linus
  role: operator`,
  },
  {
    id: "redact",
    label: "Redact a secret",
    description: "Remove a password field from an app configuration file.",
    expression: "del(.password)",
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `username: admin
password: super-secret
region: us-east-1
retries: 3`,
  },
];

export function createDefaultState(): PlaygroundState {
  return {
    autoRun: true,
    expression: examples[0].expression,
    input: examples[0].input,
    inputFormat: examples[0].inputFormat,
    noDoc: false,
    outputFormat: examples[0].outputFormat,
    prettyPrint: false,
    unwrapScalar: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isInputFormat(value: unknown): value is InputFormat {
  return (
    typeof value === "string" && INPUT_FORMATS.includes(value as InputFormat)
  );
}

export function isOutputFormat(value: unknown): value is OutputFormat {
  return (
    typeof value === "string" && OUTPUT_FORMATS.includes(value as OutputFormat)
  );
}

export function encodeHashState(state: PlaygroundState): string {
  const json = JSON.stringify({
    version: 1,
    ...state,
  });
  let binary = "";

  for (const byte of hashEncoder.encode(json)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

export function decodeHashState(hash: string): Partial<PlaygroundState> | null {
  const normalizedHash = hash.replace(/^#/u, "").trim();
  if (!normalizedHash) {
    return null;
  }

  try {
    const padded = normalizedHash
      .replace(/-/gu, "+")
      .replace(/_/gu, "/")
      .padEnd(Math.ceil(normalizedHash.length / 4) * 4, "=");
    const decodedBinary = atob(padded);
    const bytes = Uint8Array.from(decodedBinary, (character) =>
      character.charCodeAt(0),
    );
    const decodedJson = hashDecoder.decode(bytes);
    const parsed = JSON.parse(decodedJson) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    const nextState: Partial<PlaygroundState> = {};

    if (typeof parsed.expression === "string") {
      nextState.expression = parsed.expression;
    }

    if (typeof parsed.input === "string") {
      nextState.input = parsed.input;
    }

    if (isInputFormat(parsed.inputFormat)) {
      nextState.inputFormat = parsed.inputFormat;
    }

    if (isOutputFormat(parsed.outputFormat)) {
      nextState.outputFormat = parsed.outputFormat;
    }

    if (typeof parsed.unwrapScalar === "boolean") {
      nextState.unwrapScalar = parsed.unwrapScalar;
    }

    if (typeof parsed.noDoc === "boolean") {
      nextState.noDoc = parsed.noDoc;
    }

    if (typeof parsed.prettyPrint === "boolean") {
      nextState.prettyPrint = parsed.prettyPrint;
    }

    if (typeof parsed.autoRun === "boolean") {
      nextState.autoRun = parsed.autoRun;
    }

    return nextState;
  } catch {
    return null;
  }
}

export function supportsNoDoc(outputFormat: OutputFormat): boolean {
  return outputFormat === "yaml";
}

export function supportsPrettyPrint(outputFormat: OutputFormat): boolean {
  return outputFormat === "yaml";
}

export function supportsUnwrapScalar(outputFormat: OutputFormat): boolean {
  return (
    outputFormat === "yaml" ||
    outputFormat === "json" ||
    outputFormat === "props"
  );
}

export function createRunSnapshot(state: PlaygroundState): RunSnapshot {
  return {
    expression: state.expression,
    input: state.input,
    inputFormat: state.inputFormat,
    noDoc: supportsNoDoc(state.outputFormat) ? state.noDoc : false,
    outputFormat: state.outputFormat,
    prettyPrint: supportsPrettyPrint(state.outputFormat)
      ? state.prettyPrint
      : false,
    unwrapScalar: supportsUnwrapScalar(state.outputFormat)
      ? state.unwrapScalar
      : false,
  };
}

export function serializeRunSnapshot(snapshot: RunSnapshot): string {
  return JSON.stringify(snapshot);
}

export function canAutoRun(snapshot: RunSnapshot): boolean {
  return (
    snapshot.expression.trim().length > 0 && snapshot.input.trim().length > 0
  );
}
