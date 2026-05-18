import LZString from "lz-string";

import {
  isEngineType,
  isInputFormat,
  isOutputFormat,
} from "@/lib/engine-types";
import type { PlaygroundState } from "@/lib/playground-types";
import { MAX_EXPRESSION_CHARS } from "@/lib/validation";

export const HASH_SYNC_DELAY_MS = 300;
export const MAX_SHAREABLE_HASH_LENGTH = 4_000;

const STATE_PREFIX = "state=";
const LEGACY_HASH_VERSION = 2;
const LZ_HASH_VERSION = 3;

const hashEncoder = new TextEncoder();
const hashDecoder = new TextDecoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

function base64UrlDecode(segment: string): Uint8Array | null {
  const normalized = segment.trim();
  if (!normalized) {
    return null;
  }

  try {
    const padded = normalized
      .replace(/-/gu, "+")
      .replace(/_/gu, "/")
      .padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decodedBinary = atob(padded);
    return Uint8Array.from(decodedBinary, (character) =>
      character.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

function partialStateFromRecord(
  parsed: Record<string, unknown>,
): Partial<PlaygroundState> {
  const nextState: Partial<PlaygroundState> = {};

  if (isEngineType(parsed.engine)) {
    nextState.engine = parsed.engine;
  }

  if (typeof parsed.expression === "string") {
    nextState.expression = parsed.expression.slice(0, MAX_EXPRESSION_CHARS);
  }

  if (typeof parsed.input === "string") {
    nextState.input = parsed.input;
  }

  if (isInputFormat(parsed.inputFormat)) {
    nextState.inputFormat = parsed.inputFormat;
  }

  if (isOutputFormat(parsed.outputFormat)) {
    nextState.outputFormat = parsed.outputFormat;
  }

  if (typeof parsed.unwrapScalar === "boolean") {
    nextState.unwrapScalar = parsed.unwrapScalar;
  }

  if (typeof parsed.noDoc === "boolean") {
    nextState.noDoc = parsed.noDoc;
  }

  if (typeof parsed.prettyPrint === "boolean") {
    nextState.prettyPrint = parsed.prettyPrint;
  }

  if (typeof parsed.autoRun === "boolean") {
    nextState.autoRun = parsed.autoRun;
  }

  if (typeof parsed.returnRoot === "boolean") {
    nextState.returnRoot = parsed.returnRoot;
  }

  if (typeof parsed.unstable === "boolean") {
    nextState.unstable = parsed.unstable;
  }

  if (typeof parsed.readFlagsText === "string") {
    nextState.readFlagsText = parsed.readFlagsText;
  }

  if (typeof parsed.writeFlagsText === "string") {
    nextState.writeFlagsText = parsed.writeFlagsText;
  }

  if (typeof parsed.variablesText === "string") {
    nextState.variablesText = parsed.variablesText;
  }

  return nextState;
}

export function encodeHashState(state: PlaygroundState): string {
  const json = JSON.stringify({
    version: LZ_HASH_VERSION,
    ...state,
  });
  const compressed = LZString.compressToUint8Array(json);
  return `${STATE_PREFIX}${base64UrlEncode(compressed)}`;
}

export function decodeHashState(hash: string): Partial<PlaygroundState> | null {
  const trimmed = hash.replace(/^#/u, "").trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(STATE_PREFIX)) {
    const bytes = base64UrlDecode(trimmed.slice(STATE_PREFIX.length));
    if (!bytes) {
      return null;
    }

    try {
      const json = LZString.decompressFromUint8Array(bytes);
      if (!json) {
        return null;
      }

      const parsed = JSON.parse(json) as unknown;
      if (!isRecord(parsed) || parsed.version !== LZ_HASH_VERSION) {
        return null;
      }

      return partialStateFromRecord(parsed);
    } catch {
      return null;
    }
  }

  const bytes = base64UrlDecode(trimmed);
  if (!bytes) {
    return null;
  }

  try {
    const decodedJson = hashDecoder.decode(bytes);
    const parsed = JSON.parse(decodedJson) as unknown;

    if (!isRecord(parsed) || parsed.version !== LEGACY_HASH_VERSION) {
      return null;
    }

    return partialStateFromRecord(parsed);
  } catch {
    return null;
  }
}