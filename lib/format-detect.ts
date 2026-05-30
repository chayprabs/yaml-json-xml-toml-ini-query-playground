import type { InputFormat } from "@/lib/engine-types";

function trimmedSample(text: string, maxChars = 8_192): string {
  return text.trim().slice(0, maxChars);
}

export function detectInputFormat(text: string): InputFormat | null {
  const sample = trimmedSample(text);
  if (!sample) {
    return null;
  }

  if (sample.startsWith("{") || sample.startsWith("[")) {
    try {
      JSON.parse(sample);
      return "json";
    } catch {
      // Fall through.
    }
  }

  if (sample.startsWith("<?xml") || /^<\w[\w:-]*[\s>]/u.test(sample)) {
    return "xml";
  }

  if (/^\[[\w.-]+\]/m.test(sample) || /^[\w.-]+\s*=\s*[^\n]+$/m.test(sample)) {
    if (sample.includes("[") && sample.includes("]") && sample.includes("=")) {
      return "ini";
    }
  }

  if (/^resource\s+"/m.test(sample) || /^[a-zA-Z_][\w-]*\s*\{/m.test(sample)) {
    if (
      sample.includes("=") &&
      (sample.includes("{") || sample.includes('"'))
    ) {
      return "hcl";
    }
  }

  if (/^[\w.-]+\s*=\s*["'{[]/m.test(sample) && sample.includes("\n")) {
    const tomlScore = (sample.match(/^\s*[\w.-]+\s*=/gm) ?? []).length;
    if (tomlScore >= 2) {
      return "toml";
    }
  }

  const lines = sample.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length >= 2) {
    const commaLines = lines.filter((line) => line.includes(",")).length;
    const semiLines = lines.filter((line) => line.includes(";")).length;
    if (commaLines >= Math.max(2, lines.length - 1)) {
      return "csv";
    }
    if (semiLines >= Math.max(2, lines.length - 1)) {
      return "csv";
    }
  }

  if (
    sample.includes(":") &&
    (sample.includes("\n") || sample.includes("- "))
  ) {
    return "yaml";
  }

  return "yaml";
}
