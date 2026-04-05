import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

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
  ...nextVitals,
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
