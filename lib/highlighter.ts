import hljs from "highlight.js/lib/core";
import iniLanguage from "highlight.js/lib/languages/ini";
import jsonLanguage from "highlight.js/lib/languages/json";
import plaintextLanguage from "highlight.js/lib/languages/plaintext";
import propertiesLanguage from "highlight.js/lib/languages/properties";
import xmlLanguage from "highlight.js/lib/languages/xml";
import yamlLanguage from "highlight.js/lib/languages/yaml";

import { getHighlightLanguage } from "@/lib/output";
import type { OutputFormat } from "@/lib/engine-types";

let languagesRegistered = false;

if (!languagesRegistered) {
  hljs.registerLanguage("yaml", yamlLanguage);
  hljs.registerLanguage("json", jsonLanguage);
  hljs.registerLanguage("xml", xmlLanguage);
  hljs.registerLanguage("toml", iniLanguage);
  hljs.registerLanguage("properties", propertiesLanguage);
  hljs.registerLanguage("plaintext", plaintextLanguage);
  languagesRegistered = true;
}

export function highlightOutput(
  output: string,
  outputFormat: OutputFormat,
): string {
  if (!output) {
    return "";
  }

  return hljs.highlight(output, {
    ignoreIllegals: true,
    language: getHighlightLanguage(outputFormat),
  }).value;
}
