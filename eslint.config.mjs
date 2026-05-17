import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: [
      ".next/**",
      ".tools/**",
      "node_modules/**",
      "out/**",
      "public/wasm_exec.js",
      "public/engine-yq.wasm",
      "public/engine-yq.wasm.gz",
      "public/engine-dasel.wasm",
      "public/engine-dasel.wasm.gz",
      "test-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-console": "error",
    },
  },
];

export default config;
