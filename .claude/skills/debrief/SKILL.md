---
name: debrief
description: Post-dispatch verification. After a dispatched sub-agent, workflow step, or dispatch-charter (FR-NNNN) returns, verify it actually achieved the intent, that its findings were persisted to disk (not left only in the dispatch's conversation), and that production-reachability holds (IMPL vs WIRED). Updates the traceability ledger + log.md. Use after EVERY dispatch before the orchestrator treats the work as done. Catches the #1 recurring failure — code that compiles and passes tests but is never wired.
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
---

# /debrief — verify a dispatch achieved intent and the findings survived

> **Standard / Full — only relevant if you dispatch sub-agents or run fan-out workflows.** If you work
> solo in a single session, you don't need this skill. It is the orchestrator-side gate you run after
> handing work to another agent.

A dispatch (a dispatch-charter `FR-NNNN`, a sub-agent call, a workflow step) returns a claim of done.
**A returned claim is not a verified outcome.** `/debrief` is the gate that closes the loop: did the
dispatched work achieve the intent, did its findings reach disk, and is the result actually reachable
from a production path?

This back-ports three durable disciplines the orchestrator must not skip after fan-out:

- **IMPL→WIRED** — verification by production-reachability, not test-pass (the #1 recurring failure).
- **Findings-to-disk-or-they-don't-exist** — a sub-agent's findings that live only in ITS conversation
  are dead the moment the dispatch returns.
- **The executor never audits its own work** — `/debrief` is run by the dispatching orchestrator (or a
  clean-context verifier), never by the agent that did the work.

**Foreground in the main agent / orchestrator.** The orchestrator holds the dispatch intent and the
brief; it is the right place to compare returned-against-intended.

## When to invoke

- **After EVERY dispatch returns** — a dispatch-charter, a sub-agent, a workflow step. Before marking
  the work-unit done.
- **At a phase gate** — when a wave of charters has returned and you are about to merge / proceed.
  Debrief each leg.
- **When a sub-agent reports "done" but you have not seen the artifact on disk** — the most common
  failure shape.
- **After a research-pipeline track or a workflow fan-out** — confirm each leg's findings landed in its
  tier file / owning surface.

## When NOT to invoke

- For a read-only sub-agent call whose only output is a verbal answer you have already captured (no
  claimed artifact, no wiring claim) — there is nothing to verify against disk.
- Mid-dispatch — wait for the leg to return.
- As a substitute for the research-pipeline's adversarial gate — that gate checks CLAIMS against
  primary sources; `/debrief` checks DISPATCH OUTCOMES against intent + disk + reachability. Different
  jobs; a research investigation gets both.

## Steps

### 1. Recover the dispatch intent (the ground truth to verify against)

The persisted brief is ground truth, not the conversation. For each dispatch being debriefed, pull:

- the **dispatch-charter** (`.agent-docs/dispatch-charters/<FR-id>.md`, or the dispatch prompt itself in
  the Standard profile) — its **Task**, **Acceptance criteria**, and **wiring-proof target** (the
  production entrypoint the work must be reachable from).
- the work-unit it serves (`WU-NNNN`).

```bash
pwd && git rev-parse --abbrev-ref HEAD            # cwd-check before any verification ops
cat .agent-docs/dispatch-charters/<FR-id>.md 2>/dev/null | sed -n '1,60p'   # the charter's intent + acceptance
```

### 2. Did it achieve the intent? (returned-vs-intended)

Compare what the dispatch CLAIMS it did against the charter's Task + Acceptance. For each acceptance
criterion, find the on-disk evidence — do not take the dispatch's word:

```bash
git status -s && git log --oneline -5            # what actually landed in the tree
git diff --stat HEAD~1 2>/dev/null               # diff shape vs the charter's expected diff shape
```

- **Deliverables present?** The files the charter said it would produce — do they exist, with real
  content (no stubs / TODOs / not-implemented placeholders)?
- **Gates green?** The gates are the acceptance bar: `bun run build` / `bun run lint` / `bun test test/`
  (+ ``). Confirm the dispatch actually ran them and they passed — cite the result, don't
  assume. A behavior change OWES a test that fails without it.
- **Scope honored?** Did it stay inside its one-file-one-owner boundary, or did it touch files another
  leg owns (a fan-out collision)?

If the intent was NOT achieved → the work is BLOCKED, not done. Record the gap (step 4), and either
re-dispatch with a corrected charter or escalate to the operator.

### 3. Did the findings reach disk? AND is it WIRED? (the two recurring traps)

**3a — Findings-to-disk.** Walk what the dispatch discovered. Anything load-bearing that exists only in
the dispatch's returned text — an investigation result, a dead-end, a decision with rejected
alternatives, an anti-assumption — must be persisted to its owning surface, or it is lost:

- a research finding → the `research/<R-id>/` tier file
- a decision with alternatives → an ADR (`decisions/`) or a checkpoint point 5
- a gotcha / anti-assumption → a `memories/` claim or `now/status.md`
- a self-audit finding → the self-audit corpus (`dogfood/`, if you run one)

If a finding is only in the conversation, FILE IT NOW (or note it as a debrief gap). *(Findings only in
conversation are DEAD at compaction.)*

**3b — IMPL→WIRED (production-reachability, not test-pass).** This is the gate that kills the #1
failure. "It compiles and tests pass" does NOT mean it is wired to a production path. Verify
reachability from the charter's wiring-proof target using the **prover menu — first available wins,
grep-the-callers is the honest floor:**

1. **`the TypeScript language server` reachability / call-path query**, if the project ships a code-intel tool.
   (Rebuild its index first if the tree changed.)
2. Else an **LSP find-references** on the new symbol — does anything on a production path call it?
3. Else an **LSP call-hierarchy** from the production entrypoint down to the new code.
4. Else a **language call-graph tool** (whatever node-ts offers).
5. Else **grep-the-callers** as an explicit floor — record the query + the result, not just "looks
   wired".
6. Else a **manual-trace note** in the row — name the entrypoint and the hop chain by hand.

Does a real path trace from a production entrypoint (a `main()`, a served command, a public API
surface) to the new code? If the query comes back EMPTY, the code is orphaned — `IMPL`, not `WIRED`.
Dead code the linter flags is this failure surfacing, not noise.

- **Cross-layer lockstep surfaces** (only if you run the revisit-ledger module) → confirm the
  `twin:` anchors were set on the surfaces that must move in lockstep (a schema ↔ its parser ↔ its
  consumers; an interface ↔ its implementations) and the ledger row exists.

Classify the work-unit's state: **`IMPL`** (built, not yet reachable) / **`WIRED`** (traced from a
production entrypoint) / **`DEFER`** (intentionally not wired yet, with a written reason). `WIRED`
requires the traced path — an assertion is not enough.

### 4. Update the traceability ledger (the IMPL→WIRED record)

Write/update the work-unit's row in the `traceability/` ledger (one row per work-unit,
UPDATE-IN-PLACE). Columns: `WU-NNNN` · `FR-id` · deliverable · `IMPL`/`WIRED`/`DEFER` · the
reachability evidence (the prover-menu query output ref, or the `twin:` anchor + ledger row) · date.
If `traceability/index.md` does not yet list the ledger, add it in the same change (index
completeness). *(If you are on the Standard profile without `traceability/`, record the state in the
WU's `now/work-plan.md` row and in checkpoint point 8.)*

A work-unit cannot be marked done in `now/work-plan.md` while its row is `IMPL` (not `WIRED`) without
an explicit `DEFER` rationale.

### 5. Journal the debrief

`.agent-docs/log.md` (newest at top):

```
## [YYYY-MM-DD] dispatch | debrief FR-NNNN (WU-NNNN) — <verdict: achieved | gaps | blocked>

Intent: <one line>. Reachability: IMPL|WIRED|DEFER (<evidence ref>). Findings persisted: <where>. <gap, if any>.
```

Use the `dispatch` op for the debrief line; add `memory` / `incident` / `dogfood` op lines if the
debrief surfaced one of those.

### 6. Report

- "/debrief FR-NNNN (WU-NNNN): <achieved | gaps found | BLOCKED>"
- Reachability verdict: `IMPL` / `WIRED` / `DEFER` + the evidence ref.
- Findings persisted to: `<paths>` (or "all findings already on disk").
- If gaps: the specific remediation (re-dispatch with corrected charter / file the orphaned finding /
  escalate). If it is a recurring failure shape: "candidate lesson — surface at `/distill-lessons`."

**DO NOT auto-commit.**

## Anti-patterns

- Do NOT accept "tests pass" as WIRED — trace production-reachability (the #1 recurring trap).
- Do NOT let the executing agent debrief its own dispatch — separation of duties (CONVENTIONS.md §7.2);
  run it from the orchestrator or a clean-context verifier.
- Do NOT leave a dispatch's findings in its returned text — persist or lose them.
- Do NOT mark a WU done on an `IMPL`-only row without an explicit `DEFER` rationale.
- Do NOT skip the traceability update — the ledger is the durable record that the loop was closed.
- Do NOT include secrets, credentials, or regulated / user data — reference paths.

## Relationship to the other lifecycle skills

| Skill | Verifies | Against |
|---|---|---|
| `/debrief` | a **dispatch outcome** | the charter's intent + on-disk artifacts + production-reachability |
| `/research-pipeline` adversarial gate | a research **claim** | PRIMARY current-year sources |
| `/sitrep` | (captures, does not verify) | freezes the forensic state incl. each touched file's wiring status |
| `/handoff` | (consolidates) | folds open debrief gaps into the next-actions queue + the detour map |

`/debrief` is the per-dispatch gate; `/sitrep` and `/handoff` consolidate its outcomes into the durable
record.

## Design rationale

IMPL→WIRED + production-reachability and the dispatch/verifier discipline: `CONVENTIONS-full-addendum.md`
§C (IMPL→WIRED) and §D (dispatch / wave / verifier). Separation of duties (the executor never
self-audits): `CONVENTIONS.md` §7.2. The recurring built-but-not-wired trap — the single most
expensive failure this gate exists to catch — and findings-to-disk are the reasons the loop is closed
by the *orchestrator*, not the builder.
