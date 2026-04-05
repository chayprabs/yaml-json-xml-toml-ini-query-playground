import {
  isEngineType,
  isInputFormat,
  isOutputFormat,
  supportsInputFormat,
  supportsOutputFormat,
  type EngineEvaluateOptions,
  type EngineType,
  type InputFormat,
  type OutputFormat,
} from "@/lib/engine-types";

export type Example = {
  description: string;
  engine: EngineType;
  expression: string;
  id: string;
  input: string;
  inputFormat: InputFormat;
  label: string;
  options?: Partial<Pick<PlaygroundState, "returnRoot" | "unstable">>;
  outputFormat: OutputFormat;
};

export type PlaygroundState = {
  autoRun: boolean;
  engine: EngineType;
  expression: string;
  input: string;
  inputFormat: InputFormat;
  noDoc: boolean;
  outputFormat: OutputFormat;
  prettyPrint: boolean;
  readFlagsText: string;
  returnRoot: boolean;
  unstable: boolean;
  unwrapScalar: boolean;
  writeFlagsText: string;
};

export type RunSnapshot = Omit<PlaygroundState, "autoRun">;

export const HASH_SYNC_DELAY_MS = 250;
export const AUTO_RUN_DELAY_MS = 600;
export const MAX_SHAREABLE_HASH_LENGTH = 4_000;

export const ENGINE_PLACEHOLDERS: Record<EngineType, string> = {
  yq: ".metadata.name",
  dasel: "server.http_port",
};

export const ENGINE_SYNTAX_HINTS: Record<EngineType, string> = {
  yq: 'yq expression example: .services[] | select(.enabled == true) | .name',
  dasel:
    'dasel selector example: services.[name = "worker"].image or server.http_port',
};

const hashEncoder = new TextEncoder();
const hashDecoder = new TextDecoder();

export const examples: Example[] = [
  {
    id: "k8s",
    label: "Kubernetes deployment",
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
    label: "Docker Compose services",
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
    label: "GitHub Actions workflow",
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
    id: "ini-read",
    label: "INI configuration lookup",
    description:
      "Read a sectioned INI config natively, which the yq engine cannot parse.",
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
    label: "Search by sibling value",
    description:
      "Use a dasel search selector to find one object by value without jq-style filters.",
    engine: "dasel",
    expression: 'services.[name = "worker"].image',
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
    id: "mutate-root",
    label: "Modify and return root",
    description:
      "Apply a dasel assignment and return the modified document instead of only the assigned node.",
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
    id: "hcl-convert",
    label: "HCL to JSON conversion",
    description:
      "Convert Terraform-style HCL to JSON, a format pair that only the dasel engine offers here.",
    engine: "dasel",
    expression: ".",
    inputFormat: "hcl",
    outputFormat: "json",
    input: `resource "aws_s3_bucket" "assets" {
  bucket = "pluck-assets"
  acl    = "private"
}`,
  },
];

export function getExamplesForEngine(engine: EngineType): Example[] {
  return examples.filter((example) => example.engine === engine);
}

export function getDefaultExample(engine: EngineType): Example {
  return getExamplesForEngine(engine)[0] ?? examples[0];
}

export function createDefaultState(): PlaygroundState {
  const example = getDefaultExample("yq");

  return {
    autoRun: true,
    engine: example.engine,
    expression: example.expression,
    input: example.input,
    inputFormat: example.inputFormat,
    noDoc: false,
    outputFormat: example.outputFormat,
    prettyPrint: false,
    readFlagsText: "",
    returnRoot: false,
    unstable: false,
    unwrapScalar: true,
    writeFlagsText: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function encodeHashState(state: PlaygroundState): string {
  const json = JSON.stringify({
    version: 2,
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

    if (isEngineType(parsed.engine)) {
      nextState.engine = parsed.engine;
    }

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

    if (typeof parsed.returnRoot === "boolean") {
      nextState.returnRoot = parsed.returnRoot;
    }

    if (typeof parsed.unstable === "boolean") {
      nextState.unstable = parsed.unstable;
    }

    if (typeof parsed.readFlagsText === "string") {
      nextState.readFlagsText = parsed.readFlagsText;
    }

    if (typeof parsed.writeFlagsText === "string") {
      nextState.writeFlagsText = parsed.writeFlagsText;
    }

    return nextState;
  } catch {
    return null;
  }
}

export function supportsNoDoc(
  engine: EngineType,
  outputFormat: OutputFormat,
): boolean {
  return engine === "yq" && outputFormat === "yaml";
}

export function supportsPrettyPrint(
  engine: EngineType,
  outputFormat: OutputFormat,
): boolean {
  return engine === "yq" && outputFormat === "yaml";
}

export function supportsUnwrapScalar(
  engine: EngineType,
  outputFormat: OutputFormat,
): boolean {
  return (
    engine === "yq" &&
    (outputFormat === "yaml" ||
      outputFormat === "json" ||
      outputFormat === "props")
  );
}

export function normalizeFormatsForEngine(
  state: PlaygroundState,
): PlaygroundState {
  const example = getDefaultExample(state.engine);

  return {
    ...state,
    inputFormat: supportsInputFormat(state.engine, state.inputFormat)
      ? state.inputFormat
      : example.inputFormat,
    outputFormat: supportsOutputFormat(state.engine, state.outputFormat)
      ? state.outputFormat
      : example.outputFormat,
  };
}

export function createRunSnapshot(state: PlaygroundState): RunSnapshot {
  const normalizedState = normalizeFormatsForEngine(state);

  return {
    engine: normalizedState.engine,
    expression: normalizedState.expression,
    input: normalizedState.input,
    inputFormat: normalizedState.inputFormat,
    noDoc: supportsNoDoc(
      normalizedState.engine,
      normalizedState.outputFormat,
    )
      ? normalizedState.noDoc
      : false,
    outputFormat: normalizedState.outputFormat,
    prettyPrint: supportsPrettyPrint(
      normalizedState.engine,
      normalizedState.outputFormat,
    )
      ? normalizedState.prettyPrint
      : false,
    readFlagsText:
      normalizedState.engine === "dasel" ? normalizedState.readFlagsText : "",
    returnRoot:
      normalizedState.engine === "dasel" ? normalizedState.returnRoot : false,
    unstable:
      normalizedState.engine === "dasel" ? normalizedState.unstable : false,
    unwrapScalar: supportsUnwrapScalar(
      normalizedState.engine,
      normalizedState.outputFormat,
    )
      ? normalizedState.unwrapScalar
      : false,
    writeFlagsText:
      normalizedState.engine === "dasel" ? normalizedState.writeFlagsText : "",
  };
}

export function serializeRunSnapshot(snapshot: RunSnapshot): string {
  return JSON.stringify(snapshot);
}

export function canAutoRun(snapshot: RunSnapshot): boolean {
  if (snapshot.expression.trim().length === 0) {
    return false;
  }

  if (snapshot.engine === "dasel") {
    return true;
  }

  return snapshot.input.trim().length > 0;
}

export function parseFlagMap(flagText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const segments = flagText
    .split(/\r?\n|,/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === segment.length - 1) {
      throw new Error(
        `Invalid dasel flag ${JSON.stringify(segment)}. Use key=value pairs separated by commas or new lines.`,
      );
    }

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      throw new Error(
        `Invalid dasel flag ${JSON.stringify(segment)}. Use key=value pairs separated by commas or new lines.`,
      );
    }

    result[key] = value;
  }

  return result;
}

export function createEngineEvaluateOptions(
  snapshot: RunSnapshot,
): EngineEvaluateOptions {
  if (snapshot.engine === "yq") {
    return {
      noDoc: snapshot.noDoc,
      prettyPrint: snapshot.prettyPrint,
      unwrapScalar: snapshot.unwrapScalar,
    };
  }

  return {
    readFlags: parseFlagMap(snapshot.readFlagsText),
    returnRoot: snapshot.returnRoot,
    unstable: snapshot.unstable,
    writeFlags: parseFlagMap(snapshot.writeFlagsText),
  };
}
