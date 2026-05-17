import type { OutputFormat } from "@/lib/engine-types";
import { OUTPUT_DISPLAY_MAX_CHARS } from "@/lib/validation";

export const OUTPUT_TRUNCATION_THRESHOLD = OUTPUT_DISPLAY_MAX_CHARS;
export const OUTPUT_HIGHLIGHT_THRESHOLD = OUTPUT_DISPLAY_MAX_CHARS;

export type PreparedOutput = {
  displayOutput: string;
  fullOutput: string;
  highlightEnabled: boolean;
  truncated: boolean;
  truncatedCharacters: number;
};

export function getHighlightLanguage(outputFormat: OutputFormat): string {
  switch (outputFormat) {
    case "yaml":
      return "yaml";
    case "json":
      return "json";
    case "xml":
      return "xml";
    case "toml":
      return "toml";
    case "ini":
      return "ini";
    case "props":
      return "properties";
    case "hcl":
      return "hcl";
    case "csv":
      return "csv";
    default:
      return "plaintext";
  }
}

export function prepareOutput(output: string): PreparedOutput {
  const truncated = output.length > OUTPUT_TRUNCATION_THRESHOLD;
  const displayOutput = truncated
    ? output.slice(0, OUTPUT_TRUNCATION_THRESHOLD)
    : output;

  return {
    displayOutput,
    fullOutput: output,
    highlightEnabled: displayOutput.length <= OUTPUT_HIGHLIGHT_THRESHOLD,
    truncated,
    truncatedCharacters: truncated ? output.length - displayOutput.length : 0,
  };
}
