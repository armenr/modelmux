---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-10
paths: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"]
---

# `the TypeScript language server` for TypeScript — the reachability prover

`the TypeScript language server` is the tool you reach for to answer structural questions exactly — "who calls X?",
"what breaks if I change X?", "is X reachable, or is it dead?" — instead of guessing with a text search.
For TypeScript the default resolution is the **TypeScript language server** (`tsserver`, also served as
`typescript-language-server`), driven either through your editor's LSP UI or through an LSP-aware agent
tool. It resolves through modules, re-exports, generics, and declaration merging where a regex cannot.
This file specializes the language-agnostic prover menu in `standing-rules-core.md` (§IMPL→WIRED) to
TypeScript.

## Tool-selection order (structural questions get structural answers)

1. **The TypeScript language server (LSP)** — the default for references, definitions, call hierarchy,
   implementations, and rename. Semantic and exact. Because it type-checks, it follows a re-export chain
   and an aliased import that text search misses. `tsc` errors and `tsserver` answers come from the same
   engine, so its reference set is trustworthy.
2. **A module-/dependency-graph tool (OPTIONAL, not required)** — for a wider view than one symbol's
   references: `madge` (module dependency graph; `madge --orphans src` lists modules nothing imports, and
   `madge --circular src` finds cycles), `dependency-cruiser` (rule-based import-graph validation), or a
   `ts-morph` script for a programmatic AST walk when you need a custom query. These give module-level
   reachability; they are a strong lead, not gospel, across dynamic `import()` and reflection.
3. **`grep` / `ripgrep`** — the honest floor, ONLY for literal text (comments, strings, log messages,
   route paths) or when no LSP is available. Never use grep as your *only* evidence for a "who calls / is
   this wired" question when the language server can answer it semantically.

## The IMPL → WIRED prover menu (in order)

To prove new code is reachable from a production entrypoint (the package `main`/`exports` a real
consumer imports, a bin in `package.json#bin`, a registered HTTP route/handler, a subscribed event
listener):

1. **LSP "Find All References"** on the new symbol — does anything import or call it at all?
2. **LSP "Call Hierarchy" → incoming calls**, walked UPWARD — does the chain terminate at an entrypoint
   (a `bin` script's `main`, an exported API surface an external caller uses, a route registered on the
   server)? If it dead-ends inside your own module with no external importer, it is IMPL-not-WIRED.
3. **A module-graph tool** (menu item 2 above) — `madge --orphans` on the source root surfaces a module
   that nothing imports at all: a whole dead file, the loudest form of the wiring trap.
4. **grep-the-callers floor** — `rg '\bmyFn\b' -g '*.ts' -g '*.tsx'` — when no LSP is running. Note in
   `traceability/` that the evidence is textual, not semantic (it will miss a call through a re-exported
   alias).
5. **Manual-trace note** — when even grep can't settle it (a dynamic `import()`, a handler wired by
   string key, a framework's convention-based routing), write the hand-traced path into the
   `traceability/` row so the reasoning is on disk, not lost.

## Dead-code as the wiring alarm (and its blind spot)

- **`tsc` with `"noUnusedLocals"` / `"noUnusedParameters"`, plus ESLint `no-unused-vars` and
  `@typescript-eslint/no-unused-vars`, catch unused *within* a file** — a locally dead binding fails the
  gate. A fresh hit on code you just added means you wrote it but never used it.
- **Neither sees an unused *export* across the module boundary** — an exported function nothing imports
  is invisible to `tsc`, exactly the built-but-not-wired case. That gap is what the module-graph tool
  (`madge --orphans`) and the LSP reference walk above exist to close; the compiler's silence on an
  export is not proof of wiring.

## Reachability baseline

The deterministic oracle the IMPL→WIRED proof cites is **`knip`**: from the project's real entrypoints
(`package.json` `bin` / `exports` / `scripts` plus framework config) `npx knip` reports unused files,
exports, and dependencies in one reproducible, CI-able run. `ts-prune` is the narrower predecessor (unused
exports only), now in maintenance mode and superseded by knip — reach for knip. A file or export you just
added that knip flags as unused is IMPL-not-WIRED. Blind spot: a dynamic `import()` or a string-keyed
handler can make knip over-report deadness, so confirm a flagged symbol against the LSP reference walk above
before deleting. If neither tool is available, fall back to the grep-floor call-chase and record in
`traceability/` that the evidence is textual.

> **Currency:** `knip` / `ts-prune` checked against PRIMARY docs on 2026-07-10
> (knip.dev, npmjs.com/package/ts-prune). Re-verify before adopting.

## Related

- `rules.md` (§Acceptance — IMPL→WIRED) · `standing-rules-core.md` (§IMPL→WIRED prover menu) ·
  `../generic/code-intel.md` (the language-agnostic version)
