import { type EngineEvaluateOptions, type EngineType } from "@/lib/engine-types";

export type EngineRuntimeConfig = {
  displayName: string;
  evaluateWithOptionsGlobal:
    | "daselEvaluateWithOptions"
    | "yqEvaluateWithOptions";
  wasmFileName: string;
  wasmGzipFileName: string;
};

export const ENGINE_RUNTIME_CONFIG: Record<EngineType, EngineRuntimeConfig> = {
  yq: {
    displayName: "yq",
    evaluateWithOptionsGlobal: "yqEvaluateWithOptions",
    wasmFileName: "engine-yq.wasm",
    wasmGzipFileName: "engine-yq.wasm.gz",
  },
  dasel: {
    displayName: "dasel",
    evaluateWithOptionsGlobal: "daselEvaluateWithOptions",
    wasmFileName: "engine-dasel.wasm",
    wasmGzipFileName: "engine-dasel.wasm.gz",
  },
};

export const DEFAULT_ENGINE_OPTIONS: Record<EngineType, EngineEvaluateOptions> =
  {
    yq: {
      noDoc: false,
      prettyPrint: false,
      unwrapScalar: true,
    },
    dasel: {
      readFlags: {},
      returnRoot: false,
      unstable: false,
      writeFlags: {},
    },
  };

export function mergeEngineEvaluateOptions(
  engine: EngineType,
  options?: Partial<EngineEvaluateOptions>,
): EngineEvaluateOptions {
  const defaults = DEFAULT_ENGINE_OPTIONS[engine];

  return {
    ...defaults,
    ...options,
    readFlags: {
      ...(defaults.readFlags ?? {}),
      ...(options?.readFlags ?? {}),
    },
    writeFlags: {
      ...(defaults.writeFlags ?? {}),
      ...(options?.writeFlags ?? {}),
    },
  };
}
