export const INPUT_FORMATS = ["yaml", "json", "xml", "csv", "toml"] as const;
export const OUTPUT_FORMATS = [
  "yaml",
  "json",
  "xml",
  "csv",
  "toml",
  "props",
] as const;

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

export type EngineEvaluateOptions = {
  noDoc: boolean;
  prettyPrint: boolean;
  unwrapScalar: boolean;
};

export const ENGINE_STATUS_LABELS: Record<EngineInitStatus, string> = {
  idle: "Waiting to initialize the WASM runtime.",
  "loading-runtime": "Loading the Go WebAssembly runtime.",
  "fetching-wasm": "Fetching the browser engine binary.",
  "instantiating-wasm": "Instantiating the WebAssembly module.",
  "starting-go": "Starting the Go runtime and registering the engine.",
  ready: "The in-browser engine is ready.",
  error: "The browser engine failed to initialize.",
};
