import {
  supportsInputFormat,
  supportsOutputFormat,
  type EngineType,
  type InputFormat,
  type OutputFormat,
} from "@/lib/engine-types";

export const MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const INPUT_WARNING_BYTES = 500 * 1024;
export const MAX_EXPRESSION_CHARS = 2_000;
export const OUTPUT_DISPLAY_MAX_CHARS = 50_000;

const FORMAT_LABEL: Record<InputFormat | OutputFormat, string> = {
  csv: "CSV",
  hcl: "HCL",
  ini: "INI",
  json: "JSON",
  props: "Properties",
  toml: "TOML",
  xml: "XML",
  yaml: "YAML",
};

export const VALIDATION_MESSAGES = {
  emptyInput: "Paste some data to get started",
  inputTooLarge: "Input exceeds the 2 MB limit",
  inputLargeWarning: "Large input — evaluation may be slow",
  emptyExpression: "Enter an expression to evaluate",
  expressionTooLong:
    "Expression exceeds 2,000 characters. Shorten it before running.",
  iniUnsupportedYq:
    "The expression engine does not support INI input. Switch to the selector engine.",
  hclUnsupportedYq:
    "The expression engine does not support HCL input. Switch to the selector engine.",
  propsOutputDasel:
    "Properties output is only available in the expression engine.",
  workerTimeout:
    "Evaluation timed out after 8 seconds. The engine has been restarted.",
  outputTruncated:
    "Output is large — showing first 50,000 characters. Download for the full result.",
  running: "Running…",
  urlTooLarge:
    "Workspace is too large to encode in a URL. Download your input to save it.",
} as const;

export function getInputByteSize(input: string): number {
  return new TextEncoder().encode(input).length;
}

export function isInputOverHardLimit(input: string): boolean {
  return getInputByteSize(input) > MAX_INPUT_BYTES;
}

export function shouldWarnLargeInput(input: string): boolean {
  return (
    getInputByteSize(input) > INPUT_WARNING_BYTES &&
    !isInputOverHardLimit(input)
  );
}

export type RunValidation = { ok: true } | { ok: false; message: string };

function unsupportedInputMessage(
  engine: EngineType,
  inputFormat: InputFormat,
): string {
  if (engine === "yq" && inputFormat === "ini") {
    return VALIDATION_MESSAGES.iniUnsupportedYq;
  }

  if (engine === "yq" && inputFormat === "hcl") {
    return VALIDATION_MESSAGES.hclUnsupportedYq;
  }

  const label = FORMAT_LABEL[inputFormat];
  if (engine === "yq") {
    return `The expression engine does not support ${label} input. Switch to the selector engine or change the input format.`;
  }

  return `The selector engine does not support ${label} input. Change the input format.`;
}

function unsupportedOutputMessage(
  engine: EngineType,
  outputFormat: OutputFormat,
): string {
  if (engine === "dasel" && outputFormat === "props") {
    return VALIDATION_MESSAGES.propsOutputDasel;
  }

  const label = FORMAT_LABEL[outputFormat];

  if (engine === "yq") {
    return `The expression engine does not support ${label} output. Switch to the selector engine or change the output format.`;
  }

  return `The selector engine does not support ${label} output. Change the output format.`;
}

export function validateRunRequest(
  engine: EngineType,
  input: string,
  expression: string,
  inputFormat: InputFormat,
  outputFormat: OutputFormat,
): RunValidation {
  if (expression.trim().length === 0) {
    return { ok: false, message: VALIDATION_MESSAGES.emptyExpression };
  }

  if (expression.length > MAX_EXPRESSION_CHARS) {
    return { ok: false, message: VALIDATION_MESSAGES.expressionTooLong };
  }

  if (input.trim().length === 0) {
    return { ok: false, message: VALIDATION_MESSAGES.emptyInput };
  }

  if (isInputOverHardLimit(input)) {
    return { ok: false, message: VALIDATION_MESSAGES.inputTooLarge };
  }

  if (!supportsInputFormat(engine, inputFormat)) {
    return {
      ok: false,
      message: unsupportedInputMessage(engine, inputFormat),
    };
  }

  if (!supportsOutputFormat(engine, outputFormat)) {
    return {
      ok: false,
      message: unsupportedOutputMessage(engine, outputFormat),
    };
  }

  return { ok: true };
}

export function canAutoRunSnapshot(
  engine: EngineType,
  input: string,
  expression: string,
  inputFormat: InputFormat,
  outputFormat: OutputFormat,
): boolean {
  return validateRunRequest(
    engine,
    input,
    expression,
    inputFormat,
    outputFormat,
  ).ok;
}
