---
provenance: kit-template
created: 2026-07-13
last-modified: 2026-07-13
tags: [reference, contract, dispatch, fail-loud, workflow, agent, standard-profile]
related: [standing-rules-core, doc-refs-contract]
---

# The FAIL-LOUD DISPATCH CONTRACT v1

> The **one normative statement** of the dispatch fail-loud rules (R1–R6), the two sanctioned shortfall
> paths, the reference primitive, the self-accounting shape, and the escape-hatch grammar. Everything else
> — the `standing-rules-core.md` pointer, the `dispatch-gate` hook's block messages and preamble, any
> repo's local restatement — **points here and never restates it.** A second divergent statement of a rule
> is worse than none: the enforcement gate cannot police which copy is authoritative, so there is exactly
> one.

## What this governs

The whole **dispatch failure category**: a dynamic **Workflow** OR a plain **Agent** dispatch (one or many,
serial or parallel) where a unit silently drops and the run still *looks* complete. The framework default
error semantics are **fail-quiet** — a dispatch that dies resolves to `null`; a `parallel()` / `pipeline()`
never rejects — so a failure is invisible unless it is **counted**. The entire fail-loud burden therefore
sits on the author, and this contract is what moves it into structure a tool can check.

Across a five-repo field survey the same shape recurred: a review synthesised over a partial fan-out and
looked complete; a rate-limit wave failed every resolver and the run returned `COMPLETED` with an empty
result; an empty verifier set vacuously confirmed; a "successful" envelope hid stranded work in the run
journal, and a "failed" envelope hid work that had actually succeeded. Each is the same defect: a drop that
was never counted at a boundary that depended on the full set.

**Definitions.** A unit is **DROPPED** when `agent()` resolves `null` (a user-skip, a terminal API death
after retries, an unresolvable agent type) or a `pipeline()` stage throws. `null` is *always* a dropped
unit — a schema agent returns `{}` / `[]` for empty findings, **never** `null`. Wherever a downstream phase
depends on the full set, this contract **overrides** the Workflow tool docs' advice to `filter(Boolean)`.

## The rules

- **R1 — COMPLETENESS ASSERTED AT EVERY PHASE BOUNDARY.** `expected = inputs.length`; assert
  `received === expected` **before any dependent phase**, else **throw** (a top-level throw fails the run —
  that IS the loud failure). Count `pipeline()` drops the same way.

- **R2 — SILENT-DROP IDIOMS BANNED on dependent paths.** No `.filter(Boolean)`-and-continue; no
  early-return partial-success shapes (`{build, verify: null}`); no `.every()` / `.all()` verdict over a
  possibly-empty set (`[].every()` is vacuously `true` — an empty verifier set is **UNVERIFIED**, not PASS).

- **R3 — TWO SANCTIONED SHORTFALL PATHS, chosen explicitly** (below). The default is loud; degradation is an
  affirmative, annotated act.

- **R4 — COMPLETED IS NOT COMPLETE, in BOTH directions.** A run's status is not a success claim, and a
  "failed" envelope can hide stranded-successful work in the journal. **Recover, never blind re-dispatch.**
  A governed leg **returns its own accounting** `{expected, received, missing}` rather than trusting the
  run's status envelope, which lies both ways.

- **R5 — LAUNCH-TIME PRE-FLIGHT.** A newly copied agent type is confirmed **registered** before launch (a
  copy-then-launch in the same beat races the registry and yields `null`s); dispatch args are passed as
  **real JSON values**, never JSON-string-encoded (a double-encoded arg kills the script at line 1); no raw
  backticks inside a script template literal. **Every `agent()` pins `model:` explicitly** — an unpinned
  dispatch silent-inherits the session model into fan-out and is a defect to fix, not run.

- **R6 — PARTIAL-RESULT HONESTY.** A capped / budgeted / sampled run reports a **lower bound**
  (`found ≥ N`), never completeness.

## The two sanctioned shortfall paths (R3)

When a unit is missing, choose **one**, on the record:

1. **HALT-AND-REPAIR (the default).** Stop; read the failures + the run `journal.jsonl` firsthand; fix the
   cause; resume the run (survivors banked, only the gaps re-run — never blind re-dispatch); iterate to
   `N/N`; THEN proceed. Fail-loud and resume-partial are complementary, not opposed.

2. **DECLARED-DEGRADED (only where a missing unit is acceptable BY DESIGN).** The dependent phase receives an
   explicit **FAILURE MANIFEST**, marks `coverage: INCOMPLETE`, and its verdict is **never** `READY` /
   `COMPLETE` on partial input; the drop count is logged. This is the escape hatch, and it is auditable
   (below) — it is not a way to make a drop quiet, only a way to make it **declared**.

## The reference primitive

Assert completeness at a phase boundary with this exact shape. Note the **explicit `null` / `undefined`
test** — the sketched idiom `r ? null : i` mis-flags index 0 and a legit-falsy return (`{}` / `[]` / `0` /
`''`) as missing, so truthiness is never used:

```js
function assertComplete(results, expected, label) {
  const missing = results
    .map((r, i) => (r === null || r === undefined) ? i : null)
    .filter(i => i !== null);
  if (missing.length) {
    throw new Error('FAIL-LOUD ' + label + ': ' + (expected - missing.length) + '/' + expected +
      ' — missing [' + missing.join(',') + ']. HALT: read the journal, fix cause, resume to whole.');
  }
  return results;
}
```

**The self-accounting shape (R4).** A governed fan-out returns `{expected, received, missing}` (plus
`failed` / `extra` diagnostics and a `coverage`) from a manifest diff — expected work-items IN, a per-item
`{id, status}` manifest OUT, diffed. The triple must stay self-consistent on **both** the halt and the
degrade path: `received` counts only the `ok` rows, `missing` is every expected id lacking an `ok` row, and
`received === expected  ⟺  missing.length === 0  ⟺  coverage === 'COMPLETE'`. A dropped or failed row counts
as **missing** — a degrade path that reads a false-`COMPLETE` triple is the fail-quiet the shape exists to
abolish.

The kit ships these primitives (`assertComplete`, `manifestDiff`, `vacuityGuard`, an auto-asserting
`fanout`, `preflight`, `resumeGaps`) as a self-contained, hash-versioned paste-in **preamble** — a Workflow
script cannot `import`, so the machinery travels inside it. See
`.claude/hooks/dispatch-gate/` (the preamble and the gate that hash-checks it).

## The escape-hatch annotation grammar (hardened)

DECLARED-DEGRADED (R3 path 2) is exercised with a `fieldbook:degraded` annotation carried in the dispatched
material (a comment in a Workflow script; a fenced block in an Agent prompt). It is **auditable, not a
rubber stamp** — a bypass no one reads, that a single `scope: all` waives everything, whose fields are never
validated, is a master key, not a sanctioned exit. The grammar is therefore constrained:

```
fieldbook:degraded
  checks:     CB4, CW3        # ENUMERATED check-ids only — `all` (or an empty scope) is FORBIDDEN
  reason:     <non-empty why this unit may be dropped by design>
  artifact:   FR-0007         # REQUIRED — a resolvable operator artifact: a ledger id (FR-/REV-/OQ-/INC-),
                              #   or a path that EXISTS on disk (the failure manifest)
  coverage:   INCOMPLETE      # the dependent phase's coverage — never COMPLETE/READY on partial input
  drop_count: 1               # logged
```

- **Well-formed** (enumerated check-ids, non-empty reason, a resolvable artifact) → the scoped finding is
  downgraded to allow-through and one line is appended to `.agent-docs/.gate-audit.jsonl`.
- **Malformed** (a `scope: all`, a missing/empty `reason`, an unresolvable `artifact`) → the bypass is
  **invalid**; the underlying finding stands and the malformed bypass is itself a failure.
- **The conflict check is not waivable.** A leg that both declares degraded AND asserts a `COMPLETE` /
  `READY` verdict is the contradiction R3 path 2 forbids — you cannot degrade *and* claim complete.
- **A degradation is recognised and constrained, never blessed.** Whether dropping *this* unit is acceptable
  by design is the operator's call, read at the **cycle-start bypass-review sweep** over `.gate-audit.jsonl`
  — "auditable" means *actually read*.

## What this contract does NOT promise (the determinism boundary)

Determinism owns **structure**; the model owns **content**. This contract makes a dispatch *fail loud*; it
does not make it *succeed*. It does not verify that the work was done or the results are correct; that a
declared degradation is acceptable by design; that a return is a genuine payload rather than a well-shaped
stub; that the honesty fields are *true* (only that the schema declares them); that a pinned model tier is
apt; that an agent will obey its scope fence; that two dispatches are actually dependent; or that a
completeness assertion sits at the *right* boundary.

> **A green gate means "built to fail loud," never "succeeded."**

## Enforcement seam

This doc is the **spec**; `.claude/hooks/dispatch-gate/` is the **enforcement**. The gate's checks, block
messages, preamble docstring, and any archetype declarations **cite** R1–R6 here — they never fork or
restate them. A repo that grafted these rules into its own standing-rules before this doc existed de-dupes
its graft down to a pointer at this file (the single-normative-statement discipline); the gate enforces
against this one source regardless.
