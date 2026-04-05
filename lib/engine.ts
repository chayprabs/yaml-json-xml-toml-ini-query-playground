import { normalizeEngineError } from "@/lib/engine-errors";
import {
  ENGINE_RUNTIME_CONFIG,
  mergeEngineEvaluateOptions,
} from "@/lib/engine-registry";
import {
  ENGINE_OVERALL_STATUS_LABELS,
  ENGINE_TYPES,
  type EngineEvaluateOptions,
  type EngineInitSnapshot,
  type EngineInitStatus,
  type EngineType,
  type InputFormat,
  type OutputFormat,
} from "@/lib/engine-types";

export type {
  EngineEvaluateOptions,
  EngineInitSnapshot,
  EngineInitStatus,
  EngineType,
  InputFormat,
  OutputFormat,
} from "@/lib/engine-types";

type InitListener = (snapshot: EngineInitSnapshot) => void;

type WorkerInitMessage = {
  engine: EngineType;
  testDisableWebAssembly?: boolean;
  type: "init";
};

type WorkerEvaluateMessage = {
  payload: {
    expression: string;
    input: string;
    inputFormat: InputFormat;
    options: EngineEvaluateOptions;
    outputFormat: OutputFormat;
  };
  requestId: number;
  type: "evaluate";
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
  message?: string;
  status: EngineInitStatus;
  type: "status";
};

type WorkerEvaluateSuccessMessage = {
  output: string;
  requestId: number;
  type: "evaluate-success";
};

type WorkerEvaluateErrorMessage = {
  message: string;
  requestId: number;
  type: "evaluate-error";
};

type WorkerResponse =
  | WorkerEvaluateErrorMessage
  | WorkerEvaluateSuccessMessage
  | WorkerStatusMessage;

type PendingEvaluation = {
  reject: (reason?: unknown) => void;
  resolve: (value: string) => void;
  startedAtMark: string;
  timeoutId: ReturnType<typeof globalThis.setTimeout>;
};

type ManagedEngineState = {
  error: Error | null;
  initPromise: Promise<void> | null;
  initPromiseReject: ((error: Error) => void) | null;
  initPromiseResolve: (() => void) | null;
  initStarted: boolean;
  nextRequestId: number;
  pendingEvaluations: Map<number, PendingEvaluation>;
  status: EngineInitStatus;
  worker: Worker | null;
};

const EVALUATION_TIMEOUT_MS = 8_000;
const COMBINED_INIT_START_MARK = "engine:init:start";
const COMBINED_INIT_READY_MARK = "engine:init:ready";
const COMBINED_INIT_MEASURE = "engine:init";

declare global {
  interface Window {
    __engineTestBootstrapOptions?: {
      disableWebAssembly?: boolean;
    };
    __engineTestControls?: {
      delayNextEvaluation: (
        delayMs: number,
        engine?: EngineType,
      ) => Promise<void>;
      evaluateDirect: (request: {
        engine?: EngineType;
        expression: string;
        input: string;
        inputFormat: InputFormat;
        options?: Partial<EngineEvaluateOptions>;
        outputFormat: OutputFormat;
      }) => Promise<string>;
      panicNextEvaluation: (engine?: EngineType) => Promise<void>;
    };
  }
}

const initListeners = new Set<InitListener>();
const engineStates = Object.fromEntries(
  ENGINE_TYPES.map((engine) => [
    engine,
    {
      error: null,
      initPromise: null,
      initPromiseReject: null,
      initPromiseResolve: null,
      initStarted: false,
      nextRequestId: 0,
      pendingEvaluations: new Map<number, PendingEvaluation>(),
      status: "idle" as EngineInitStatus,
      worker: null,
    } satisfies ManagedEngineState,
  ]),
) as Record<EngineType, ManagedEngineState>;

let initAllPromise: Promise<void> | null = null;

function buildSnapshot(): EngineInitSnapshot {
  const engines = Object.fromEntries(
    ENGINE_TYPES.map((engine) => [
      engine,
      {
        error: engineStates[engine].error?.message ?? null,
        status: engineStates[engine].status,
      },
    ]),
  ) as EngineInitSnapshot["engines"];

  const statuses = ENGINE_TYPES.map((engine) => engineStates[engine].status);
  const overallStatus = statuses.some((status) => status === "error")
    ? "error"
    : statuses.every((status) => status === "ready")
      ? "ready"
      : statuses.every((status) => status === "idle")
        ? "idle"
        : "loading";

  return {
    engines,
    overallStatus,
  };
}

function notifyInitListeners() {
  const snapshot = buildSnapshot();

  for (const listener of initListeners) {
    listener(snapshot);
  }
}

function clearCombinedInitPromise() {
  initAllPromise = null;
}

function setEngineStatus(
  engine: EngineType,
  nextStatus: EngineInitStatus,
  error?: Error,
) {
  const state = engineStates[engine];
  state.status = nextStatus;

  if (nextStatus !== "error") {
    state.error = null;
  }

  if (nextStatus === "ready") {
    try {
      performance.mark(`engine:init:${engine}:ready`);
    } catch {
      // Ignore repeated mark collisions from worker restarts.
    }

    if (ENGINE_TYPES.every((kind) => engineStates[kind].status === "ready")) {
      try {
        performance.mark(COMBINED_INIT_READY_MARK);
        performance.measure(
          COMBINED_INIT_MEASURE,
          COMBINED_INIT_START_MARK,
          COMBINED_INIT_READY_MARK,
        );
      } catch {
        // Ignore repeated mark collisions from worker restarts.
      }
    }
  }

  if (nextStatus === "error") {
    state.error = error ?? new Error(ENGINE_OVERALL_STATUS_LABELS.error);
  }

  notifyInitListeners();
}

function resolveEngineInitPromise(engine: EngineType) {
  const state = engineStates[engine];
  state.initPromiseResolve?.();
  state.initPromise = Promise.resolve();
  state.initPromiseResolve = null;
  state.initPromiseReject = null;
}

function rejectEngineInitPromise(engine: EngineType, error: Error) {
  const state = engineStates[engine];
  state.initPromiseReject?.(error);
  state.initPromise = null;
  state.initPromiseResolve = null;
  state.initPromiseReject = null;
}

function rejectPendingEvaluations(engine: EngineType, error: Error) {
  const state = engineStates[engine];

  for (const [requestId, pendingEvaluation] of state.pendingEvaluations) {
    globalThis.clearTimeout(pendingEvaluation.timeoutId);
    pendingEvaluation.reject(error);
    state.pendingEvaluations.delete(requestId);
  }
}

function clearWorker(engine: EngineType) {
  const state = engineStates[engine];
  if (state.worker) {
    state.worker.terminate();
    state.worker = null;
  }
}

function handleWorkerFailure(
  engine: EngineType,
  message: string,
  options?: { restart: boolean },
) {
  const error = new Error(message);
  const state = engineStates[engine];

  clearWorker(engine);
  state.initStarted = false;
  rejectEngineInitPromise(engine, error);
  rejectPendingEvaluations(engine, error);
  clearCombinedInitPromise();
  setEngineStatus(engine, "error", error);

  if (options?.restart) {
    queueMicrotask(() => {
      void initEngine(engine).catch(() => {
        // The UI gets status and error updates via subscribeToEngineInit.
      });
    });
  }
}

function handleWorkerMessage(
  engine: EngineType,
  event: MessageEvent<WorkerResponse>,
) {
  const state = engineStates[engine];

  switch (event.data.type) {
    case "status": {
      if (event.data.status === "ready") {
        setEngineStatus(engine, "ready");
        resolveEngineInitPromise(engine);
        return;
      }

      if (event.data.status === "error") {
        handleWorkerFailure(
          engine,
          event.data.message ??
            "Failed to load expression engine. Please refresh.",
        );
        return;
      }

      setEngineStatus(engine, event.data.status);
      return;
    }
    case "evaluate-success": {
      const pendingEvaluation = state.pendingEvaluations.get(
        event.data.requestId,
      );
      if (!pendingEvaluation) {
        return;
      }

      globalThis.clearTimeout(pendingEvaluation.timeoutId);

      try {
        performance.mark(`${pendingEvaluation.startedAtMark}:end`);
        performance.measure(
          `engine:evaluate:${engine}:${event.data.requestId}`,
          pendingEvaluation.startedAtMark,
          `${pendingEvaluation.startedAtMark}:end`,
        );
      } catch {
        // Ignore repeated measurement collisions.
      }

      state.pendingEvaluations.delete(event.data.requestId);
      pendingEvaluation.resolve(event.data.output);
      return;
    }
    case "evaluate-error": {
      const pendingEvaluation = state.pendingEvaluations.get(
        event.data.requestId,
      );
      if (!pendingEvaluation) {
        return;
      }

      globalThis.clearTimeout(pendingEvaluation.timeoutId);
      state.pendingEvaluations.delete(event.data.requestId);
      pendingEvaluation.reject(new Error(event.data.message));
      return;
    }
  }
}

function createWorker(engine: EngineType): Worker {
  const nextWorker = new Worker(
    new URL("./engine-worker.ts", import.meta.url),
    {
      name: `pluck-engine-${engine}`,
    },
  );

  nextWorker.addEventListener(
    "message",
    (event: MessageEvent<WorkerResponse>) => {
      handleWorkerMessage(engine, event);
    },
  );
  nextWorker.addEventListener("error", () => {
    handleWorkerFailure(
      engine,
      "The browser engine stopped unexpectedly. Please try again.",
      { restart: true },
    );
  });
  nextWorker.addEventListener("messageerror", () => {
    handleWorkerFailure(
      engine,
      "The browser engine returned an invalid response. Please try again.",
      { restart: true },
    );
  });

  return nextWorker;
}

function ensureWorker(engine: EngineType): Worker {
  const state = engineStates[engine];
  if (state.worker) {
    return state.worker;
  }

  state.worker = createWorker(engine);
  return state.worker;
}

function markCombinedInitStart() {
  try {
    performance.mark(COMBINED_INIT_START_MARK);
  } catch {
    // Ignore repeated mark collisions from retries.
  }
}

function startWorkerInit(engine: EngineType) {
  const state = engineStates[engine];
  if (state.initStarted) {
    return;
  }

  state.initStarted = true;

  try {
    performance.mark(`engine:init:${engine}:start`);
  } catch {
    // Ignore repeated mark collisions from retries.
  }

  ensureWorker(engine).postMessage({
    engine,
    testDisableWebAssembly:
      typeof window !== "undefined" &&
      window.__engineTestBootstrapOptions?.disableWebAssembly === true,
    type: "init",
  } satisfies WorkerRequest);
}

function initEngineFor(engine: EngineType): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error(
      "The browser engine can only be initialized in the browser.",
    );
  }

  const state = engineStates[engine];

  if (state.status === "ready") {
    return Promise.resolve();
  }

  if (state.initPromise) {
    return state.initPromise;
  }

  state.initPromise = new Promise<void>((resolve, reject) => {
    state.initPromiseResolve = resolve;
    state.initPromiseReject = reject;
  });

  startWorkerInit(engine);
  return state.initPromise;
}

export function subscribeToEngineInit(listener: InitListener): () => void {
  initListeners.add(listener);
  listener(buildSnapshot());

  return () => {
    initListeners.delete(listener);
  };
}

export function getEngineInitSnapshot(): EngineInitSnapshot {
  return buildSnapshot();
}

export function getEngineInitError(engine?: EngineType): string | null {
  if (engine) {
    return engineStates[engine].error?.message ?? null;
  }

  for (const kind of ENGINE_TYPES) {
    const message = engineStates[kind].error?.message;
    if (message) {
      return message;
    }
  }

  return null;
}

export async function initEngine(engine?: EngineType): Promise<void> {
  if (engine) {
    return initEngineFor(engine);
  }

  if (initAllPromise) {
    return initAllPromise;
  }

  if (typeof window === "undefined") {
    throw new Error(
      "The browser engine can only be initialized in the browser.",
    );
  }

  markCombinedInitStart();
  initAllPromise = Promise.allSettled(
    ENGINE_TYPES.map((kind) => initEngineFor(kind)),
  ).then(() => undefined);

  return initAllPromise;
}

export async function evaluate(
  input: string,
  expression: string,
  inputFormat: InputFormat,
  outputFormat: OutputFormat,
  engine: EngineType,
  options?: Partial<EngineEvaluateOptions>,
): Promise<string> {
  await initEngine(engine);

  const state = engineStates[engine];
  const activeWorker = ensureWorker(engine);
  const requestId = ++state.nextRequestId;
  const startedAtMark = `engine:evaluate:${engine}:${requestId}:start`;
  performance.mark(startedAtMark);

  return new Promise<string>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      state.pendingEvaluations.delete(requestId);
      handleWorkerFailure(
        engine,
        "The browser engine is restarting after a timed out evaluation.",
        { restart: true },
      );
      reject(
        new Error(
          `Evaluation timed out after ${EVALUATION_TIMEOUT_MS / 1000}s.`,
        ),
      );
    }, EVALUATION_TIMEOUT_MS);

    state.pendingEvaluations.set(requestId, {
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
        options: mergeEngineEvaluateOptions(engine, options),
        outputFormat,
      },
      requestId,
      type: "evaluate",
    } satisfies WorkerRequest);
  });
}

export async function panicNextEvaluationForTest(
  engine: EngineType = "yq",
): Promise<void> {
  await initEngine(engine);
  ensureWorker(engine).postMessage({
    type: "test-panic-next-evaluation",
  } satisfies WorkerRequest);
}

export async function delayNextEvaluationForTest(
  delayMs: number,
  engine: EngineType = "yq",
): Promise<void> {
  await initEngine(engine);
  ensureWorker(engine).postMessage({
    delayMs,
    type: "test-delay-next-evaluation",
  } satisfies WorkerRequest);
}

export function __resetEngineStateForTest() {
  clearCombinedInitPromise();

  for (const engine of ENGINE_TYPES) {
    clearWorker(engine);
    engineStates[engine].error = null;
    engineStates[engine].initPromise = null;
    engineStates[engine].initPromiseReject = null;
    engineStates[engine].initPromiseResolve = null;
    engineStates[engine].initStarted = false;
    engineStates[engine].nextRequestId = 0;
    rejectPendingEvaluations(engine, new Error("Engine reset for test."));
    engineStates[engine].pendingEvaluations.clear();
    engineStates[engine].status = "idle";
  }

  notifyInitListeners();
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
    delayNextEvaluation: (delayMs, engine = "yq") =>
      delayNextEvaluationForTest(delayMs, engine),
    evaluateDirect: async (request) =>
      evaluate(
        request.input,
        request.expression,
        request.inputFormat,
        request.outputFormat,
        request.engine ?? "yq",
        request.options,
      ),
    panicNextEvaluation: (engine = "yq") => panicNextEvaluationForTest(engine),
  };
}

if (typeof window !== "undefined" && typeof Worker !== "undefined") {
  registerTestControls();
  queueMicrotask(() => {
    void initEngine().catch((error: unknown) => {
      const normalizedError = normalizeEngineError(error);
      for (const engine of ENGINE_TYPES) {
        if (engineStates[engine].status !== "error") {
          setEngineStatus(engine, "error", normalizedError);
        }
      }
    });
  });
}
