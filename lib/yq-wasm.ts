type Format = 'yaml' | 'json' | 'xml' | 'csv' | 'toml' | 'props';
type InputFormat = Exclude<Format, 'props'>;

type GoRuntime = {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
};

declare global {
  interface Window {
    Go?: new () => GoRuntime;
    yqEvaluate?: (
      input: string,
      expression: string,
      inputFormat: InputFormat,
      outputFormat: Format,
    ) => string;
  }
}

let initPromise: Promise<void> | null = null;

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('Unknown yq WASM error.');
}

function resolveAssetPath(fileName: string): string {
  return `./${fileName}`;
}

async function ensureRuntimeScript(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('yq can only be initialized in the browser.');
  }

  if (window.Go) {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-yq-wasm-exec="true"]');
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      if (window.Go) {
        resolve();
        return;
      }

      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load wasm_exec.js.')), {
        once: true,
      });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = resolveAssetPath('wasm_exec.js');
    script.async = true;
    script.dataset.yqWasmExec = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load wasm_exec.js.'));
    document.head.appendChild(script);
  });
}

async function instantiateModule(importObject: WebAssembly.Imports): Promise<WebAssembly.Instance> {
  const url = resolveAssetPath('yq.wasm');
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch yq.wasm (${response.status}).`);
  }

  if ('instantiateStreaming' in WebAssembly) {
    try {
      const streamingResult = await WebAssembly.instantiateStreaming(response, importObject);
      return streamingResult.instance;
    } catch {
      // Fall back when the dev server does not provide the expected mime type.
    }
  }

  const buffer = await response.arrayBuffer();
  const fallbackResult = await WebAssembly.instantiate(buffer, importObject);
  return fallbackResult.instance;
}

async function waitForEvaluator(timeoutMs: number = 15000): Promise<void> {
  const startedAt = performance.now();

  while (typeof window.yqEvaluate !== 'function') {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for yq WASM to register.');
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
  }
}

export async function initYq(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await ensureRuntimeScript();

    if (!window.Go) {
      throw new Error('wasm_exec.js loaded without exposing the Go runtime.');
    }

    if (typeof window.yqEvaluate === 'function') {
      return;
    }

    const go = new window.Go();
    const instance = await instantiateModule(go.importObject);
    const runPromise = go.run(instance).catch((error: unknown) => {
      throw normalizeError(error);
    });

    await Promise.race([
      waitForEvaluator(),
      runPromise.then(() => {
        throw new Error('yq WASM exited before initialization completed.');
      }),
    ]);
  })().catch((error: unknown) => {
    initPromise = null;
    throw normalizeError(error);
  });

  return initPromise;
}

export async function evaluate(
  input: string,
  expression: string,
  inputFormat: InputFormat,
  outputFormat: Format,
): Promise<string> {
  await initYq();

  if (typeof window.yqEvaluate !== 'function') {
    throw new Error('yq WASM is not ready yet.');
  }

  try {
    return window.yqEvaluate(input, expression, inputFormat, outputFormat);
  } catch (error: unknown) {
    throw normalizeError(error);
  }
}
