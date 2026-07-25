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
    // Same rationale for the tool-owned surfaces:
    //   .agent-docs/** — Fieldbook kit payload. It has its OWN schema linter
    //     (.claude/hooks/lint-docs.py, run by the pre-commit dispatcher), and the
    //     files are kit-owned with merge semantics, so eslint findings there are
    //     unfixable without diverging from upstream on the next kit upgrade.
    //   CLAUDE.md — assembled from two independent marker blocks (partyline's and
    //     the kit's), each carrying its own H1; no-multiple-h1 is unsatisfiable by
    //     construction and neither writer will honour it.
    ignores: ["docs/**", "**/*.jsonl", "test/fixtures/**", ".agent-docs/**", "CLAUDE.md"],
  },
  {
    // Project-specific relaxations: a proxy handles untyped JSON; CLIs/scripts print.
    rules: {
      "ts/no-explicit-any": "off",
      "no-console": "off",
    },
  },
);
