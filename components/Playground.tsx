"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type KeyboardEvent,
} from "react";

import {
  evaluate,
  getEngineInitError,
  initEngine,
  subscribeToEngineInit,
  type EngineEvaluateOptions,
  type EngineInitStatus,
  type InputFormat,
  type OutputFormat,
} from "@/lib/engine";
import {
  INPUT_FORMATS,
  OUTPUT_FORMATS,
  ENGINE_STATUS_LABELS,
} from "@/lib/engine-types";
import { getHighlightLanguage, prepareOutput } from "@/lib/output";
import {
  AUTO_RUN_DELAY_MS,
  HASH_SYNC_DELAY_MS,
  MAX_SHAREABLE_HASH_LENGTH,
  canAutoRun,
  createDefaultState,
  createRunSnapshot,
  decodeHashState,
  encodeHashState,
  examples,
  serializeRunSnapshot,
  supportsNoDoc,
  supportsPrettyPrint,
  supportsUnwrapScalar,
  type Example,
  type PlaygroundState,
  type RunSnapshot,
} from "@/lib/playground-state";

type CopyState = "idle" | "copied" | "failed";

type QueuedRun = {
  sequence: number;
  snapshot: RunSnapshot;
};

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

const OutputSurface = memo(function OutputSurface({
  displayOutput,
  error,
  highlightEnabled,
  highlightedOutput,
  isRunning,
  outputFormat,
  outputRef,
  outputScrollTopRef,
  truncated,
  truncatedCharacters,
}: {
  displayOutput: string;
  error: string | null;
  highlightEnabled: boolean;
  highlightedOutput: string;
  isRunning: boolean;
  outputFormat: OutputFormat;
  outputRef: MutableRefObject<HTMLDivElement | null>;
  outputScrollTopRef: MutableRefObject<number>;
  truncated: boolean;
  truncatedCharacters: number;
}) {
  const language = getHighlightLanguage(outputFormat);

  return (
    <>
      <div
        data-testid="output-editor"
        ref={outputRef}
        aria-busy={isRunning}
        className="min-h-[24rem] overflow-auto rounded-[1.5rem] border border-ink/10 bg-ink px-4 py-4 shadow-inner"
        onScroll={(event) => {
          outputScrollTopRef.current = event.currentTarget.scrollTop;
        }}
      >
        {displayOutput ? (
          highlightEnabled ? (
            <pre className="m-0 whitespace-pre-wrap break-words font-[family-name:var(--font-mono)] text-sm leading-6 text-paper">
              <code
                className={`hljs language-${language} bg-transparent p-0`}
                data-testid="output-content"
                dangerouslySetInnerHTML={{ __html: highlightedOutput }}
              />
            </pre>
          ) : (
            <pre
              data-testid="output-content"
              className="m-0 whitespace-pre-wrap break-words font-[family-name:var(--font-mono)] text-sm leading-6 text-paper"
            >
              <code>{displayOutput}</code>
            </pre>
          )
        ) : (
          <div
            data-testid="output-content"
            className="font-[family-name:var(--font-mono)] text-sm leading-6 text-paper/45"
          >
            Run an expression to see the transformed output here.
          </div>
        )}
      </div>

      {truncated ? (
        <div
          data-testid="truncation-notice"
          className="rounded-[1.3rem] border border-brass/35 bg-brass/10 px-4 py-3 text-sm leading-6 text-ink"
        >
          Output truncated for responsive rendering.{" "}
          {truncatedCharacters.toLocaleString()} characters are hidden from the
          preview.
        </div>
      ) : null}

      {!highlightEnabled && displayOutput ? (
        <div className="rounded-[1.3rem] border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink/70">
          Syntax highlighting is disabled for large output to keep the UI
          responsive.
        </div>
      ) : null}

      {error ? (
        <div
          data-testid="error-box"
          role="alert"
          className="rounded-[1.3rem] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-danger"
        >
          {error}
        </div>
      ) : null}
    </>
  );
});

function downloadOutput(fullOutput: string, outputFormat: OutputFormat) {
  const blob = new Blob([fullOutput], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const extension = outputFormat === "props" ? "properties" : outputFormat;

  anchor.href = url;
  anchor.download = `prabuddha-output.${extension}`;
  anchor.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function Playground() {
  const [settings, setSettings] = useState<PlaygroundState>(createDefaultState);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [hasHydratedHash, setHasHydratedHash] = useState<boolean>(false);
  const [highlightedOutput, setHighlightedOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [shareWarning, setShareWarning] = useState<string | null>(null);
  const [wasmStatus, setWasmStatus] = useState<EngineInitStatus>("idle");

  const outputRef = useRef<HTMLDivElement | null>(null);
  const outputScrollTopRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const queuedRunRef = useRef<QueuedRun | null>(null);
  const settingsRef = useRef<PlaygroundState>(settings);
  const hasTriggeredInitialRunRef = useRef<boolean>(false);
  const lastRequestedRunKeyRef = useRef<string | null>(null);
  const latestRequestedSequenceRef = useRef<number>(0);
  const nextRunSequenceRef = useRef<number>(0);
  const wasmStatusRef = useRef<EngineInitStatus>(wasmStatus);

  const isReady = wasmStatus === "ready";
  const activeError = error ?? initError;
  const preparedOutput = useMemo(() => prepareOutput(output), [output]);

  const runSnapshot = useCallback(
    async (snapshot: RunSnapshot, sequence: number) => {
      isRunningRef.current = true;
      setIsRunning(true);
      setError(null);

      const startedAt = performance.now();
      const evaluateOptions: EngineEvaluateOptions = {
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

        if (
          !isMountedRef.current ||
          sequence !== latestRequestedSequenceRef.current
        ) {
          return;
        }

        startTransition(() => {
          setDurationMs(performance.now() - startedAt);
          setError(null);
          setOutput(result);
        });
      } catch (evaluationError: unknown) {
        if (
          !isMountedRef.current ||
          sequence !== latestRequestedSequenceRef.current
        ) {
          return;
        }

        startTransition(() => {
          setDurationMs(performance.now() - startedAt);
          setOutput("");
          setError(
            evaluationError instanceof Error
              ? evaluationError.message
              : "Evaluation failed with an unknown error.",
          );
        });
      } finally {
        if (!isMountedRef.current) {
          return;
        }

        isRunningRef.current = false;
        setIsRunning(false);

        const queuedRun = queuedRunRef.current;
        queuedRunRef.current = null;

        if (queuedRun) {
          void runSnapshot(queuedRun.snapshot, queuedRun.sequence);
        }
      }
    },
    [],
  );

  const requestRun = useCallback(
    async (snapshot: RunSnapshot) => {
      const snapshotKey = serializeRunSnapshot(snapshot);
      lastRequestedRunKeyRef.current = snapshotKey;

      const sequence = ++nextRunSequenceRef.current;
      latestRequestedSequenceRef.current = sequence;

      if (
        wasmStatusRef.current === "idle" ||
        wasmStatusRef.current === "loading-runtime" ||
        wasmStatusRef.current === "fetching-wasm" ||
        wasmStatusRef.current === "instantiating-wasm" ||
        wasmStatusRef.current === "starting-go"
      ) {
        setError(
          "The WASM runtime is still loading. Please wait a moment and try again.",
        );
        return;
      }

      if (wasmStatusRef.current === "error") {
        setError(
          getEngineInitError() ??
            "The browser engine failed to initialize. Refresh the page to retry.",
        );
        return;
      }

      if (isRunningRef.current) {
        queuedRunRef.current = {
          sequence,
          snapshot,
        };
        return;
      }

      await runSnapshot(snapshot, sequence);
    },
    [runSnapshot],
  );

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    wasmStatusRef.current = wasmStatus;
  }, [wasmStatus]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEngineInit((status) => {
      if (!isMountedRef.current) {
        return;
      }

      setWasmStatus(status);
      setInitError(status === "error" ? getEngineInitError() : null);
    });

    void initEngine().catch((initFailure: unknown) => {
      if (!isMountedRef.current) {
        return;
      }

      setInitError(
        initFailure instanceof Error
          ? initFailure.message
          : "Failed to initialize the browser engine.",
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

      if (nextHash.length > MAX_SHAREABLE_HASH_LENGTH) {
        setShareWarning(
          "This session is too large to keep in the URL. Shorten the input before sharing it.",
        );
        return;
      }

      try {
        const currentHash = window.location.hash.replace(/^#/u, "");
        if (currentHash === nextHash) {
          setShareWarning(null);
          return;
        }

        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#${nextHash}`,
        );
        setShareWarning(null);
      } catch {
        setShareWarning(
          "The browser could not update the shareable URL for this session.",
        );
      }
    }, HASH_SYNC_DELAY_MS);

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
  }, [hasHydratedHash, isReady, requestRun]);

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
    }, AUTO_RUN_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasHydratedHash, isReady, requestRun, settings]);

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

  useEffect(() => {
    let cancelled = false;

    if (!preparedOutput.highlightEnabled || !preparedOutput.displayOutput) {
      setHighlightedOutput("");
      return () => {
        cancelled = true;
      };
    }

    void import("@/lib/highlighter").then(({ highlightOutput }) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setHighlightedOutput(
          highlightOutput(preparedOutput.displayOutput, settings.outputFormat),
        );
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    preparedOutput.displayOutput,
    preparedOutput.highlightEnabled,
    settings.outputFormat,
  ]);

  useLayoutEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputScrollTopRef.current;
    }
  }, [preparedOutput.displayOutput]);

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
    latestRequestedSequenceRef.current = ++nextRunSequenceRef.current;
    queuedRunRef.current = null;
    lastRequestedRunKeyRef.current = null;
    setCopyState("idle");
    setDurationMs(null);
    setError(null);
    setOutput("");
    updateSettings({
      expression: "",
      input: "",
    });
  }

  async function copyOutput() {
    if (!preparedOutput.fullOutput) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(preparedOutput.fullOutput);
        setCopyState("copied");
        return;
      }
    } catch {
      // Fall through to the legacy copy path below.
    }

    try {
      const selection = window.getSelection();
      const previousRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const helper = document.createElement("textarea");

      helper.value = preparedOutput.fullOutput;
      helper.setAttribute("readonly", "true");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      helper.style.pointerEvents = "none";

      document.body.appendChild(helper);
      helper.select();

      const didCopy = document.execCommand("copy");
      document.body.removeChild(helper);

      if (previousRange && selection) {
        selection.removeAllRanges();
        selection.addRange(previousRange);
      }

      setCopyState(didCopy ? "copied" : "failed");
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
                {INPUT_FORMATS.map((format) => (
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
                {OUTPUT_FORMATS.map((format) => (
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
                onClick={() =>
                  void requestRun(createRunSnapshot(settingsRef.current))
                }
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
                className="min-h-12 rounded-2xl border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-ember/30 hover:bg-rose/60"
                onClick={clearPlayground}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <div
              data-testid="loading-indicator"
              role="status"
              aria-live="polite"
              className={`rounded-full px-3 py-1 font-medium ${
                wasmStatus === "ready"
                  ? "border border-pine/25 bg-pine/10 text-pine"
                  : "border border-brass/35 bg-brass/10 text-ink"
              }`}
            >
              {ENGINE_STATUS_LABELS[wasmStatus]}
            </div>

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
              description="Apply the engine's pretty-print expression so YAML output uses expanded block style."
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
              onChange={(event) =>
                updateSettings({ input: event.target.value })
              }
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
                  disabled={!preparedOutput.fullOutput}
                  className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-ember/35 hover:bg-rose/60 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void copyOutput()}
                >
                  {copyState === "copied"
                    ? "Copied"
                    : copyState === "failed"
                      ? "Copy failed"
                      : "Copy"}
                </button>
                {preparedOutput.truncated ? (
                  <button
                    type="button"
                    data-testid="download-output-button"
                    className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-ember/35 hover:bg-rose/60"
                    onClick={() =>
                      downloadOutput(
                        preparedOutput.fullOutput,
                        settings.outputFormat,
                      )
                    }
                  >
                    Download full result
                  </button>
                ) : null}
                <span className="text-xs text-ink/55">
                  {settings.outputFormat.toUpperCase()}
                </span>
              </div>
            </div>

            <OutputSurface
              displayOutput={preparedOutput.displayOutput}
              error={activeError}
              highlightEnabled={preparedOutput.highlightEnabled}
              highlightedOutput={highlightedOutput}
              isRunning={isRunning}
              outputFormat={settings.outputFormat}
              outputRef={outputRef}
              outputScrollTopRef={outputScrollTopRef}
              truncated={preparedOutput.truncated}
              truncatedCharacters={preparedOutput.truncatedCharacters}
            />

            {shareWarning ? (
              <div
                data-testid="share-warning"
                role="status"
                className="rounded-[1.3rem] border border-brass/35 bg-brass/10 px-4 py-3 text-sm leading-6 text-ink"
              >
                {shareWarning}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
