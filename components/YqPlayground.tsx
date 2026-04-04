"use client";

import hljs from "highlight.js/lib/core";
import iniLanguage from "highlight.js/lib/languages/ini";
import jsonLanguage from "highlight.js/lib/languages/json";
import plaintextLanguage from "highlight.js/lib/languages/plaintext";
import propertiesLanguage from "highlight.js/lib/languages/properties";
import xmlLanguage from "highlight.js/lib/languages/xml";
import yamlLanguage from "highlight.js/lib/languages/yaml";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  evaluate,
  initYq,
  subscribeToYqInit,
  type InputFormat,
  type OutputFormat,
  type YqEvaluateOptions,
  type YqInitStatus,
} from "@/lib/yq-wasm";

type Example = {
  id: string;
  label: string;
  description: string;
  expression: string;
  input: string;
  inputFormat: InputFormat;
  outputFormat: OutputFormat;
};

type PlaygroundState = {
  autoRun: boolean;
  expression: string;
  input: string;
  inputFormat: InputFormat;
  noDoc: boolean;
  outputFormat: OutputFormat;
  prettyPrint: boolean;
  unwrapScalar: boolean;
};

type RunSnapshot = Omit<PlaygroundState, "autoRun">;
type CopyState = "idle" | "copied" | "failed";

let languagesRegistered = false;

if (!languagesRegistered) {
  hljs.registerLanguage("yaml", yamlLanguage);
  hljs.registerLanguage("json", jsonLanguage);
  hljs.registerLanguage("xml", xmlLanguage);
  hljs.registerLanguage("toml", iniLanguage);
  hljs.registerLanguage("properties", propertiesLanguage);
  hljs.registerLanguage("plaintext", plaintextLanguage);
  languagesRegistered = true;
}

const inputFormats = ["yaml", "json", "xml", "csv", "toml"] as const;
const outputFormats = [
  "yaml",
  "json",
  "xml",
  "csv",
  "toml",
  "props",
] as const;
const statusLabels: Record<YqInitStatus, string> = {
  idle: "Waiting to initialize the WASM runtime.",
  "loading-runtime": "Loading the Go WebAssembly runtime.",
  "fetching-wasm": "Fetching the yq WebAssembly binary.",
  "instantiating-wasm": "Instantiating the WebAssembly module.",
  "starting-go": "Starting the Go runtime and registering yq.",
  ready: "The in-browser yq engine is ready.",
  error: "The yq runtime failed to initialize.",
};
const hashEncoder = new TextEncoder();
const hashDecoder = new TextDecoder();

const examples: Example[] = [
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

function createDefaultState(): PlaygroundState {
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

function isInputFormat(value: unknown): value is InputFormat {
  return (
    typeof value === "string" &&
    inputFormats.includes(value as (typeof inputFormats)[number])
  );
}

function isOutputFormat(value: unknown): value is OutputFormat {
  return (
    typeof value === "string" &&
    outputFormats.includes(value as (typeof outputFormats)[number])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function encodeHashState(state: PlaygroundState): string {
  const json = JSON.stringify({
    version: 1,
    ...state,
  });
  let binary = "";

  for (const byte of hashEncoder.encode(json)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function decodeHashState(hash: string): Partial<PlaygroundState> | null {
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

function createRunSnapshot(state: PlaygroundState): RunSnapshot {
  return {
    expression: state.expression,
    input: state.input,
    inputFormat: state.inputFormat,
    noDoc: state.noDoc,
    outputFormat: state.outputFormat,
    prettyPrint: state.prettyPrint,
    unwrapScalar: state.unwrapScalar,
  };
}

function serializeRunSnapshot(snapshot: RunSnapshot): string {
  return JSON.stringify(snapshot);
}

function canAutoRun(snapshot: RunSnapshot): boolean {
  return (
    snapshot.expression.trim().length > 0 && snapshot.input.trim().length > 0
  );
}

function getHighlightLanguage(outputFormat: OutputFormat): string {
  switch (outputFormat) {
    case "yaml":
      return "yaml";
    case "json":
      return "json";
    case "xml":
      return "xml";
    case "toml":
      return "toml";
    case "props":
      return "properties";
    case "csv":
    default:
      return "plaintext";
  }
}

function highlightOutput(output: string, outputFormat: OutputFormat): string {
  if (!output) {
    return "";
  }

  return hljs.highlight(output, {
    ignoreIllegals: true,
    language: getHighlightLanguage(outputFormat),
  }).value;
}

function supportsNoDoc(outputFormat: OutputFormat): boolean {
  return outputFormat === "yaml";
}

function supportsPrettyPrint(outputFormat: OutputFormat): boolean {
  return outputFormat === "yaml";
}

function supportsUnwrapScalar(outputFormat: OutputFormat): boolean {
  return (
    outputFormat === "yaml" ||
    outputFormat === "json" ||
    outputFormat === "props"
  );
}

function ToggleOption({
  checked,
  description,
  disabled,
  label,
  onChange,
  testId,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (nextValue: boolean) => void;
  testId: string;
}) {
  return (
    <label
      className={`rounded-2xl border px-4 py-3 transition ${
        disabled
          ? "cursor-not-allowed border-ink/8 bg-white/55 text-ink/40"
          : "cursor-pointer border-ink/10 bg-white/80 text-ink hover:border-ember/30 hover:bg-rose/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          data-testid={testId}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-ink/20 text-ember focus:ring-ember/40"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-xs leading-5 text-ink/65">{description}</p>
        </div>
      </div>
    </label>
  );
}

export function YqPlayground() {
  const [settings, setSettings] = useState<PlaygroundState>(createDefaultState);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [hasHydratedHash, setHasHydratedHash] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [wasmStatus, setWasmStatus] = useState<YqInitStatus>("idle");

  const outputRef = useRef<HTMLDivElement | null>(null);
  const outputScrollTopRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const settingsRef = useRef<PlaygroundState>(settings);
  const queuedRunRef = useRef<RunSnapshot | null>(null);
  const activeRunKeyRef = useRef<string | null>(null);
  const initErrorRef = useRef<string | null>(null);
  const lastRequestedRunKeyRef = useRef<string | null>(null);
  const hasTriggeredInitialRunRef = useRef<boolean>(false);
  const wasmStatusRef = useRef<YqInitStatus>(wasmStatus);

  const isReady = wasmStatus === "ready";
  const activeError = error ?? initError;
  const highlightedOutput = useMemo(
    () => highlightOutput(output, settings.outputFormat),
    [output, settings.outputFormat],
  );

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    wasmStatusRef.current = wasmStatus;
  }, [wasmStatus]);

  useEffect(() => {
    initErrorRef.current = initError;
  }, [initError]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToYqInit((status) => {
      if (!isMountedRef.current) {
        return;
      }

      setWasmStatus(status);
    });

    setError(null);
    setInitError(null);

    void initYq().catch((initFailure: unknown) => {
      if (!isMountedRef.current) {
        return;
      }

      setWasmStatus("error");
      setInitError(
        initFailure instanceof Error
          ? initFailure.message
          : "Failed to initialize the yq runtime.",
      );
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyHashState = () => {
      const nextState = decodeHashState(window.location.hash);
      if (nextState) {
        setSettings((currentState) => ({
          ...currentState,
          ...nextState,
        }));
      }

      setHasHydratedHash(true);
    };

    applyHashState();
    window.addEventListener("hashchange", applyHashState);

    return () => {
      window.removeEventListener("hashchange", applyHashState);
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedHash || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextHash = encodeHashState(settings);
      if (window.location.hash.replace(/^#/u, "") === nextHash) {
        return;
      }

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${nextHash}`,
      );
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasHydratedHash, settings]);

  useEffect(() => {
    if (!hasHydratedHash || !isReady || hasTriggeredInitialRunRef.current) {
      return;
    }

    hasTriggeredInitialRunRef.current = true;
    const initialSnapshot = createRunSnapshot(settingsRef.current);

    if (!canAutoRun(initialSnapshot)) {
      return;
    }

    void requestRun(initialSnapshot);
  }, [hasHydratedHash, isReady]);

  useEffect(() => {
    if (!hasHydratedHash || !isReady || !settings.autoRun) {
      return;
    }

    const snapshot = createRunSnapshot(settings);
    if (!canAutoRun(snapshot)) {
      return;
    }

    const snapshotKey = serializeRunSnapshot(snapshot);
    if (snapshotKey === lastRequestedRunKeyRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void requestRun(snapshot);
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    hasHydratedHash,
    isReady,
    settings.autoRun,
    settings.expression,
    settings.input,
    settings.inputFormat,
    settings.noDoc,
    settings.outputFormat,
    settings.prettyPrint,
    settings.unwrapScalar,
  ]);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyState]);

  useLayoutEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputScrollTopRef.current;
    }
  }, [output]);

  async function requestRun(snapshot: RunSnapshot) {
    const snapshotKey = serializeRunSnapshot(snapshot);
    lastRequestedRunKeyRef.current = snapshotKey;

    if (isRunningRef.current) {
      if (activeRunKeyRef.current !== snapshotKey) {
        queuedRunRef.current = snapshot;
      }
      return;
    }

    if (wasmStatusRef.current === "loading" || wasmStatusRef.current === "idle") {
      setError("The WASM runtime is still loading. Please wait a moment and try again.");
      return;
    }

    if (wasmStatusRef.current === "error") {
      setError(
        initErrorRef.current ??
          "The yq runtime failed to initialize. Refresh the page to retry.",
      );
      return;
    }

    activeRunKeyRef.current = snapshotKey;
    isRunningRef.current = true;
    setIsRunning(true);
    setError(null);

    const startedAt = performance.now();
    const evaluateOptions: YqEvaluateOptions = {
      noDoc: snapshot.noDoc,
      prettyPrint: snapshot.prettyPrint,
      unwrapScalar: snapshot.unwrapScalar,
    };

    try {
      const result = await evaluate(
        snapshot.input,
        snapshot.expression,
        snapshot.inputFormat,
        snapshot.outputFormat,
        evaluateOptions,
      );

      if (!isMountedRef.current) {
        return;
      }

      setOutput(result);
      setDurationMs(performance.now() - startedAt);
    } catch (evaluationError: unknown) {
      if (!isMountedRef.current) {
        return;
      }

      setOutput("");
      setDurationMs(performance.now() - startedAt);
      setError(
        evaluationError instanceof Error
          ? evaluationError.message
          : "yq evaluation failed with an unknown error.",
      );
    } finally {
      if (!isMountedRef.current) {
        return;
      }

      isRunningRef.current = false;
      setIsRunning(false);
      activeRunKeyRef.current = null;

      const queuedRun = queuedRunRef.current;
      queuedRunRef.current = null;

      if (queuedRun) {
        window.setTimeout(() => {
          void requestRun(queuedRun);
        }, 0);
      }
    }
  }

  function updateSettings(nextPartialState: Partial<PlaygroundState>) {
    setSettings((currentState) => ({
      ...currentState,
      ...nextPartialState,
    }));
  }

  function applyExample(example: Example) {
    const nextState: PlaygroundState = {
      ...settingsRef.current,
      expression: example.expression,
      input: example.input,
      inputFormat: example.inputFormat,
      outputFormat: example.outputFormat,
    };

    setSettings(nextState);
    setError(null);
    setDurationMs(null);

    if (isReady) {
      void requestRun(createRunSnapshot(nextState));
    }
  }

  function clearPlayground() {
    queuedRunRef.current = null;
    lastRequestedRunKeyRef.current = null;
    setOutput("");
    setError(null);
    setDurationMs(null);
    setCopyState("idle");
    updateSettings({
      expression: "",
      input: "",
    });
  }

  async function copyOutput() {
    if (!output) {
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  function handleKeyCommand(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void requestRun(createRunSnapshot(settingsRef.current));
    }
  }

  return (
    <section
      className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]"
      onKeyDownCapture={handleKeyCommand}
    >
      <aside className="panel-grid rounded-[2rem] border border-ink/10 bg-grid bg-[length:24px_24px] bg-white/70 p-5 shadow-panel backdrop-blur">
        <div className="rounded-[1.5rem] border border-ink/10 bg-paper/80 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ember">
            Example Set
          </p>
          <p className="mt-3 text-sm leading-6 text-ink/75">
            Load a real-world sample to explore Kubernetes, Docker Compose,
            GitHub Actions, JSON filtering, YAML arrays, and secret redaction.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {examples.map((example) => (
            <button
              key={example.id}
              type="button"
              data-testid={`preset-${example.id}`}
              className="rounded-[1.35rem] border border-ink/10 bg-white/80 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-ember/40 hover:bg-rose/60 focus:outline-none focus:ring-2 focus:ring-ember/40"
              onClick={() => applyExample(example)}
            >
              <p className="font-semibold text-ink">{example.label}</p>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                {example.description}
              </p>
              <p className="mt-3 font-[family-name:var(--font-mono)] text-xs text-ink/65">
                {example.expression}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <div className="rounded-[2rem] border border-ink/10 bg-white/75 p-4 shadow-panel backdrop-blur sm:p-6">
        <div className="rounded-[1.6rem] border border-ink/10 bg-paper/70 p-4 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_10rem_10rem_auto_auto]">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Expression
              </span>
              <textarea
                data-testid="expression-input"
                className="min-h-16 resize-y rounded-2xl border border-ink/10 bg-white px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-ink shadow-sm outline-none transition focus:border-ember/50 focus:ring-2 focus:ring-ember/30"
                value={settings.expression}
                onChange={(event) =>
                  updateSettings({ expression: event.target.value })
                }
                rows={2}
                spellCheck={false}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Input
              </span>
              <select
                data-testid="input-format"
                className="min-h-12 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-ember/50 focus:ring-2 focus:ring-ember/30"
                value={settings.inputFormat}
                onChange={(event) =>
                  updateSettings({
                    inputFormat: event.target.value as InputFormat,
                  })
                }
              >
                {inputFormats.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Output
              </span>
              <select
                data-testid="output-format"
                className="min-h-12 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-ember/50 focus:ring-2 focus:ring-ember/30"
                value={settings.outputFormat}
                onChange={(event) =>
                  updateSettings({
                    outputFormat: event.target.value as OutputFormat,
                  })
                }
              >
                {outputFormats.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Actions
              </span>
              <button
                type="button"
                data-testid="run-button"
                disabled={!isReady || isRunning}
                className="min-h-12 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ember disabled:cursor-not-allowed disabled:bg-ink/50"
                onClick={() => void requestRun(createRunSnapshot(settingsRef.current))}
              >
                {isRunning ? "Running..." : "Run"}
              </button>
            </div>

            <div className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Reset
              </span>
              <button
                type="button"
                data-testid="clear-button"
                disabled={isRunning}
                className="min-h-12 rounded-2xl border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-ember/30 hover:bg-rose/60 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={clearPlayground}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {wasmStatus !== "ready" ? (
              <div
                data-testid="loading-indicator"
                className="rounded-full border border-brass/35 bg-brass/10 px-3 py-1 font-medium text-ink"
              >
                {statusLabels[wasmStatus]}
              </div>
            ) : (
              <div className="rounded-full border border-pine/25 bg-pine/10 px-3 py-1 font-medium text-pine">
                {statusLabels.ready}
              </div>
            )}

            {settings.autoRun ? (
              <div className="rounded-full border border-ember/25 bg-rose/60 px-3 py-1 text-ink/80">
                Auto-run on
              </div>
            ) : (
              <div className="rounded-full border border-ink/10 bg-white px-3 py-1 text-ink/65">
                Auto-run off
              </div>
            )}

            {durationMs !== null ? (
              <div className="rounded-full border border-ink/10 bg-white px-3 py-1 text-ink/75">
                {durationMs.toFixed(2)} ms
              </div>
            ) : null}

            <div className="rounded-full border border-ink/10 bg-white px-3 py-1 text-ink/65">
              Press Cmd/Ctrl+Enter to run
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <ToggleOption
              checked={settings.autoRun}
              description="Evaluate automatically after 600ms when the input, expression, or format changes."
              label="Auto-run"
              onChange={(autoRun) => updateSettings({ autoRun })}
              testId="auto-run-toggle"
            />
            <ToggleOption
              checked={settings.unwrapScalar}
              description="Print scalar values without quotes when the output format supports it."
              disabled={!supportsUnwrapScalar(settings.outputFormat)}
              label="Unwrap scalar"
              onChange={(unwrapScalar) => updateSettings({ unwrapScalar })}
              testId="unwrap-scalar-toggle"
            />
            <ToggleOption
              checked={settings.noDoc}
              description="Suppress YAML document separators when multiple documents are emitted."
              disabled={!supportsNoDoc(settings.outputFormat)}
              label="No document separators"
              onChange={(noDoc) => updateSettings({ noDoc })}
              testId="no-doc-toggle"
            />
            <ToggleOption
              checked={settings.prettyPrint}
              description="Apply yq's pretty-print expression so YAML output uses expanded block style."
              disabled={!supportsPrettyPrint(settings.outputFormat)}
              label="Pretty print"
              onChange={(prettyPrint) => updateSettings({ prettyPrint })}
              testId="pretty-print-toggle"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Input document
              </span>
              <span className="text-xs text-ink/55">
                Shared in the URL hash for bookmarking
              </span>
            </div>
            <textarea
              data-testid="input-editor"
              className="min-h-[24rem] rounded-[1.5rem] border border-ink/10 bg-[#fffdfa] px-4 py-4 font-[family-name:var(--font-mono)] text-sm leading-6 text-ink shadow-inner outline-none transition focus:border-ember/40 focus:ring-2 focus:ring-ember/20"
              value={settings.input}
              onChange={(event) => updateSettings({ input: event.target.value })}
              spellCheck={false}
            />
          </label>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Output
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="copy-output-button"
                  disabled={!output}
                  className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-ember/35 hover:bg-rose/60 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void copyOutput()}
                >
                  {copyState === "copied"
                    ? "Copied"
                    : copyState === "failed"
                      ? "Copy failed"
                      : "Copy"}
                </button>
                <span className="text-xs text-ink/55">
                  {settings.outputFormat.toUpperCase()}
                </span>
              </div>
            </div>

            <div
              data-testid="output-editor"
              ref={outputRef}
              className="min-h-[24rem] overflow-auto rounded-[1.5rem] border border-ink/10 bg-ink px-4 py-4 shadow-inner"
              onScroll={(event) => {
                outputScrollTopRef.current = event.currentTarget.scrollTop;
              }}
            >
              {output ? (
                <pre className="m-0 whitespace-pre-wrap break-words font-[family-name:var(--font-mono)] text-sm leading-6 text-paper">
                  <code
                    className={`hljs language-${getHighlightLanguage(settings.outputFormat)} bg-transparent p-0`}
                    data-testid="output-content"
                    dangerouslySetInnerHTML={{ __html: highlightedOutput }}
                  />
                </pre>
              ) : (
                <div
                  data-testid="output-content"
                  className="font-[family-name:var(--font-mono)] text-sm leading-6 text-paper/45"
                >
                  Run an expression to see the transformed output here.
                </div>
              )}
            </div>

            {activeError ? (
              <div
                data-testid="error-box"
                className="rounded-[1.3rem] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-danger"
              >
                {activeError}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
