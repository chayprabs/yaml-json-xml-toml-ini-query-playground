export const ENGINE_TYPES = ["yq", "dasel"] as const;

export const INPUT_FORMATS = [
  "yaml",
  "json",
  "xml",
  "csv",
  "toml",
  "ini",
  "hcl",
] as const;

export const OUTPUT_FORMATS = [
  "yaml",
  "json",
  "xml",
  "csv",
  "toml",
  "props",
  "ini",
  "hcl",
] as const;

export type EngineType = (typeof ENGINE_TYPES)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type InputFormat = (typeof INPUT_FORMATS)[number];
export type EngineInitStatus =
  | "idle"
  | "loading-runtime"
  | "fetching-wasm"
  | "instantiating-wasm"
  | "starting-go"
  | "ready"
  | "error";
export type EngineOverallInitStatus = "idle" | "loading" | "ready" | "error";

export type EngineEvaluateOptions = {
  __debugPanic?: boolean;
  noDoc?: boolean;
  prettyPrint?: boolean;
  readFlags?: Record<string, string>;
  returnRoot?: boolean;
  unstable?: boolean;
  unwrapScalar?: boolean;
  variables?: Record<string, string>;
  writeFlags?: Record<string, string>;
};

export type EngineInitSnapshot = {
  engines: Record<
    EngineType,
    {
      error: string | null;
      status: EngineInitStatus;
    }
  >;
  overallStatus: EngineOverallInitStatus;
};

export const ENGINE_INPUT_FORMATS: Record<EngineType, readonly InputFormat[]> =
  {
    yq: ["yaml", "json", "xml", "csv", "toml"],
    dasel: ["yaml", "json", "xml", "csv", "toml", "ini", "hcl"],
  };

export const ENGINE_OUTPUT_FORMATS: Record<
  EngineType,
  readonly OutputFormat[]
> = {
  yq: ["yaml", "json", "xml", "csv", "toml", "props"],
  dasel: ["yaml", "json", "xml", "csv", "toml", "ini", "hcl"],
};

export const ENGINE_DISPLAY_NAMES: Record<EngineType, string> = {
  yq: "Expression",
  dasel: "Selector",
};

export const ENGINE_STATUS_LABELS: Record<EngineInitStatus, string> = {
  idle: "Not loaded",
  "loading-runtime": "Loading",
  "fetching-wasm": "Loading",
  "instantiating-wasm": "Loading",
  "starting-go": "Loading",
  ready: "Ready",
  error: "Error",
};

export const ENGINE_OVERALL_STATUS_LABELS: Record<
  EngineOverallInitStatus,
  string
> = {
  idle: "Idle",
  loading: "Loading…",
  ready: "Ready",
  error: "Engine error",
};

export function isInputFormat(value: unknown): value is InputFormat {
  return (
    typeof value === "string" && INPUT_FORMATS.includes(value as InputFormat)
  );
}

export function isOutputFormat(value: unknown): value is OutputFormat {
  return (
    typeof value === "string" && OUTPUT_FORMATS.includes(value as OutputFormat)
  );
}

export function isEngineType(value: unknown): value is EngineType {
  return (
    typeof value === "string" && ENGINE_TYPES.includes(value as EngineType)
  );
}

export function supportsInputFormat(
  engine: EngineType,
  format: InputFormat,
): boolean {
  return ENGINE_INPUT_FORMATS[engine].includes(format);
}

export function supportsOutputFormat(
  engine: EngineType,
  format: OutputFormat,
): boolean {
  return ENGINE_OUTPUT_FORMATS[engine].includes(format);
}
