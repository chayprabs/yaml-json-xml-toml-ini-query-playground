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
  type KeyboardEvent,
  type MutableRefObject,
} from "react";

import {
  evaluate,
  getEngineInitError,
  getEngineInitSnapshot,
  initEngine,
  subscribeToEngineInit,
  type EngineInitSnapshot,
  type EngineType,
  type InputFormat,
  type OutputFormat,
} from "@/lib/engine";
import {
  ENGINE_DISPLAY_NAMES,
  ENGINE_INPUT_FORMATS,
  ENGINE_OUTPUT_FORMATS,
  ENGINE_OVERALL_STATUS_LABELS,
  ENGINE_STATUS_LABELS,
} from "@/lib/engine-types";
import { getHighlightLanguage, prepareOutput } from "@/lib/output";
import {
  AUTO_RUN_DELAY_MS,
  ENGINE_PLACEHOLDERS,
  ENGINE_SYNTAX_HINTS,
  HASH_SYNC_DELAY_MS,
  MAX_SHAREABLE_HASH_LENGTH,
  canAutoRun,
  createDefaultState,
  createEngineEvaluateOptions,
  createRunSnapshot,
  decodeHashState,
  encodeHashState,
  getDefaultExample,
  getExamplesForEngine,
  normalizeFormatsForEngine,
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
  anchor.download = `pluck-output.${extension}`;
  anchor.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function engineDescription(engine: EngineType): string {
  return engine === "yq"
    ? "jq-style expressions for reads, filtering, and conversion across YAML-first config workflows."
    : "Selector-based queries plus native INI and HCL support, with search and write-style operations exposed safely in the browser.";
}

export function Playground() {
  const [settings, setSettings] = useState<PlaygroundState>(createDefaultState);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [engineSnapshot, setEngineSnapshot] = useState<EngineInitSnapshot>(
    getEngineInitSnapshot,
  );
  const [error, setError] = useState<string | null>(null);
  const [hasHydratedHash, setHasHydratedHash] = useState<boolean>(false);
  const [highlightedOutput, setHighlightedOutput] = useState<string>("");
  const [initError, setInitError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<string>("");
  const [shareWarning, setShareWarning] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement | null>(null);
  const outputScrollTopRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const queuedRunRef = useRef<QueuedRun | null>(null);
  const settingsRef = useRef<PlaygroundState>(settings);
  const engineSnapshotRef = useRef<EngineInitSnapshot>(engineSnapshot);
  const hasTriggeredInitialRunRef = useRef<boolean>(false);
  const lastRequestedRunKeyRef = useRef<string | null>(null);
  const latestRequestedSequenceRef = useRef<number>(0);
  const nextRunSequenceRef = useRef<number>(0);

  const activeEngineState = engineSnapshot.engines[settings.engine];
  const activeError = error ?? activeEngineState.error ?? initError;
  const isReady = activeEngineState.status === "ready";
  const preparedOutput = useMemo(() => prepareOutput(output), [output]);
  const syntaxHint = ENGINE_SYNTAX_HINTS[settings.engine];
  const activeInputFormats = useMemo(
    () => ENGINE_INPUT_FORMATS[settings.engine],
    [settings.engine],
  );
  const activeOutputFormats = useMemo(
    () => ENGINE_OUTPUT_FORMATS[settings.engine],
    [settings.engine],
  );
  const activeExamples = useMemo(
    () => getExamplesForEngine(settings.engine),
    [settings.engine],
  );

  const runSnapshot = useCallback(
    async (snapshot: RunSnapshot, sequence: number) => {
      isRunningRef.current = true;
      setIsRunning(true);
      setError(null);

      const startedAt = performance.now();

      try {
        const evaluateOptions = createEngineEvaluateOptions(snapshot);
        const result = await evaluate(
          snapshot.input,
          snapshot.expression,
          snapshot.inputFormat,
          snapshot.outputFormat,
          snapshot.engine,
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

      const selectedEngineState =
        engineSnapshotRef.current.engines[snapshot.engine];

      if (selectedEngineState.status !== "ready") {
        if (selectedEngineState.status === "error") {
          setError(
            selectedEngineState.error ??
              getEngineInitError(snapshot.engine) ??
              `The ${ENGINE_DISPLAY_NAMES[snapshot.engine]} engine is unavailable right now.`,
          );
          return;
        }

        setError(
          `The ${ENGINE_DISPLAY_NAMES[snapshot.engine]} engine is still loading. Please wait a moment and try again.`,
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
    engineSnapshotRef.current = engineSnapshot;
  }, [engineSnapshot]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEngineInit((snapshot) => {
      if (!isMountedRef.current) {
        return;
      }

      setEngineSnapshot(snapshot);
      if (snapshot.engines[settingsRef.current.engine].status === "ready") {
        setInitError(null);
      }
    });

    void initEngine().catch((initFailure: unknown) => {
      if (!isMountedRef.current) {
        return;
      }

      setInitError(
        initFailure instanceof Error
          ? initFailure.message
          : "Failed to initialize the browser engines.",
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
        setSettings((currentState) =>
          normalizeFormatsForEngine({
            ...currentState,
            ...nextState,
          }),
        );
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
    setSettings((currentState) =>
      normalizeFormatsForEngine({
        ...currentState,
        ...nextPartialState,
      }),
    );
  }

  function applyExample(example: Example) {
    const nextState = normalizeFormatsForEngine({
      ...settingsRef.current,
      engine: example.engine,
      expression: example.expression,
      input: example.input,
      inputFormat: example.inputFormat,
      noDoc: false,
      outputFormat: example.outputFormat,
      prettyPrint: false,
      readFlagsText: "",
      returnRoot: example.options?.returnRoot ?? false,
      unstable: example.options?.unstable ?? false,
      unwrapScalar: true,
      variablesText: "",
      writeFlagsText: "",
    });

    setSettings(nextState);
    setError(null);
    setDurationMs(null);
    setOutput("");
    lastRequestedRunKeyRef.current = null;

    if (isReady) {
      void requestRun(createRunSnapshot(nextState));
    }
  }

  function switchEngine(nextEngine: EngineType) {
    if (settingsRef.current.engine === nextEngine) {
      return;
    }

    if (
      engineSnapshotRef.current.engines[nextEngine].status === "error" &&
      settingsRef.current.engine !== nextEngine
    ) {
      return;
    }

    const example = getDefaultExample(nextEngine);
    const nextState = normalizeFormatsForEngine({
      ...settingsRef.current,
      engine: nextEngine,
      expression: example.expression,
      input: example.input,
      inputFormat: example.inputFormat,
      noDoc: false,
      outputFormat: example.outputFormat,
      prettyPrint: false,
      readFlagsText: "",
      returnRoot: example.options?.returnRoot ?? false,
      unstable: example.options?.unstable ?? false,
      unwrapScalar: true,
      variablesText: "",
      writeFlagsText: "",
    });

    latestRequestedSequenceRef.current = ++nextRunSequenceRef.current;
    queuedRunRef.current = null;
    lastRequestedRunKeyRef.current = null;
    setCopyState("idle");
    setDurationMs(null);
    setError(null);
    setOutput("");
    setSettings(nextState);
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
            Engine Mode
          </p>
          <div
            className="mt-4 grid grid-cols-2 gap-2 rounded-[1.35rem] border border-ink/10 bg-white/80 p-2"
            data-testid="engine-toggle"
          >
            {(["yq", "dasel"] as const).map((engine) => {
              const selected = settings.engine === engine;

              return (
                <button
                  key={engine}
                  type="button"
                  data-testid={`engine-toggle-${engine}`}
                  aria-pressed={selected}
                  aria-disabled={
                    engineSnapshot.engines[engine].status === "error" &&
                    !selected
                  }
                  className={`rounded-[1rem] px-4 py-3 text-left transition ${
                    selected
                      ? "bg-ink text-white shadow-sm"
                      : engineSnapshot.engines[engine].status === "error"
                        ? "cursor-not-allowed bg-white/70 text-ink/35"
                        : "bg-white text-ink hover:bg-rose/60"
                  }`}
                  disabled={
                    engineSnapshot.engines[engine].status === "error" &&
                    !selected
                  }
                  title={engineSnapshot.engines[engine].error ?? undefined}
                  onClick={() => switchEngine(engine)}
                >
                  <p className="text-sm font-semibold">
                    {ENGINE_DISPLAY_NAMES[engine]}
                  </p>
                  <p
                    className={`mt-1 text-xs leading-5 ${
                      selected ? "text-white/75" : "text-ink/65"
                    }`}
                  >
                    {engine === "yq"
                      ? "jq-style expressions"
                      : "Dot-path selectors"}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm leading-6 text-ink/75">
            {engineDescription(settings.engine)}
          </p>
          {(["yq", "dasel"] as const)
            .filter(
              (engine) =>
                engine !== settings.engine &&
                engineSnapshot.engines[engine].status === "error",
            )
            .map((engine) => (
              <p
                key={engine}
                data-testid={`engine-error-${engine}`}
                className="mt-3 rounded-[1rem] border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-danger"
              >
                {ENGINE_DISPLAY_NAMES[engine]} engine is unavailable right now.{" "}
                {engineSnapshot.engines[engine].error ??
                  "Refresh the page to try loading it again."}
              </p>
            ))}
        </div>

        <div className="rounded-[1.5rem] border border-ink/10 bg-paper/80 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ember">
            Example Set
          </p>
          <p className="mt-3 text-sm leading-6 text-ink/75">
            {settings.engine === "yq"
              ? "Use realistic YAML and JSON-heavy samples for read, filter, and conversion workflows."
              : "Use native samples for INI, HCL, search selectors, and assignment-style mutations."}
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {activeExamples.map((example) => (
            <button
              key={example.id}
              type="button"
              data-testid={`preset-${example.id}`}
              className="rounded-[1.35rem] border border-ink/10 bg-white/80 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-ember/40 hover:bg-rose/60 focus:outline-none focus:ring-2 focus:ring-ember/40"
              onClick={() => applyExample(example)}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink">{example.label}</p>
                <span className="rounded-full border border-ink/10 bg-paper/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                  {example.inputFormat} to {example.outputFormat}
                </span>
              </div>
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
                {settings.engine === "yq" ? "Expression" : "Selector"}
              </span>
              <textarea
                data-testid="expression-input"
                className="min-h-16 resize-y rounded-2xl border border-ink/10 bg-white px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-ink shadow-sm outline-none transition focus:border-ember/50 focus:ring-2 focus:ring-ember/30"
                value={settings.expression}
                placeholder={ENGINE_PLACEHOLDERS[settings.engine]}
                onChange={(event) =>
                  updateSettings({ expression: event.target.value })
                }
                rows={2}
                spellCheck={false}
              />
              <p
                data-testid="syntax-hint"
                className="text-xs leading-5 text-ink/60"
              >
                {syntaxHint.prefix}{" "}
                <code className="font-[family-name:var(--font-mono)]">
                  {syntaxHint.example}
                </code>{" "}
                <a
                  className="font-semibold text-ember underline decoration-ember/30 underline-offset-2 transition hover:text-ink"
                  href={syntaxHint.docsHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  {syntaxHint.docsLabel}
                </a>
              </p>
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
                {activeInputFormats.map((format) => (
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
                {activeOutputFormats.map((format) => (
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
                engineSnapshot.overallStatus === "ready"
                  ? "border border-pine/25 bg-pine/10 text-pine"
                  : engineSnapshot.overallStatus === "error"
                    ? "border border-red-200 bg-red-50 text-danger"
                    : "border border-brass/35 bg-brass/10 text-ink"
              }`}
            >
              {ENGINE_OVERALL_STATUS_LABELS[engineSnapshot.overallStatus]}
            </div>

            {(["yq", "dasel"] as const).map((engine) => (
              <div
                key={engine}
                data-testid={`engine-status-${engine}`}
                className="rounded-full border border-ink/10 bg-white px-3 py-1 text-ink/70"
              >
                <span className="font-semibold text-ink">
                  {ENGINE_DISPLAY_NAMES[engine]}:
                </span>{" "}
                {ENGINE_STATUS_LABELS[engineSnapshot.engines[engine].status]}
              </div>
            ))}

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
              description="Evaluate automatically after 600ms when the input, query, or formats change."
              label="Auto-run"
              onChange={(autoRun) => updateSettings({ autoRun })}
              testId="auto-run-toggle"
            />

            {settings.engine === "yq" ? (
              <>
                <ToggleOption
                  checked={settings.unwrapScalar}
                  description="Print scalar values without quotes when the output format supports it."
                  disabled={
                    !supportsUnwrapScalar(
                      settings.engine,
                      settings.outputFormat,
                    )
                  }
                  label="Unwrap scalar"
                  onChange={(unwrapScalar) => updateSettings({ unwrapScalar })}
                  testId="unwrap-scalar-toggle"
                />
                <ToggleOption
                  checked={settings.noDoc}
                  description="Suppress YAML document separators when multiple documents are emitted."
                  disabled={
                    !supportsNoDoc(settings.engine, settings.outputFormat)
                  }
                  label="No document separators"
                  onChange={(noDoc) => updateSettings({ noDoc })}
                  testId="no-doc-toggle"
                />
                <ToggleOption
                  checked={settings.prettyPrint}
                  description="Apply the engine's pretty-print expression so YAML output uses expanded block style."
                  disabled={
                    !supportsPrettyPrint(settings.engine, settings.outputFormat)
                  }
                  label="Pretty print"
                  onChange={(prettyPrint) => updateSettings({ prettyPrint })}
                  testId="pretty-print-toggle"
                />
              </>
            ) : (
              <>
                <ToggleOption
                  checked={settings.returnRoot}
                  description="Return the modified root document after an assignment selector instead of only the selected node."
                  label="Return modified root"
                  onChange={(returnRoot) => updateSettings({ returnRoot })}
                  testId="return-root-toggle"
                />
                <ToggleOption
                  checked={settings.unstable}
                  description="Enable selectors guarded behind the unstable execution option."
                  label="Enable unstable selectors"
                  onChange={(unstable) => updateSettings({ unstable })}
                  testId="unstable-toggle"
                />
                <div className="rounded-2xl border border-ink/10 bg-white/80 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Variables</p>
                  <p className="mt-1 text-xs leading-5 text-ink/65">
                    One variable per line, such as{" "}
                    <code>{'cfg=json:{"region":"ap-south-1"}'}</code> or{" "}
                    <code>env=dasel:production</code>.
                  </p>
                  <textarea
                    data-testid="variables-input"
                    className="mt-3 min-h-24 w-full rounded-xl border border-ink/10 bg-paper/70 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-ink outline-none transition focus:border-ember/40 focus:ring-2 focus:ring-ember/20"
                    value={settings.variablesText}
                    placeholder={'cfg=json:{"region":"ap-south-1"}'}
                    onChange={(event) =>
                      updateSettings({ variablesText: event.target.value })
                    }
                    spellCheck={false}
                  />
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Read flags</p>
                  <p className="mt-1 text-xs leading-5 text-ink/65">
                    Parser flags such as <code>csv-delimiter=;</code> or{" "}
                    <code>xml-mode=structured</code>.
                  </p>
                  <input
                    data-testid="read-flags-input"
                    className="mt-3 w-full rounded-xl border border-ink/10 bg-paper/70 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-ink outline-none transition focus:border-ember/40 focus:ring-2 focus:ring-ember/20"
                    value={settings.readFlagsText}
                    placeholder="csv-delimiter=;"
                    onChange={(event) =>
                      updateSettings({ readFlagsText: event.target.value })
                    }
                  />
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Write flags</p>
                  <p className="mt-1 text-xs leading-5 text-ink/65">
                    Writer flags such as <code>hcl-block-format=array</code>.
                  </p>
                  <input
                    data-testid="write-flags-input"
                    className="mt-3 w-full rounded-xl border border-ink/10 bg-paper/70 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-ink outline-none transition focus:border-ember/40 focus:ring-2 focus:ring-ember/20"
                    value={settings.writeFlagsText}
                    placeholder="hcl-block-format=array"
                    onChange={(event) =>
                      updateSettings({ writeFlagsText: event.target.value })
                    }
                  />
                </div>
              </>
            )}
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
              placeholder={
                settings.engine === "yq"
                  ? "Paste YAML, JSON, XML, CSV, or TOML here."
                  : "Paste YAML, JSON, XML, CSV, TOML, INI, or HCL here."
              }
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
