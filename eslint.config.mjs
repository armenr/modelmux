// Flat config. @antfu/eslint-config lints + formats .ts/.md/.yml/.json/.jsonc/.toml
// via ESLint Stylistic + per-language plugins. We DO NOT set `formatters`, so
// prettier/dprint are never installed or invoked.
import antfu from "@antfu/eslint-config";

export default antfu(
  {
    type: "app",
    typescript: true,
    jsonc: true,
    yaml: true,
    toml: true,
    markdown: true,
    // ESLint Stylistic owns formatting (tuned to match this repo's code style).
    stylistic: {
      indent: 2,
      quotes: "double",
      semi: true,
    },
    gitignore: true,
    // Design/plan docs hold illustrative, sometimes-partial code samples — don't lint them.
    ignores: ["docs/**", "**/*.jsonl", "test/fixtures/**"],
  },
  {
    // Project-specific relaxations: a proxy handles untyped JSON; CLIs/scripts print.
    rules: {
      "ts/no-explicit-any": "off",
      "no-console": "off",
    },
  },
);
