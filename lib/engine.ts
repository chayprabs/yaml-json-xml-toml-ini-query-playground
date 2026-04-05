import { normalizeEngineError } from "@/lib/engine-errors";
import {
  type EngineEvaluateOptions,
  type EngineInitStatus,
  type InputFormat,
  type OutputFormat,
} from "@/lib/engine-types";

export type {
  EngineEvaluateOptions,
  EngineInitStatus,
  InputFormat,
  OutputFormat,
} from "@/lib/engine-types";

type InitListener = (status: EngineInitStatus) => void;

type WorkerInitMessage = {
  testDisableWebAssembly?: boolean;
  type: "init";
};

type WorkerEvaluateMessage = {
  type: "evaluate";
  requestId: number;
  payload: {
    expression: string;
    input: string;
    inputFormat: InputFormat;
    options: EngineEvaluateOptions;
    outputFormat: OutputFormat;
  };
};

type WorkerTestPanicMessage = {
  type: "test-panic-next-evaluation";
};

type WorkerTestDelayMessage = {
  delayMs: number;
  type: "test-delay-next-evaluation";
};

type WorkerRequest =
  | WorkerEvaluateMessage
  | WorkerInitMessage
  | WorkerTestDelayMessage
  | WorkerTestPanicMessage;

type WorkerStatusMessage = {
  type: "status";
  message?: string;
  status: EngineInitStatus;
};

type WorkerEvaluateSuccessMessage = {
  type: "evaluate-success";
  output: string;
  requestId: number;
};

type WorkerEvaluateErrorMessage = {
  type: "evaluate-error";
  message: string;
  requestId: number;
};

type WorkerResponse =
  | WorkerEvaluateErrorMessage
  | WorkerEvaluateSuccessMessage
  | WorkerStatusMessage;

type PendingEvaluation = {
  reject: (reason?: unknown) => void;
  resolve: (value: string) => void;
  startedAtMark: string;
  timeoutId: number;
};

const EVALUATION_TIMEOUT_MS = 8_000;
const DEFAULT_OPTIONS: EngineEvaluateOptions = {
  noDoc: false,
  prettyPrint: false,
  unwrapScalar: true,
};
const ENGINE_INIT_START_MARK = "engine:init:start";
const ENGINE_INIT_READY_MARK = "engine:init:ready";
const ENGINE_INIT_MEASURE = "engine:init";

declare global {
  interface Window {
    __engineTestBootstrapOptions?: {
      disableWebAssembly?: boolean;
    };
    __engineTestControls?: {
      delayNextEvaluation: (delayMs: number) => Promise<void>;
      evaluateDirect: (request: {
        expression: string;
        input: string;
        inputFormat: InputFormat;
        options?: Partial<EngineEvaluateOptions>;
        outputFormat: OutputFormat;
      }) => Promise<string>;
      panicNextEvaluation: () => Promise<void>;
    };
  }
}

let worker: Worker | null = null;
let initError: Error | null = null;
let initPromise: Promise<void> | null = null;
let initPromiseReject: ((error: Error) => void) | null = null;
let initPromiseResolve: (() => void) | null = null;
let initStarted = false;
let initStatus: EngineInitStatus = "idle";
let nextRequestId = 0;

const initListeners = new Set<InitListener>();
const pendingEvaluations = new Map<number, PendingEvaluation>();

function setInitStatus(nextStatus: EngineInitStatus, error?: Error) {
  initStatus = nextStatus;

  if (nextStatus === "ready") {
    initError = null;
    performance.mark(ENGINE_INIT_READY_MARK);

    try {
      performance.measure(
        ENGINE_INIT_MEASURE,
        ENGINE_INIT_START_MARK,
        ENGINE_INIT_READY_MARK,
      );
    } catch {
      // Ignore repeated mark collisions from worker restarts.
    }
  }

  if (nextStatus === "error" && error) {
    initError = error;
  }

  for (const listener of initListeners) {
    listener(nextStatus);
  }
}

function resolveInitPromise() {
  initPromiseResolve?.();
  initPromise = Promise.resolve();
  initPromiseResolve = null;
  initPromiseReject = null;
}

function rejectInitPromise(error: Error) {
  initPromiseReject?.(error);
  initPromise = null;
  initPromiseResolve = null;
  initPromiseReject = null;
}

function rejectPendingEvaluations(error: Error) {
  for (const [requestId, pendingEvaluation] of pendingEvaluations) {
    window.clearTimeout(pendingEvaluation.timeoutId);
    pendingEvaluation.reject(error);
    pendingEvaluations.delete(requestId);
  }
}

function clearWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

function handleWorkerFailure(message: string, options?: { restart: boolean }) {
  const error = new Error(message);
  clearWorker();
  initStarted = false;
  rejectInitPromise(error);
  rejectPendingEvaluations(error);
  setInitStatus("error", error);

  if (options?.restart) {
    queueMicrotask(() => {
      void initEngine().catch(() => {
        // The UI already gets status/error updates through the shared state.
      });
    });
  }
}

function handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
  switch (event.data.type) {
    case "status": {
      if (event.data.status === "ready") {
        setInitStatus("ready");
        resolveInitPromise();
        return;
      }

      if (event.data.status === "error") {
        handleWorkerFailure(
          event.data.message ??
            "Failed to load expression engine. Please refresh.",
        );
        return;
      }

      setInitStatus(event.data.status);
      return;
    }
    case "evaluate-success": {
      const pendingEvaluation = pendingEvaluations.get(event.data.requestId);
      if (!pendingEvaluation) {
        return;
      }

      window.clearTimeout(pendingEvaluation.timeoutId);

      try {
        performance.mark(`${pendingEvaluation.startedAtMark}:end`);
        performance.measure(
          `engine:evaluate:${event.data.requestId}`,
          pendingEvaluation.startedAtMark,
          `${pendingEvaluation.startedAtMark}:end`,
        );
      } catch {
        // Ignore repeated measurement collisions.
      }

      pendingEvaluations.delete(event.data.requestId);
      pendingEvaluation.resolve(event.data.output);
      return;
    }
    case "evaluate-error": {
      const pendingEvaluation = pendingEvaluations.get(event.data.requestId);
      if (!pendingEvaluation) {
        return;
      }

      window.clearTimeout(pendingEvaluation.timeoutId);
      pendingEvaluations.delete(event.data.requestId);
      pendingEvaluation.reject(new Error(event.data.message));
      return;
    }
  }
}

function createWorker(): Worker {
  const nextWorker = new Worker(
    new URL("./engine-worker.ts", import.meta.url),
    {
      name: "prabuddha-engine",
    },
  );

  nextWorker.addEventListener("message", handleWorkerMessage);
  nextWorker.addEventListener("error", () => {
    handleWorkerFailure(
      "The browser engine stopped unexpectedly. Please try again.",
      { restart: true },
    );
  });
  nextWorker.addEventListener("messageerror", () => {
    handleWorkerFailure(
      "The browser engine returned an invalid response. Please try again.",
      { restart: true },
    );
  });

  return nextWorker;
}

function ensureWorker(): Worker {
  if (worker) {
    return worker;
  }

  worker = createWorker();
  return worker;
}

function markInitStart() {
  performance.mark(ENGINE_INIT_START_MARK);
}

function startWorkerInit() {
  if (initStarted) {
    return;
  }

  initStarted = true;
  markInitStart();
  ensureWorker().postMessage({
    testDisableWebAssembly:
      window.__engineTestBootstrapOptions?.disableWebAssembly === true,
    type: "init",
  } satisfies WorkerRequest);
}

function mergeOptions(
  options?: Partial<EngineEvaluateOptions>,
): EngineEvaluateOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

export function subscribeToEngineInit(listener: InitListener): () => void {
  initListeners.add(listener);
  listener(initStatus);

  return () => {
    initListeners.delete(listener);
  };
}

export function getEngineInitError(): string | null {
  return initError?.message ?? null;
}

export async function initEngine(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error(
      "The browser engine can only be initialized in the browser.",
    );
  }

  if (initStatus === "ready") {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise<void>((resolve, reject) => {
    initPromiseResolve = resolve;
    initPromiseReject = reject;
  });

  startWorkerInit();

  return initPromise;
}

export async function evaluate(
  input: string,
  expression: string,
  inputFormat: InputFormat,
  outputFormat: OutputFormat,
  options?: Partial<EngineEvaluateOptions>,
): Promise<string> {
  await initEngine();

  const activeWorker = ensureWorker();
  const requestId = ++nextRequestId;
  const startedAtMark = `engine:evaluate:${requestId}:start`;
  performance.mark(startedAtMark);

  return new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingEvaluations.delete(requestId);
      handleWorkerFailure(
        "The browser engine is restarting after a timed out evaluation.",
        { restart: true },
      );
      reject(
        new Error(
          `Evaluation timed out after ${EVALUATION_TIMEOUT_MS / 1000}s.`,
        ),
      );
    }, EVALUATION_TIMEOUT_MS);

    pendingEvaluations.set(requestId, {
      reject,
      resolve,
      startedAtMark,
      timeoutId,
    });

    activeWorker.postMessage({
      payload: {
        expression,
        input,
        inputFormat,
        options: mergeOptions(options),
        outputFormat,
      },
      requestId,
      type: "evaluate",
    } satisfies WorkerRequest);
  });
}

export async function panicNextEvaluationForTest(): Promise<void> {
  await initEngine();
  ensureWorker().postMessage({
    type: "test-panic-next-evaluation",
  } satisfies WorkerRequest);
}

export async function delayNextEvaluationForTest(
  delayMs: number,
): Promise<void> {
  await initEngine();
  ensureWorker().postMessage({
    delayMs,
    type: "test-delay-next-evaluation",
  } satisfies WorkerRequest);
}

function registerTestControls() {
  if (typeof window === "undefined") {
    return;
  }

  const benchmarkMode = new URLSearchParams(window.location.search).has(
    "__bench",
  );
  if (process.env.NODE_ENV === "production" && !benchmarkMode) {
    return;
  }

  window.__engineTestControls = {
    delayNextEvaluation: delayNextEvaluationForTest,
    evaluateDirect: async (request) =>
      evaluate(
        request.input,
        request.expression,
        request.inputFormat,
        request.outputFormat,
        request.options,
      ),
    panicNextEvaluation: panicNextEvaluationForTest,
  };
}

if (typeof window !== "undefined") {
  registerTestControls();
  queueMicrotask(() => {
    void initEngine().catch((error: unknown) => {
      const normalizedError = normalizeEngineError(error);
      setInitStatus("error", normalizedError);
    });
  });
}
