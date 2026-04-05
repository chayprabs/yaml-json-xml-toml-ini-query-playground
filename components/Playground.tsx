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
    : "Dasel selectors plus native INI and HCL support, with search and write-style operations exposed safely in the browser.";
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

  const activeError = error ?? initError;
  const isReady = engineSnapshot.overallStatus === "ready";
  const preparedOutput = useMemo(() => prepareOutput(output), [output]);
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

  const runSnapshot = useCallback(async (snapshot: RunSnapshot, sequence: number) => {
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
  }, []);

  const requestRun = useCallback(
    async (snapshot: RunSnapshot) => {
      const snapshotKey = serializeRunSnapshot(snapshot);
      lastRequestedRunKeyRef.current = snapshotKey;

      const sequence = ++nextRunSequenceRef.current;
      latestRequestedSequenceRef.current = sequence;

      if (engineSnapshotRef.current.overallStatus === "loading") {
        setError("The WASM engines are still loading. Please wait a moment and try again.");
        return;
      }

      if (engineSnapshotRef.current.overallStatus === "error") {
        setError(
          getEngineInitError() ??
            "One of the browser engines failed to initialize. Refresh the page to retry.",
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
