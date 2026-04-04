export type OutputFormat = "yaml" | "json" | "xml" | "csv" | "toml" | "props";
export type InputFormat = Exclude<OutputFormat, "props">;
export type YqInitStatus =
  | "idle"
  | "loading-runtime"
  | "fetching-wasm"
  | "instantiating-wasm"
  | "starting-go"
  | "ready"
  | "error";

export type YqEvaluateOptions = {
  noDoc: boolean;
  prettyPrint: boolean;
  unwrapScalar: boolean;
};

type GoRuntime = {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
};

type InitListener = (status: YqInitStatus) => void;

const EVALUATION_TIMEOUT_MS = 8_000;
const EVALUATOR_REGISTRATION_TIMEOUT_MS = 15_000;
const DEFAULT_OPTIONS: YqEvaluateOptions = {
  noDoc: false,
  prettyPrint: false,
  unwrapScalar: true,
};

declare global {
  interface Window {
    Go?: new () => GoRuntime;
    yqEvaluate?: (
      input: string,
      expression: string,
      inputFormat: InputFormat,
      outputFormat: OutputFormat,
    ) => string;
    yqEvaluateWithOptions?: (
      input: string,
      expression: string,
      inputFormat: InputFormat,
      outputFormat: OutputFormat,
      options?: Partial<YqEvaluateOptions>,
    ) => string;
  }
}

let initPromise: Promise<void> | null = null;
let initStatus: YqInitStatus = "idle";
const initListeners = new Set<InitListener>();

function setInitStatus(nextStatus: YqInitStatus) {
  initStatus = nextStatus;
  for (const listener of initListeners) {
    listener(nextStatus);
  }
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown yq WASM error.");
}

function toFriendlyErrorMessage(rawMessage: string, inputFormat: InputFormat): string {
  const message = rawMessage.replace(/^Error:\s*/u, "").trim();
  const firstLine = message.split(/\r?\n/u)[0]?.trim() ?? "Unknown yq error.";
  const normalized = firstLine.toLowerCase();

  if (normalized.includes("execution timed out")) {
    return "Execution timed out after 8 seconds. Try a smaller input or a narrower expression.";
  }

  if (normalized.includes("expression is required")) {
    return "Expression is required. Enter a yq expression before running.";
  }

  if (normalized.includes("input is required")) {
    return "Input is required. Paste a document before running yq.";
  }

  if (normalized.includes("unsupported input format")) {
    return `Unsupported input format. Choose one of yaml, json, xml, csv, or toml. Details: ${firstLine}`;
  }

  if (normalized.includes("unsupported output format")) {
    return `Unsupported output format. Choose one of yaml, json, xml, csv, toml, or props. Details: ${firstLine}`;
  }

  if (
    normalized.includes("bad expression") ||
    normalized.includes("lexer error") ||
    normalized.includes("parse expression") ||
    normalized.includes("unexpected token")
  ) {
    return `The yq expression could not be parsed. ${firstLine}`;
  }

  if (
    normalized.includes("invalid character") ||
    normalized.includes("did not find expected") ||
    normalized.includes("cannot decode") ||
    normalized.includes("xml syntax error") ||
    normalized.includes("toml") ||
    normalized.includes("csv") ||
    normalized.includes("yaml") ||
    normalized.includes("json")
  ) {
    return `The ${inputFormat.toUpperCase()} input could not be parsed. ${firstLine}`;
  }

  return firstLine;
}

function resolveAssetPath(fileName: string): string {
  return `./${fileName}`;
}

function mergedOptions(
  options?: Partial<YqEvaluateOptions>,
): YqEvaluateOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

export function subscribeToYqInit(listener: InitListener): () => void {
  initListeners.add(listener);
  listener(initStatus);

  return () => {
    initListeners.delete(listener);
  };
}

async function ensureRuntimeScript(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("yq can only be initialized in the browser.");
  }

  if (window.Go) {
    return;
  }

  setInitStatus("loading-runtime");

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-yq-wasm-exec="true"]',
  );
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      if (window.Go) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load wasm_exec.js.")),
        { once: true },
      );
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = resolveAssetPath("wasm_exec.js");
    script.async = true;
    script.dataset.yqWasmExec = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load wasm_exec.js."));
    document.head.appendChild(script);
  });
}

async function instantiateModule(
  importObject: WebAssembly.Imports,
): Promise<WebAssembly.Instance> {
  const url = resolveAssetPath("yq.wasm");
  setInitStatus("fetching-wasm");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch yq.wasm (${response.status}).`);
  }

  setInitStatus("instantiating-wasm");

  if ("instantiateStreaming" in WebAssembly) {
    try {
      const streamingResult = await WebAssembly.instantiateStreaming(
        response,
        importObject,
      );
      return streamingResult.instance;
    } catch {
      // Fall back when the host does not provide the expected mime type.
    }
  }

  const buffer = await response.arrayBuffer();
  const fallbackResult = await WebAssembly.instantiate(buffer, importObject);
  return fallbackResult.instance;
}

async function waitForEvaluator(
  timeoutMs: number = EVALUATOR_REGISTRATION_TIMEOUT_MS,
): Promise<void> {
  const startedAt = performance.now();

  while (typeof window.yqEvaluate !== "function") {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for yq WASM to register.");
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
  }
}

export async function initYq(): Promise<void> {
  if (
    typeof window !== "undefined" &&
    typeof window.yqEvaluate === "function"
  ) {
    setInitStatus("ready");
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await ensureRuntimeScript();

    if (!window.Go) {
      throw new Error("wasm_exec.js loaded without exposing the Go runtime.");
    }

    if (typeof window.yqEvaluate === "function") {
      setInitStatus("ready");
      return;
    }

    setInitStatus("starting-go");
    const go = new window.Go();
    const instance = await instantiateModule(go.importObject);
    const runPromise = go.run(instance).catch((error: unknown) => {
      throw normalizeError(error);
    });

    await Promise.race([
      waitForEvaluator(),
      runPromise.then(() => {
        throw new Error("yq WASM exited before initialization completed.");
      }),
    ]);

    setInitStatus("ready");
  })().catch((error: unknown) => {
    initPromise = null;
    setInitStatus("error");
    throw normalizeError(error);
  });

  return initPromise;
}

export async function evaluate(
  input: string,
  expression: string,
  inputFormat: InputFormat,
  outputFormat: OutputFormat,
  options?: Partial<YqEvaluateOptions>,
): Promise<string> {
  await initYq();

  if (
    typeof window.yqEvaluate !== "function" &&
    typeof window.yqEvaluateWithOptions !== "function"
  ) {
    throw new Error("yq WASM is not ready yet.");
  }

  const startedAt = performance.now();
  const resolvedOptions = mergedOptions(options);

  try {
    const result =
      typeof window.yqEvaluateWithOptions === "function"
        ? window.yqEvaluateWithOptions(
            input,
            expression,
            inputFormat,
            outputFormat,
            resolvedOptions,
          )
        : window.yqEvaluate!(
            input,
            expression,
            inputFormat,
            outputFormat,
          );

    if (performance.now() - startedAt > EVALUATION_TIMEOUT_MS) {
      throw new Error("Execution timed out");
    }

    return result;
  } catch (error: unknown) {
    const normalizedError = normalizeError(error);

    if (performance.now() - startedAt > EVALUATION_TIMEOUT_MS) {
      throw new Error(
        toFriendlyErrorMessage("Execution timed out", inputFormat),
      );
    }

    throw new Error(
      toFriendlyErrorMessage(normalizedError.message, inputFormat),
    );
  }
}
