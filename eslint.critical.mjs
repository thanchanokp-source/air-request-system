// Minimal ESLint config for the PRE-DEPLOY GATE (scripts/check.mjs).
// Only the rules whose violations break the running app — the full config is far noisier
// (no-explicit-any everywhere) and would never pass, so it cannot act as a gate.
import reactHooks from "eslint-plugin-react-hooks"
import tsParser from "@typescript-eslint/parser"

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { "react-hooks": reactHooks },
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" } },
    rules: {
      // Hooks called conditionally / after an early return -> React #310 at runtime.
      "react-hooks/rules-of-hooks": "error",
    },
  },
]
