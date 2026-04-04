"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { evaluate, initYq } from "@/lib/yq-wasm";

type Format = "yaml" | "json" | "xml" | "csv" | "toml" | "props";
type InputFormat = Exclude<Format, "props">;
type WasmState = "loading" | "ready" | "error";

type Example = {
  id: string;
  label: string;
  expression: string;
  input: string;
  inputFormat: InputFormat;
  outputFormat: Format;
};

const examples: Example[] = [
  {
    id: "k8s",
    label: "Kubernetes name",
    expression: ".metadata.name",
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
spec:
  replicas: 2
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
          image: nginx:1.27`,
  },
  {
    id: "compose",
    label: "Compose service keys",
    expression: ".services | keys",
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `services:
  web:
    image: nginx:stable
  worker:
    image: alpine:3.20
  redis:
    image: redis:7`,
  },
  {
    id: "json-select",
    label: "Filter JSON entries",
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
    label: "Array names",
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
    label: "Delete password",
    expression: "del(.password)",
    inputFormat: "yaml",
    outputFormat: "yaml",
    input: `username: admin
password: super-secret
region: us-east-1
retries: 3`,
  },
];

const inputFormats: InputFormat[] = ["yaml", "json", "xml", "csv", "toml"];
const outputFormats: Format[] = ["yaml", "json", "xml", "csv", "toml", "props"];

export function YqPlayground() {
  const [expression, setExpression] = useState<string>(examples[0].expression);
  const [input, setInput] = useState<string>(examples[0].input);
  const [inputFormat, setInputFormat] = useState<InputFormat>(
    examples[0].inputFormat,
  );
  const [outputFormat, setOutputFormat] = useState<Format>(
    examples[0].outputFormat,
  );
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [wasmState, setWasmState] = useState<WasmState>("loading");

  const outputRef = useRef<HTMLTextAreaElement | null>(null);
  const outputScrollTopRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const isReady = wasmState === "ready";
  const activeError = error ?? initError;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setWasmState("loading");
    setInitError(null);
    setError(null);

    void initYq()
      .then(() => {
        if (isMountedRef.current) {
          setWasmState("ready");
        }
      })
      .catch((initFailure: unknown) => {
        if (!isMountedRef.current) {
          return;
        }

        const message =
          initFailure instanceof Error
            ? initFailure.message
            : "Failed to initialize yq.";
        setWasmState("error");
        setInitError(message);
      });
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let cancelled = false;
    const initialExample = examples[0];

    setIsRunning(true);
    setError(null);

    const startedAt = performance.now();

    void evaluate(
      initialExample.input,
      initialExample.expression,
      initialExample.inputFormat,
      initialExample.outputFormat,
    )
      .then((result) => {
        if (!isMountedRef.current || cancelled) {
          return;
        }

        setOutput(result);
        setDurationMs(performance.now() - startedAt);
      })
      .catch((evaluationError: unknown) => {
        if (!isMountedRef.current || cancelled) {
          return;
        }

        setOutput("");
        setDurationMs(performance.now() - startedAt);
        setError(
          evaluationError instanceof Error
            ? evaluationError.message
            : "yq evaluation failed with an unknown error.",
        );
      })
      .finally(() => {
        if (isMountedRef.current && !cancelled) {
          setIsRunning(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  useLayoutEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputScrollTopRef.current;
    }
  }, [output]);

  async function runEvaluation(
    nextInput: string = input,
    nextExpression: string = expression,
    nextInputFormat: InputFormat = inputFormat,
    nextOutputFormat: Format = outputFormat,
  ) {
    if (isRunning) {
      return;
    }

    if (wasmState === "loading") {
      setError("WASM is still loading. Please wait a moment and try again.");
      return;
    }

    if (wasmState === "error") {
      setError(
        initError ?? "WASM failed to initialize. Refresh the page to retry.",
      );
      return;
    }

    setIsRunning(true);
    setError(null);

    const startedAt = performance.now();

    try {
      const result = await evaluate(
        nextInput,
        nextExpression,
        nextInputFormat,
        nextOutputFormat,
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
      if (isMountedRef.current) {
        setIsRunning(false);
      }
    }
  }

  function applyExample(example: Example) {
    setExpression(example.expression);
    setInput(example.input);
    setInputFormat(example.inputFormat);
    setOutputFormat(example.outputFormat);

    if (isReady) {
      void runEvaluation(
        example.input,
        example.expression,
        example.inputFormat,
        example.outputFormat,
      );
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="panel-grid rounded-[2rem] border border-ink/10 bg-grid bg-[length:24px_24px] bg-white/70 p-5 shadow-panel backdrop-blur">
        <div className="rounded-[1.5rem] border border-ink/10 bg-paper/80 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ember">
            Examples
          </p>
          <p className="mt-3 text-sm leading-6 text-ink/75">
            Load a preset to swap the input and expression instantly. Each
            example also runs immediately once the WASM runtime is ready.
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
              <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-ink/65">
                {example.expression}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <div className="rounded-[2rem] border border-ink/10 bg-white/75 p-4 shadow-panel backdrop-blur sm:p-6">
        <div className="rounded-[1.6rem] border border-ink/10 bg-paper/70 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Expression
              </span>
              <input
                data-testid="expression-input"
                className="min-h-12 rounded-2xl border border-ink/10 bg-white px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-ink shadow-sm outline-none transition focus:border-ember/50 focus:ring-2 focus:ring-ember/30"
                value={expression}
                onChange={(event) => setExpression(event.target.value)}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
                Input
              </span>
              <select
                data-testid="input-format"
                className="min-h-12 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-ember/50 focus:ring-2 focus:ring-ember/30"
                value={inputFormat}
                onChange={(event) =>
                  setInputFormat(event.target.value as InputFormat)
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
                value={outputFormat}
                onChange={(event) =>
                  setOutputFormat(event.target.value as Format)
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
                Execute
              </span>
              <button
                type="button"
                data-testid="run-button"
                disabled={!isReady || isRunning}
                className="min-h-12 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ember disabled:cursor-not-allowed disabled:bg-ink/50"
                onClick={() => void runEvaluation()}
              >
                {isRunning ? "Running..." : "Run"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {wasmState === "loading" ? (
              <div
                data-testid="loading-indicator"
                className="rounded-full border border-brass/35 bg-brass/10 px-3 py-1 font-medium text-ink"
              >
                Initializing WASM runtime...
              </div>
            ) : null}

            {wasmState === "ready" ? (
              <div className="rounded-full border border-pine/25 bg-pine/10 px-3 py-1 font-medium text-pine">
                WASM ready
              </div>
            ) : null}

            {wasmState === "error" ? (
              <div className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-medium text-danger">
                WASM failed to load
              </div>
            ) : null}

            {durationMs !== null ? (
              <div className="rounded-full border border-ink/10 bg-white px-3 py-1 text-ink/75">
                {durationMs.toFixed(2)} ms
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
              Input document
            </span>
            <textarea
              data-testid="input-editor"
              className="min-h-[22rem] rounded-[1.5rem] border border-ink/10 bg-[#fffdfa] px-4 py-4 font-[family-name:var(--font-mono)] text-sm leading-6 text-ink shadow-inner outline-none transition focus:border-ember/40 focus:ring-2 focus:ring-ember/20"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/55">
              Output
            </span>
            <textarea
              data-testid="output-editor"
              ref={outputRef}
              readOnly
              className="min-h-[22rem] rounded-[1.5rem] border border-ink/10 bg-ink px-4 py-4 font-[family-name:var(--font-mono)] text-sm leading-6 text-paper shadow-inner outline-none"
              value={output}
              onScroll={(event) => {
                outputScrollTopRef.current = event.currentTarget.scrollTop;
              }}
              spellCheck={false}
            />

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
