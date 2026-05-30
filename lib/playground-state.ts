import { getDefaultExample, getExamplesForEngine } from "@/lib/examples";
import {
  isEngineType,
  isInputFormat,
  isOutputFormat,
  supportsInputFormat,
  supportsOutputFormat,
  type EngineEvaluateOptions,
  type EngineType,
  type InputFormat,
  type OutputFormat,
} from "@/lib/engine-types";
import type { PlaygroundState, RunSnapshot } from "@/lib/playground-types";
import { canAutoRunSnapshot, validateRunRequest } from "@/lib/validation";

export type { Example } from "@/lib/examples";
export type { PlaygroundState, RunSnapshot } from "@/lib/playground-types";
export {
  getDefaultExample,
  getExamplesForEngine,
  examples,
} from "@/lib/examples";
export {
  HASH_SYNC_DELAY_MS,
  MAX_SHAREABLE_HASH_LENGTH,
  decodeHashState,
  encodeHashState,
} from "@/lib/urlState";

export const AUTO_RUN_DELAY_MS = 600;

export const ENGINE_PLACEHOLDERS: Record<EngineType, string> = {
  yq: ".metadata.name",
  dasel: "server.http_port",
};

export type SyntaxHint = {
  docsHref: string;
  docsLabel: string;
  example: string;
  prefix: string;
};

export const ENGINE_SYNTAX_HINTS: Record<EngineType, SyntaxHint> = {
  yq: {
    docsHref: "https://mikefarah.gitbook.io/yq/",
    docsLabel: "yq docs ↗",
    example: ".metadata.name",
    prefix: "Try",
  },
  dasel: {
    docsHref: "https://daseldocs.tomwright.me/",
    docsLabel: "dasel docs ↗",
    example: 'server.http_port or search(key == "val")',
    prefix: "Try",
  },
};

export function createDefaultState(): PlaygroundState {
  const example = getDefaultExample("yq");

  return {
    autoRun: true,
    engine: example.engine,
    expression: example.expression,
    input: example.input,
    inputFormat: example.inputFormat,
    noDoc: false,
    outputFormat: example.outputFormat,
    prettyPrint: false,
    readFlagsText: "",
    returnRoot: false,
    unstable: false,
    unwrapScalar: true,
    variablesText: "",
    writeFlagsText: "",
  };
}

export function supportsNoDoc(
  engine: EngineType,
  outputFormat: OutputFormat,
): boolean {
  return engine === "yq" && outputFormat === "yaml";
}

export function supportsPrettyPrint(
  engine: EngineType,
  outputFormat: OutputFormat,
): boolean {
  return engine === "yq" && outputFormat === "json";
}

export function supportsUnwrapScalar(
  engine: EngineType,
  outputFormat: OutputFormat,
): boolean {
  return (
    engine === "yq" &&
    (outputFormat === "yaml" ||
      outputFormat === "json" ||
      outputFormat === "props")
  );
}

export function normalizeFormatsForEngine(
  state: PlaygroundState,
): PlaygroundState {
  const example = getDefaultExample(state.engine);

  return {
    ...state,
    inputFormat: supportsInputFormat(state.engine, state.inputFormat)
      ? state.inputFormat
      : example.inputFormat,
    outputFormat: supportsOutputFormat(state.engine, state.outputFormat)
      ? state.outputFormat
      : example.outputFormat,
  };
}

export function createRunSnapshot(state: PlaygroundState): RunSnapshot {
  const normalizedState = normalizeFormatsForEngine(state);

  return {
    engine: normalizedState.engine,
    expression: normalizedState.expression,
    input: normalizedState.input,
    inputFormat: normalizedState.inputFormat,
    noDoc: supportsNoDoc(normalizedState.engine, normalizedState.outputFormat)
      ? normalizedState.noDoc
      : false,
    outputFormat: normalizedState.outputFormat,
    prettyPrint: supportsPrettyPrint(
      normalizedState.engine,
      normalizedState.outputFormat,
    )
      ? normalizedState.prettyPrint
      : false,
    readFlagsText:
      normalizedState.engine === "dasel" ? normalizedState.readFlagsText : "",
    returnRoot:
      normalizedState.engine === "dasel" ? normalizedState.returnRoot : false,
    unstable:
      normalizedState.engine === "dasel" ? normalizedState.unstable : false,
    unwrapScalar: supportsUnwrapScalar(
      normalizedState.engine,
      normalizedState.outputFormat,
    )
      ? normalizedState.unwrapScalar
      : false,
    variablesText:
      normalizedState.engine === "dasel" ? normalizedState.variablesText : "",
    writeFlagsText:
      normalizedState.engine === "dasel" ? normalizedState.writeFlagsText : "",
  };
}

export function serializeRunSnapshot(snapshot: RunSnapshot): string {
  return JSON.stringify(snapshot);
}

export function canAutoRun(snapshot: RunSnapshot): boolean {
  return canAutoRunSnapshot(
    snapshot.engine,
    snapshot.input,
    snapshot.expression,
    snapshot.inputFormat,
    snapshot.outputFormat,
  );
}

export function parseFlagMap(flagText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const segments = flagText
    .split(/\r?\n|,/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === segment.length - 1) {
      throw new Error(
        `Invalid flag ${JSON.stringify(segment)}. Use key=value pairs separated by commas or new lines.`,
      );
    }

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      throw new Error(
        `Invalid flag ${JSON.stringify(segment)}. Use key=value pairs separated by commas or new lines.`,
      );
    }

    result[key] = value;
  }

  return result;
}

export function parseVariableMap(variableText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const segments = variableText
    .split(/\r?\n/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === segment.length - 1) {
      throw new Error(
        `Invalid variable ${JSON.stringify(segment)}. Use one variable per line in the form name=value or name=format:value.`,
      );
    }

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      throw new Error(
        `Invalid variable ${JSON.stringify(segment)}. Use one variable per line in the form name=value or name=format:value.`,
      );
    }

    result[key] = value;
  }

  return result;
}

export function validateDaselConfiguration(
  readFlagsText: string,
  writeFlagsText: string,
  variablesText: string,
): { ok: true } | { ok: false; message: string } {
  try {
    parseFlagMap(readFlagsText);
    parseFlagMap(writeFlagsText);
    parseVariableMap(variablesText);
    return { ok: true };
  } catch (configurationError: unknown) {
    return {
      ok: false,
      message:
        configurationError instanceof Error
          ? configurationError.message
          : "Invalid selector engine configuration.",
    };
  }
}

export function createEngineEvaluateOptions(
  snapshot: RunSnapshot,
): EngineEvaluateOptions {
  if (snapshot.engine === "yq") {
    return {
      noDoc: supportsNoDoc(snapshot.engine, snapshot.outputFormat)
        ? snapshot.noDoc
        : false,
      prettyPrint: supportsPrettyPrint(snapshot.engine, snapshot.outputFormat)
        ? snapshot.prettyPrint
        : false,
      unwrapScalar: supportsUnwrapScalar(snapshot.engine, snapshot.outputFormat)
        ? snapshot.unwrapScalar
        : false,
    };
  }

  return {
    readFlags: parseFlagMap(snapshot.readFlagsText),
    returnRoot: snapshot.returnRoot,
    unstable: snapshot.unstable,
    variables: parseVariableMap(snapshot.variablesText),
    writeFlags: parseFlagMap(snapshot.writeFlagsText),
  };
}

export { isEngineType, isInputFormat, isOutputFormat, validateRunRequest };
