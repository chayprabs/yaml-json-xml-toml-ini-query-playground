const PANIC_LINE = /^(goroutine|panic:|runtime\/|github\.com\/|\s*at\s+)/iu;
const ABS_PATH = /(?:^|\s)(\/(?:usr|home|tmp|var|opt|workspace)\/[^\s]+)/gu;
const WASM_ADDR = /\b0x[0-9a-f]{4,}\b/giu;
const MODULE_VERSION = /@[vV]?\d+\.\d+\.\d+[^\s]*/gu;

export function sanitizeEngineErrorMessage(raw: string): string {
  const lines = raw.split(/\r?\n/u).map((line) => line.trim());
  let candidate = "";

  for (const line of lines) {
    if (!line || PANIC_LINE.test(line)) {
      continue;
    }

    if (/^\/(?:usr|home|tmp|var|opt|workspace)\//u.test(line)) {
      continue;
    }

    candidate = line;
    break;
  }

  if (!candidate) {
    candidate = lines.find((line) => line.length > 0) ?? "Evaluation failed.";
  }

  let cleaned = candidate.replace(ABS_PATH, " ").replace(WASM_ADDR, "0x…");
  cleaned = cleaned.replace(MODULE_VERSION, "");

  cleaned = cleaned.replace(/\s{2,}/gu, " ").trim();

  if (cleaned.length > 300) {
    cleaned = `${cleaned.slice(0, 297)}…`;
  }

  return cleaned;
}
