/// <reference lib="webworker" />

import { getAssetPath } from "@/lib/asset-path";
import {
  normalizeEngineError,
  toFriendlyEvaluationErrorMessage,
} from "@/lib/engine-errors";
import { ENGINE_RUNTIME_CONFIG } from "@/lib/engine-registry";
import type {
  EngineEvaluateOptions,
  EngineInitStatus,
  EngineType,
  InputFormat,
  OutputFormat,
} from "@/lib/engine-types";

type GoRuntime = {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
};

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

type WorkerEvaluateFn = (
  input: string,
  expression: string,
  inputFormat: InputFormat,
  outputFormat: OutputFormat,
  options?: Partial<EngineEvaluateOptions>,
) => string;

declare global {
  interface WorkerGlobalScope {
    Go?: new () => GoRuntime;
    daselEvaluateWithOptions?: WorkerEvaluateFn;
    yqEvaluateWithOptions?: WorkerEvaluateFn;
  }
}

const globalScope = self as DedicatedWorkerGlobalScope;

const REGISTRATION_TIMEOUT_MS = 15_000;

let activeEngine: EngineType | null = null;
let disableWebAssemblyForTest = false;
let initPromise: Promise<void> | null = null;
let nextEvaluationDelayMs = 0;
let panicNextEvaluation = false;

function postMessageToMainThread(message: WorkerResponse) {
  globalScope.postMessage(message);
}

function setInitStatus(status: EngineInitStatus, message?: string) {
  postMessageToMainThread({
    type: "status",
    ...(message ? { message } : {}),
    status,
  });
}

function getEngineConfig() {
  if (!activeEngine) {
    throw new Error("No engine has been selected for this worker.");
  }

  return ENGINE_RUNTIME_CONFIG[activeEngine];
}

function getEvaluator(): WorkerEvaluateFn | null {
  if (!activeEngine) {
    return null;
  }

  const evaluatorName = getEngineConfig().evaluateWithOptionsGlobal;
  const candidate = globalScope[evaluatorName];
  return typeof candidate === "function" ? candidate : null;
}

async function ensureRuntimeScript(): Promise<void> {
  if (globalScope.Go) {
    return;
  }

  setInitStatus("loading-runtime");

  try {
    globalScope.importScripts(getAssetPath("wasm_exec.js"));
  } catch {
    throw new Error("Failed to load the WebAssembly runtime. Please refresh.");
  }

  if (!globalScope.Go) {
    throw new Error("Failed to load the WebAssembly runtime. Please refresh.");
  }
}

async function instantiateModule(
  importObject: WebAssembly.Imports,
): Promise<WebAssembly.Instance> {
  if (disableWebAssemblyForTest || typeof WebAssembly === "undefined") {
    throw new Error(
      "WebAssembly is not supported in this browser. Please use a current version of Chrome, Firefox, or Safari.",
    );
  }

  const { wasmFileName, wasmGzipFileName } = getEngineConfig();
  setInitStatus("fetching-wasm");

  async function fetchRawWasm() {
    const rawResponse = await fetch(getAssetPath(wasmFileName), {
      cache: "force-cache",
    });
    if (!rawResponse.ok) {
      throw new Error("Failed to load expression engine. Please refresh.");
    }

    return rawResponse;
  }

  async function fetchCompressedWasm() {
    if (
      typeof DecompressionStream === "undefined" ||
      typeof Response === "undefined"
    ) {
      return null;
    }

    try {
      const compressedResponse = await fetch(getAssetPath(wasmGzipFileName), {
        cache: "force-cache",
      });
      if (!compressedResponse.ok || !compressedResponse.body) {
        return null;
      }

      const contentType = compressedResponse.headers
        .get("content-type")
        ?.toLowerCase();
      if (
        contentType &&
        !contentType.includes("gzip") &&
        !contentType.includes("octet-stream")
      ) {
        return null;
      }

      const decompressedStream = compressedResponse.body.pipeThrough(
        new DecompressionStream("gzip"),
      );
      return new Response(decompressedStream, {
        headers: {
          "Content-Type": "application/wasm",
        },
      });
    } catch {
      return null;
    }
  }

  let response: Response;
  try {
    response = (await fetchCompressedWasm()) ?? (await fetchRawWasm());
  } catch {
    throw new Error("Failed to load expression engine. Please refresh.");
  }

  setInitStatus("instantiating-wasm");

  if ("instantiateStreaming" in WebAssembly) {
    try {
      const streamingResult = await WebAssembly.instantiateStreaming(
        response.clone(),
        importObject,
      );
      return streamingResult.instance;
    } catch {
      // Fall back when streaming compilation is unavailable or the content type
      // is not application/wasm.
    }
  }

  try {
    const buffer = await response.arrayBuffer();
    const fallbackResult = await WebAssembly.instantiate(buffer, importObject);
    return fallbackResult.instance;
  } catch {
    throw new Error(
      "Failed to start the expression engine. Your browser may not support this WebAssembly build.",
    );
  }
}

async function waitForEvaluator(
  timeoutMs: number = REGISTRATION_TIMEOUT_MS,
): Promise<void> {
  const startedAt = performance.now();

  while (!getEvaluator()) {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error("Failed to start the expression engine. Please refresh.");
    }

    await new Promise<void>((resolve) => globalScope.setTimeout(resolve, 16));
  }
}

async function initEngine(): Promise<void> {
  if (getEvaluator()) {
    setInitStatus("ready");
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await ensureRuntimeScript();

    if (!globalScope.Go) {
      throw new Error(
        "Failed to load the WebAssembly runtime. Please refresh.",
      );
    }

    const go = new globalScope.Go();
    const instance = await instantiateModule(go.importObject);
    setInitStatus("starting-go");

    const runPromise = go.run(instance).catch((error: unknown) => {
      throw normalizeEngineError(error);
    });

    await Promise.race([
      waitForEvaluator(),
      runPromise.then(() => {
        throw new Error(
          "Failed to start the expression engine. Please refresh.",
        );
      }),
    ]);

    setInitStatus("ready");
  })().catch((error: unknown) => {
    initPromise = null;
    const normalizedError = normalizeEngineError(error);
    setInitStatus("error", normalizedError.message);
    throw normalizedError;
  });

  return initPromise;
}

function handleEvaluateMessage(message: WorkerEvaluateMessage) {
  void (async () => {
    try {
      await initEngine();

      const evaluator = getEvaluator();
      if (!evaluator || !activeEngine) {
        throw new Error("The browser engine is not ready yet.");
      }

      if (nextEvaluationDelayMs > 0) {
        await new Promise<void>((resolve) =>
          globalScope.setTimeout(resolve, nextEvaluationDelayMs),
        );
      }

      const output = evaluator(
        message.payload.input,
        message.payload.expression,
        message.payload.inputFormat,
        message.payload.outputFormat,
        panicNextEvaluation
          ? {
              ...message.payload.options,
              __debugPanic: true,
            }
          : message.payload.options,
      );

      postMessageToMainThread({
        output,
        requestId: message.requestId,
        type: "evaluate-success",
      });
    } catch (error: unknown) {
      const normalizedError = normalizeEngineError(error);
      postMessageToMainThread({
        message: toFriendlyEvaluationErrorMessage(
          normalizedError.message,
          message.payload.inputFormat,
          activeEngine ?? "yq",
        ),
        requestId: message.requestId,
        type: "evaluate-error",
      });
    } finally {
      nextEvaluationDelayMs = 0;
      panicNextEvaluation = false;
    }
  })();
}

globalScope.addEventListener(
  "message",
  (event: MessageEvent<WorkerRequest>) => {
    switch (event.data.type) {
      case "init":
        activeEngine = event.data.engine;
        disableWebAssemblyForTest = event.data.testDisableWebAssembly === true;
        void initEngine();
        break;
      case "evaluate":
        handleEvaluateMessage(event.data);
        break;
      case "test-panic-next-evaluation":
        panicNextEvaluation = true;
        break;
      case "test-delay-next-evaluation":
        nextEvaluationDelayMs = Math.max(0, event.data.delayMs);
        break;
    }
  },
);
