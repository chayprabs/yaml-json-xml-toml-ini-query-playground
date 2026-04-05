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
      "public/engine.wasm",
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
