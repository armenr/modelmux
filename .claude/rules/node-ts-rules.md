---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-09
paths: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs", "**/tsconfig*.json", "**/package.json", "**/eslint.config.*"]
---

# Node / TypeScript rules

The stack-specific concretion of the universal quality-gate discipline in `standing-rules-core.md`
(§Quality gates). Short on purpose — deep architecture lives in your project's own `reference/`. This
pack is the TypeScript binding for the generic `bun run build / bun test test/ / bun run lint / 
/ an unhandled promise rejection / the TypeScript language server` seams: `bun run build` → `tsc --noEmit` (the type-check
gate), `bun run lint` → `eslint .`, `` → `prettier --check .`, `an unhandled promise rejection` → the
unhandled-promise-rejection trap below, `the TypeScript language server` → the TypeScript language server (see
`code-intel.md`). Commands verified against current-year primary docs (TypeScript, ESLint 9,
typescript-eslint, Prettier) — currency-check again before pinning versions.

## Type-check & lint & format gates (strict by decision, not preference)

- **Versions-check first — the gate FAILS on toolchain drift.** Before any other stage runs, verify
  the active toolchain matches the pins: `node --version` against `package.json#engines` / `.nvmrc`,
  and the installed `typescript` / `eslint` / `prettier` against the lockfile's resolved versions. A
  mismatch is a gate FAILURE, not a note — a `tsc` or `eslint` run that goes green under a toolchain
  the pins don't describe is vacuously green, not passing.
- **`tsc --noEmit` must pass with `strict` on.** In `tsconfig.json` set `"strict": true` (this turns on
  `noImplicitAny`, `strictNullChecks`, and the rest as one switch) and add the sharp edges strict does
  NOT include: `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`,
  `"noFallthroughCasesInSwitch": true`, `"exactOptionalPropertyTypes": true`. A type error is a build
  failure, not a suggestion. **`any` is a hole in the type system** — prefer `unknown` + narrowing; an
  `any` (or a `// @ts-ignore`) needs an explicit, justified, in-comment reason or it must be fixed.
- **`eslint .` must pass with zero warnings.** Use ESLint 9 flat config (`eslint.config.mjs`) with
  `typescript-eslint`'s type-checked rulesets — extend `tseslint.configs.strictTypeChecked` (and
  `stylisticTypeChecked` if you format-lint), and set `languageOptions.parserOptions.projectService:
  true` so the type-aware rules can see your `tsconfig`. Run the gate with `--max-warnings 0` — warnings
  are errors, same as the rest of this kit. Don't blanket-disable a rule; suppress a single line with
  `// eslint-disable-next-line <rule> -- why this is correct here`, or fix the finding.
- **`prettier --check .` must pass.** Formatting is not negotiated per-file; `prettier --write .` fixes
  it. The pre-commit hook runs lint + format; **never `--no-verify`** to get past a failing gate —
  investigate it.

## The unhandled-promise trap in library code (an unhandled promise rejection for Node)

Node's analog of an uncaught fatal is an **unhandled promise rejection**: a rejected `Promise` with no
`.catch`/`await` handler crashes the process (Node aborts on `unhandledRejection` by default). The way
that happens silently is a **floating promise** — an `async` call whose returned promise is never
awaited or handled.

- **No floating promises.** `@typescript-eslint/no-floating-promises` (part of the type-checked ruleset
  above) must be an error, not a warning. Every promise is `await`ed, returned, or explicitly
  `void`-ed with a reason. A fire-and-forget task uses `void doThing().catch(handle)`, never a bare
  `doThing()`.
- **No `async` without `await` misuse, and no swallowed rejections.** `no-misused-promises` (same
  ruleset) stops passing an `async` function where a `void` callback is expected (e.g. an event handler
  that silently drops its rejection). Don't `.catch(() => {})` a rejection into the void — handle it or
  propagate it.
- **Library code throws typed, caller-recoverable errors — it does not `process.exit()`.** A library
  that calls `process.exit()` or lets a rejection escape turns a caller's recoverable failure into a
  process abort it can't catch. Throw a typed `Error` subclass; let the entrypoint decide the exit code.

## Error-handling & async shape

- **`catch` binds `unknown`, not `any`.** With `useUnknownInCatchVariables` (on under `strict`), a
  caught value is `unknown` — narrow it (`instanceof Error`) before use. Model domain failures as typed
  `Error` subclasses (a discriminant field, or an error-cause chain via `new Error(msg, { cause })`),
  not bare strings.
- **Don't block the event loop.** Keep CPU-bound work off the main thread (a worker thread / a queue);
  don't do sync file/network I/O on a request path where the async API exists.
- **A discarded promise is a bug**, the same way a discarded `Result` is elsewhere in this kit — the
  lint rules above are what make that mechanical rather than a matter of vigilance.

## Dependency discipline

- **One package manager, one lockfile, committed.** Pick npm *or* pnpm *or* yarn *or* bun and commit its
  lockfile (`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lock`); a reproducible install is
  `npm ci` (or `pnpm install --frozen-lockfile`), which installs exactly the lock. Don't hand-edit the
  lockfile or run a forced re-resolve without intent (the safety gate asks on `--force`).
- **Currency-check before adding or bumping ANY dependency** (`standing-rules-core.md` §external deps):
  verify the latest stable version + deprecation status of the *exact* API you use against current-year
  primary docs (the registry `npm` + the package's own docs), not from memory. Pin with
  intent; run `npm audit` (or `pnpm audit`) after a dependency change.
- **`devDependencies` vs `dependencies` is a real boundary** — build/test/lint tooling is a
  `devDependency`; only runtime imports are `dependencies`. Prefer a project-local dev-dependency over a
  global install (the gate asks on `-g`).

## Acceptance for any change here

- **A behavior change OWES a test that fails without it.** A green test run (`bun test test/` — e.g.
  `vitest run`, `jest`, or `node --test`) is necessary, not sufficient — every behavior carries its
  falsifier.
- **IMPL → WIRED is the bar, not test-pass.** After it type-checks and tests pass, prove the new code is
  reachable from a production entrypoint (the package `main`/`exports` a real consumer imports, a bin in
  `package.json#bin`, an HTTP route/handler that is actually registered) and record IMPL/WIRED/DEFER in
  `traceability/`. Prove reachability with `the TypeScript language server` — for TypeScript that is the language
  server's references / call-hierarchy, with an optional module-graph tool and a grep-the-callers floor
  (see `code-intel.md`). An unimported module that `tsc`'s `noUnusedLocals` / ESLint's `no-unused-vars`
  can't see across the module boundary is a wiring failure, not noise.

## Related

- `code-intel.md` (the TypeScript reachability prover menu) · `standing-rules-core.md` (§Quality gates,
  §IMPL→WIRED) · `../../base/*/agent-docs/CONVENTIONS.md` (the schema contract)
