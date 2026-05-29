"use client";

import { memo } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import hcl from "react-syntax-highlighter/dist/esm/languages/prism/hcl";
import ini from "react-syntax-highlighter/dist/esm/languages/prism/ini";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import properties from "react-syntax-highlighter/dist/esm/languages/prism/properties";
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

import type { InputFormat } from "@/lib/engine-types";
import { getHighlightLanguage } from "@/lib/output";

SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("xml", markup);
SyntaxHighlighter.registerLanguage("ini", ini);
SyntaxHighlighter.registerLanguage("toml", toml);
SyntaxHighlighter.registerLanguage("properties", properties);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("hcl", hcl);

const lightTheme = {
  ...oneLight,
  'pre[class*="language-"]': {
    ...oneLight['pre[class*="language-"]'],
    background: "transparent",
    margin: 0,
    padding: 0,
  },
  'code[class*="language-"]': {
    ...oneLight['code[class*="language-"]'],
    background: "transparent",
  },
};

function resolvePrismLanguage(inputFormat: InputFormat): string {
  const id = getHighlightLanguage(inputFormat);
  if (id === "plaintext" || id === "csv") {
    return "bash";
  }

  return id;
}

export const InputSyntax = memo(function InputSyntax({
  code,
  inputFormat,
}: {
  code: string;
  inputFormat: InputFormat;
}) {
  const language = resolvePrismLanguage(inputFormat);

  return (
    <SyntaxHighlighter
      language={language}
      style={lightTheme}
      PreTag="div"
      customStyle={{
        margin: 0,
        background: "transparent",
        fontSize: "0.875rem",
        lineHeight: 1.5,
        pointerEvents: "none",
      }}
      codeTagProps={{
        className:
          "font-[family-name:var(--font-mono)] whitespace-pre-wrap break-words",
      }}
      showLineNumbers={false}
      wrapLongLines
    >
      {code}
    </SyntaxHighlighter>
  );
});
