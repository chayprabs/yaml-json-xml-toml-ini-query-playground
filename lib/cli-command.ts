import type { EngineType, InputFormat, OutputFormat } from "@/lib/engine-types";
import type { RunSnapshot } from "@/lib/playground-types";

function shellQuote(value: string): string {
  if (/^[\w@./:-]+$/u.test(value)) {
    return value;
  }

  return `'${value.replace(/'/gu, `'\\''`)}'`;
}

function yqInputFlag(format: InputFormat): string {
  switch (format) {
    case "json":
      return "-p=json";
    case "xml":
      return "-p=xml";
    case "csv":
      return "-p=csv";
    case "toml":
      return "-p=toml";
    default:
      return "";
  }
}

function yqOutputFlag(format: OutputFormat): string {
  switch (format) {
    case "json":
      return "-o=json";
    case "xml":
      return "-o=xml";
    case "csv":
      return "-o=csv";
    case "toml":
      return "-o=toml";
    case "props":
      return "-o=props";
    default:
      return "";
  }
}

export function buildCliCommand(snapshot: RunSnapshot): string {
  const expression = snapshot.expression.trim();
  if (!expression) {
    return "";
  }

  if (snapshot.engine === "yq") {
    const flags = [
      yqInputFlag(snapshot.inputFormat),
      yqOutputFlag(snapshot.outputFormat),
      snapshot.prettyPrint ? "-P" : "",
      snapshot.noDoc ? "-N" : "",
      snapshot.unwrapScalar === false ? "--unwrapScalar=false" : "",
    ].filter(Boolean);

    return `yq ${flags.join(" ")} ${shellQuote(expression)} input.${snapshot.inputFormat}`.trim();
  }

  const readFlags = snapshot.readFlagsText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `--read ${shellQuote(line)}`)
    .join(" ");

  const writeFlags = snapshot.writeFlagsText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `--write ${shellQuote(line)}`)
    .join(" ");

  const variables = snapshot.variablesText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `--var ${shellQuote(line)}`)
    .join(" ");

  const formatFlags = `--read ${snapshot.inputFormat} --write ${snapshot.outputFormat}`;
  const behaviorFlags = [
    snapshot.returnRoot ? "--allow-multiple" : "",
    snapshot.unstable ? "--allow-unstable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "dasel",
    formatFlags,
    readFlags,
    writeFlags,
    variables,
    behaviorFlags,
    shellQuote(expression),
    "input." + snapshot.inputFormat,
  ]
    .filter(Boolean)
    .join(" ");
}
