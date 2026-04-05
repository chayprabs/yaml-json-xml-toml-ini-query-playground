import type { InputFormat } from "@/lib/engine-types";

export function normalizeEngineError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown engine error.");
}

export function toFriendlyEvaluationErrorMessage(
  rawMessage: string,
  inputFormat: InputFormat,
): string {
  const message = rawMessage.replace(/^Error:\s*/u, "").trim();
  const firstLine =
    message.split(/\r?\n/u)[0]?.trim() ?? "Unknown engine error.";
  const normalized = firstLine.toLowerCase();

  if (normalized.includes("execution timed out")) {
    return "Evaluation timed out after 8s. Try a smaller input or a narrower expression.";
  }

  if (normalized.includes("expression is required")) {
    return "Expression is required. Enter an expression before running.";
  }

  if (normalized.includes("input is required")) {
    return "Input is required. Paste a document before running.";
  }

  if (normalized.includes("unsupported input format")) {
    return `Unsupported input format. Choose one of yaml, json, xml, csv, or toml. Details: ${firstLine}`;
  }

  if (normalized.includes("unsupported output format")) {
    return `Unsupported output format. Choose one of yaml, json, xml, csv, toml, or props. Details: ${firstLine}`;
  }

  if (normalized.includes("internal error occurred")) {
    return "An internal error occurred.";
  }

  if (
    normalized.includes("bad expression") ||
    normalized.includes("lexer error") ||
    normalized.includes("parse expression") ||
    normalized.includes("unexpected token")
  ) {
    return `The expression could not be parsed. ${firstLine}`;
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
