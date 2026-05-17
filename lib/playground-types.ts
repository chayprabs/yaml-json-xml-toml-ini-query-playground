import type { EngineType, InputFormat, OutputFormat } from "@/lib/engine-types";

export type PlaygroundState = {
  autoRun: boolean;
  engine: EngineType;
  expression: string;
  input: string;
  inputFormat: InputFormat;
  noDoc: boolean;
  outputFormat: OutputFormat;
  prettyPrint: boolean;
  readFlagsText: string;
  returnRoot: boolean;
  unstable: boolean;
  unwrapScalar: boolean;
  variablesText: string;
  writeFlagsText: string;
};

export type RunSnapshot = Omit<PlaygroundState, "autoRun">;
