import { sanitizeEngineErrorMessage } from "@/lib/errorDisplay";
import {
  ENGINE_INPUT_FORMATS,
  ENGINE_OUTPUT_FORMATS,
  type EngineType,
  type InputFormat,
} from "@/lib/engine-types";
import { VALIDATION_MESSAGES } from "@/lib/validation";

export function normalizeEngineError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown engine error.");
}

function supportedInputFormats(engine: EngineType): string {
  return ENGINE_INPUT_FORMATS[engine].join(", ");
}

function supportedOutputFormats(engine: EngineType): string {
  return ENGINE_OUTPUT_FORMATS[engine].join(", ");
}

function isSelectorParseFailure(normalized: string): boolean {
  return (
    normalized.includes("invalid input text") ||
    normalized.includes("unexpected token") ||
    normalized.includes("unexpected eof") ||
    normalized.includes("expected") ||
    normalized.includes("lexer error") ||
    normalized.includes("parse selector")
  );
}

export function toFriendlyEvaluationErrorMessage(
  rawMessage: string,
  inputFormat: InputFormat,
  engine: EngineType,
): string {
  const message = rawMessage.replace(/^Error:\s*/u, "").trim();
  const firstLine =
    message.split(/\r?\n/u)[0]?.trim() ?? "Unknown engine error.";
  const normalized = firstLine.toLowerCase();

  if (
    normalized.includes("timed out") ||
    normalized.includes("execution timed out")
  ) {
    return VALIDATION_MESSAGES.workerTimeout;
  }

  if (
    normalized.includes("expression is required") ||
    normalized.includes("selector is required")
  ) {
    return VALIDATION_MESSAGES.emptyExpression;
  }

  if (normalized.includes("input is required")) {
    return VALIDATION_MESSAGES.emptyInput;
  }

  if (normalized.includes("unsupported input format")) {
    return `Unsupported input format. Choose one of ${supportedInputFormats(engine)}. Details: ${firstLine}`;
  }

  if (normalized.includes("unsupported output format")) {
    return `Unsupported output format. Choose one of ${supportedOutputFormats(engine)}. Details: ${firstLine}`;
  }

  if (normalized.includes("internal error occurred")) {
    return "An internal error occurred.";
  }

  if (
    engine === "yq" &&
    (normalized.includes("bad expression") ||
      normalized.includes("lexer error") ||
      normalized.includes("parse expression") ||
      normalized.includes("unexpected token"))
  ) {
    return `The expression could not be parsed. ${firstLine}`;
  }

  if (engine === "dasel" && isSelectorParseFailure(normalized)) {
    return `The selector could not be parsed. ${firstLine}`;
  }

  if (
    normalized.includes("invalid character") ||
    normalized.includes("did not find expected") ||
    normalized.includes("cannot decode") ||
    normalized.includes("xml syntax error") ||
    normalized.includes("failed to read input") ||
    normalized.includes("toml") ||
    normalized.includes("csv") ||
    normalized.includes("yaml") ||
    normalized.includes("json") ||
    normalized.includes("ini") ||
    normalized.includes("hcl")
  ) {
    return `The ${inputFormat.toUpperCase()} input could not be parsed. ${firstLine}`;
  }

  return sanitizeEngineErrorMessage(firstLine);
}
