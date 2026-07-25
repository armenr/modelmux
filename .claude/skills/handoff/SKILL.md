---
name: handoff
description: Capture current session state to a curated artifact at .agent-docs/now/handoff.md plus an archive entry at .claude/handoffs/<timestamp>-<slug>.md. Updates now/status.md, now/work-plan.md, now/open-questions.md, log.md to current reality; sweeps the inter-party obligations ledger both directions (owed-by / owed-to, each receivable carrying a trigger + a default-if-silent) — the standalone now/obligations.md when it exists, else a handoff Obligations section; on multi-party installs, sweeps live inter-agent room threads into a Room-threads continuity block (participants/roles, message anchors, standing hooks, the re-read rule). Accepts optional session notes as arguments. Use at natural checkpoints, before compaction, before session-end, or when context exceeds ~80%. Does NOT auto-commit.
argument-hint: [optional session notes to fold into the handoff]
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-14
tags: [skill, lifecycle, handoff]
---

# /handoff — Capture session state to a durable, curated artifact

When invoked, do these steps in order. Be honest about what you know vs. what you'd be guessing.

## Detect invocation mode

- **Manual** — user typed `/handoff`. Report findings when done.
- **Silent (via PreCompact hook)** — the hook injected a `systemMessage` directive. Complete the work, then reply `NO_REPLY` (no user-facing prose).

Default to manual unless the systemMessage context indicates otherwise.

## 1. Current state (captured at invocation)

Today's date, LOCAL — this mechanically pins the §8 date rule; use it verbatim for frontmatter + body dates:

!`date +%Y-%m-%d`

Working tree:

!`git status --short 2>/dev/null || echo "(not a git repo)"`

Recent commits:

!`git log --oneline -10 2>/dev/null || echo "(no git history)"`

Commits ahead of origin/main:

!`git rev-list --count HEAD ^origin/main 2>/dev/null || echo "(no upstream)"`

Operator session notes (fold into the handoff; may be empty):

$ARGUMENTS

If the session touched runtime-facing code, gather minimal verification (the latest `bun run build` / `bun run lint` / `bun test test/` result; a `the TypeScript language server` reachability output if a wiring claim is in flight). Only what's relevant to "what changed this session." Don't over-fetch.

**Disposition uncommitted non-doc WORK explicitly.** If the working tree above shows uncommitted changes outside the doc surfaces, name them in the handoff — working-tree state in §3's status rewrite plus a disposition line in §8's Immediate next steps: coherent → recommend the operator commit them as their own WORK commit; not yet coherent → record them explicitly as WIP. Never let work changes ride silently into a docs commit, and never commit them yourself (§9 — auto-commit stays forbidden).

### 1.4 Pull the latest sitrep (consume the zero-loss checkpoint)

The anti-naive-summarization tier lives in `checkpoints/` (`/sitrep`), not in this skill. Find the newest checkpoint:

```bash
ls -t .agent-docs/checkpoints/*.md 2>/dev/null | head -1
```

If a `/sitrep` post-dates the current `handoff.md`, READ it — it holds the dead-ends, the rejected alternatives, and the exact in-flight pause point that a naive session summary drops. Fold its content into the handoff's §Anti-assumptions (point 6) and §Detour-chain (point 6 below). The handoff is the curated bridge; the sitrep is the forensic record it draws from. If the session did substantial investigation and NO sitrep exists, consider writing one (`/sitrep`) BEFORE regenerating the handoff so the dead-ends are captured at full fidelity.

## 2. Archive existing handoff (if it exists)

```bash
if [ -f .agent-docs/now/handoff.md ]; then
  TS=$(date -u +%Y-%m-%d-%H%M%S)
  SLUG=$(grep -m1 '^# ' .agent-docs/now/handoff.md \
    | sed 's/^# //; s/—.*//' | tr '[:upper:]' '[:lower:]' \
    | tr -c 'a-z0-9\n' '-' | sed 's/--*/-/g; s/^-//; s/-$//' | cut -c1-40)
  mkdir -p .claude/handoffs
  cp .agent-docs/now/handoff.md ".claude/handoffs/${TS}-${SLUG:-handoff}.md"
fi
```

(Archive filename uses UTC — machine-sortable. Frontmatter dates below use LOCAL — see §8.)

## 3. Rewrite `.agent-docs/now/status.md` in place

Fleeting — overwrite (target 80-120 lines): TL;DR · Branch · Build/runtime state (delta) · Phase status table (if mid-procedure) · Working tree · Gates (`bun run build`/`bun run lint`/`bun test test/`) · Doc/context system · What this means for next steps. Update `last-modified` (local).

## 4. Update `.agent-docs/now/work-plan.md`

Mark completed items ✅; surface the IMMEDIATE NEXT ACTION at the top; update `last-modified`.

## 5. Update `.agent-docs/now/open-questions.md`

Move resolved questions to "Recently resolved" with a closure reference (commit / `ADR-NNNN` / log entry); add newly-surfaced questions; update `last-modified`.

## 5.5 Sweep the obligations ledger (ADR-0012)

Inter-party debts move on their own clock, faster than this handoff regenerates — sweep them explicitly so none dies at compaction. This step runs BEFORE §8's handoff regeneration (it sits here between §5 and §6), so the ledger is trued up first.

**Where the ledger lives — branch on the runtime fact:** **if `now/obligations.md` exists** (the multi-party form), sweep that file; **otherwise the handoff's `## Obligations` section** (§8.5) IS the ledger — sweep it instead. Same schema, same safety floor either way — `obligations.template.md` is the single authority; do not restate its columns here.

**Snapshot before mutating.** When the file form is present, copy `now/obligations.md` into `.claude/handoffs/` beside the §2 handoff archive — a compaction firing mid-sweep must not leave a trusted half-written table. Write each row ATOMICALLY: never add an owed-to-me row missing its `Trigger/by-when` or `Default-if-silent` cell.

Walk the WHOLE session (not just the tail). **Materiality gate on every new row:** a row needs a NAMED deliverable + an identified counterparty + a trigger. Discard conversational hedges and pleasantries ("I'll take a look", "sure, sometime") — a phantom row is worse than a missed one; when commitment strength is ambiguous, file SOFT, never HARD.

**Session-boundary fast path (framework-rationale/0012 amendment):** an obligation both MADE and SETTLED within THIS session — before this `/handoff` runs — needs no row ceremony; record it as a single `log.md` line (folded into §6) instead of the full open → strike → journal → prune lifecycle. Rows are for debts that OUTLIVE the session boundary this ledger exists to protect; a same-session debt never crossed it. **Gate-safety overrides this:** an operator- or authorization-gated wait (approval / sign-off / release / deploy / merge) gets a row regardless of expected lifetime — the row is the durable proof the gate was respected.

- **New debts** — every concrete "I'll draft / I'll send / next I'll…" deliverable you promised a counterparty → an **Owed-by-me** row: *Counterparty · What · Class (HARD gates THE COUNTERPARTY's work / SOFT) · Due/trigger · Source (where you said it)*.
- **New receivables** — every promise a counterparty made you, and every point you are now BLOCKED waiting on someone → an **Owed-to-me** row: *Counterparty · What · Class (HARD gates MY work / SOFT) · Trigger/by-when · Default-if-silent · Source*. It MUST carry a parseable **Trigger/by-when** AND a **Default-if-silent** — `chase-once` · `apply-default` · `never-chase-never-peek`; do not file one without both. **Gate safety:** if the row is HARD and its counterparty is the operator, or its deliverable is an authorization (approval / sign-off / release / deploy / merge), `apply-default` is FORBIDDEN — use `chase-once` or `never-chase-never-peek`; an agent must never leave a rule that self-authorizes a gate crossing at cold-start. Its **Source** cites the promise's provenance — a comms-log **message id** (file form) or a **commit / PR / issue link / dated conversation note** (`obligations.template.md`'s Source legend carries both species); this is what `/orient` looks the receivable up by when it checks whether the deliverable landed.
- **Settlements** — every row whose deliverable arrived (or whose trigger passed) → strike it through IN PLACE with a settlement stamp (date + Source), keep it THIS cycle so the next `/orient` surfaces it; then journal the PRIOR cycle's settled rows into this handoff's `log.md` entry (§6) and PRUNE them from the ledger. Never silently delete a row — the log entry is the preserved audit trail (the explicit carve-out to never-delete-silently).
- **Tripwires** — any flip-condition you are watching that no counterparty owes → the Tripwires block, POINT-ONLY: cite the `RV-`/`DEFER`/`WU-` id, don't restate its action.
- **Non-overlap** — a row POINTS at an `OQ-`/`WU-`/`REV-`/DEFER by id; it never duplicates one (ADR-0012; discipline, not lint-checked).

Update `last-modified` on the ledger surface you swept (`now/obligations.md`, or the regenerated `handoff.md`).

**When there is no `now/obligations.md`** (single-party / Minimal, or a Standard install carrying the section form): maintain the SAME content — same schema (single source: `obligations.template.md`), same Trigger + Default-if-silent requirement, same gate-safety rule — as a lighter `## Obligations` bullet section inside the regenerated `handoff.md` (§8.5). Capturing only at this handoff cadence (lower fidelity than the standalone file) is the accepted single / low-party trade.

## 5.6 Room-thread continuity sweep (multi-party installs only)

Applies ONLY when this install coordinates with other agents through a shared comms layer
(a room / channel / append-only agent-comms log — the same conditionality PATTERN as
§5.5's file-form branch, keyed on its own runtime fact: the comms layer's existence).
No comms layer → skip entirely; the regenerated handoff carries no Room-threads section.

Obligations rows carry the DEBTS; this sweep carries the CONVERSATIONS. A live design or
coordination thread is state the ledger's rows do not preserve — who leads, what has
converged, what may not be re-litigated, which message you answered last. Post-compaction,
an agent that rejoins a fast-moving thread from a stale frame posts confidently-wrong
content into it; that is the exact failure this section exists to prevent.

For EACH live thread (a conversation mid-exchange where you hold a role or owe a future
response — a settled thread gets a `log.md` line, never a section):

- **Thread + one-line subject** — what is being designed or decided.
- **Participants + locked roles** — who leads, who owns which deliverable, and YOUR role
  with its current status (delivered / owing / on-hook).
- **Message anchors** — the id of YOUR last post + the last inbound id you processed
  (these are the re-read lookup keys).
- **Your standing hooks** — the specific future events that re-activate you (a
  counterparty's build closing, a review landing) and what you do when each fires.
- **Durable-base pointers** — where the thread's converged state lives ON DISK (your
  surfaces and theirs), pointers only: carry the paths, never re-inline the content
  (flush-safe — the durable docs hold the frame; prose copies rot).
- **Converged / do-not-relitigate markers** — anything the thread has settled that a
  fresh session must not reopen.
- **THE RE-READ RULE (copy it verbatim into the section — load-bearing):**
  post-compaction or cold-start, BEFORE posting anything into the thread, re-read the
  comms log since this handoff's timestamp PLUS your own last post and all replies to it.
  A post made from a stale frame is the confident-wrong failure mode; the re-read is
  cheap, the wrong post is not.

## 6. Append entry to `.agent-docs/log.md`

Newest at top: `## [YYYY-MM-DD] handoff | <one-line session summary>` + 2-3 lines. Plus discrete `decision | ...`, `memory | ...`, `ingest | ...` entries as warranted.

## 6.5 Conversation-residue sweep (knowledge that lives ONLY in the conversation)

Steps 3-6 cover `now/*` + `log.md`. Long sessions accumulate knowledge that belongs to OTHER surfaces and is silently lost otherwise. Walk this checklist:

1. **Business/contractual/product facts spoken by the operator** → `memories/` doc. A requirement that lives only in chat is invisible to every future workflow/context pack.
2. **Corrections/reversals to filed docs decided in conversation** → edit the doc IN PLACE, dated (never silently rewrite, never leave it wrong).
3. **Operator rulings ledger** — scan the WHOLE session (not just the tail) for decisions the operator made; each lands in `work-plan` (decisions table) + feeds handoff.md §Recent decisions. Intent statements count ("we're planning to X").
4. **Promised-but-unfiled items** — anything you said "I'll draft / queued / next batch": do it now or file it as an explicit work-plan/OQ line.
5. **Analyses/research still only in ephemeral / temp-dir output files** → a `research/<R-id>/` tier file (Full profile) or a `reference/` doc, with provenance + `sources:` front-matter. **These are EPHEMERAL — temp dirs clear.** Rescue any raw material with residual value beyond what a synthesis already captured.
6. **Secrets/keys/regulated or user data that transited the conversation** → OQ or ops-note for rotation/handling consideration.
7. **Anti-assumptions / traps** → feed §Anti-assumptions (below). Every place the OBVIOUS read was WRONG.
8. **Findings your own tooling surfaced about your OWN code this session** (a linter/analyzer/code-intel result, a `the TypeScript language server` dead-code or reachability flag) not yet filed → a `memories/` claim or an `OQ-`.
9. **Reusable recipes / verification gates** discovered → into §Immediate-next verbatim (+ a `reference/` doc if substantial).
10. **Hands-on artifacts / scratch prototypes built OUTSIDE the repo** (scratch dirs, throwaway packages, spike harnesses, prototype scripts) → handoff.md §Breadcrumbs with location + pass/fail verdict + keep-or-clean; promote a durable spike to `experiments/` (Full profile). They live in no git tree and are silently lost otherwise.
11. **Environment / build recipes that worked** (the exact incantation — env vars, flags, toolchain/version pins, lib paths) → capture **VERBATIM as a labeled, greppable block** (handoff.md §Immediate-next or a `reference/` runbook). The recipe IS the reproducibility; a prose summary is not.
12. **Current live-runtime state a fresh agent would naively trust but shouldn't** — a stale/empty index or cache, a running server holding a port/lock, a built-but-stale binary, a backgrounded job mid-flight, an ephemeral scratch artifact already gone → capture the CURRENT condition + the workaround → §Anti-assumptions. Distinct from a build recipe (item 11): not "how to build" but "what is true about the running system *right now* that will silently mislead the next agent."

The PRIMARY defense is capture-at-the-moment (`/flush`); this sweep is the net.

### 6.5a Multi-agent residue (OPTIONAL — only if you dispatched sub-agents or ran workflows this session)

Multi-agent dispatch / workflow sessions accumulate fan-out provenance that dies at compaction. If you ran none, skip this sub-block.

- **Ledger the completed dispatches** — a short table of `runId / FR-NNNN → what it built → status (pass/fail/resumed) → what landed → verdict (IMPL/WIRED/DEFER)`. Durable leverage for audit, cost, and resume. Fold into §Detour-chain or §Recent commits. Record resume mechanics verbatim (the persisted script path + the resume-from-run id) — cached agents replay; only edited/failed agents re-run.
- **Disposition each in-flight background task/workflow** — done+filed, kill, or carry into §Immediate-next with resume mechanics. **AND for each, capture POST-COMPLETION SCRUTINY — what THIS session knows to verify or distrust in the workflow's RESULT that a fresh-orient agent would not:** result-integrity checks (did the agents' claimed file-writes actually land? did an edit-capable agent mutate the shared worktree — `git status` the relevant paths?), known confounds in the output's metrics, and "trust X not Y" caveats earned by direct experience. Resume mechanics tell the next agent HOW to continue; this tells them WHAT to disbelieve.
- **Un-verified dispatches + dangling traceability** — any dispatch-charter (`FR-NNNN`) / sub-agent / workflow leg that returned but was never verified (the `/debrief` step, Full profile) → verify it now (or carry an explicit "debrief pending" line into §Immediate-next). Any work-unit sitting at `IMPL` (not `WIRED`) in `traceability/` without a `DEFER` rationale → flag it; an unwired claim is the #1 recurring trap. **HARD DRAIN — not headline-level: for EACH completed workflow/agent, OPEN its `discoveries[]` / out-of-scope return field and confirm EVERY item (not just the loud ones a synth/review surfaced) has a durable home (`OQ-` / register row / lesson).** The less-prominent items buried in a build or recon agent's `discoveries[]` are exactly what a headline read misses — drain item-by-item. **RE-VALIDATE DEFERRAL POINTERS:** any "do at X" forward-pointer whose target wave/WU/phase has since COMPLETED is now orphaned → re-home it to a LIVE trigger. **BIDIRECTIONAL IDs:** filing `OQ- → WU-` owes the reverse `WU- → OQ-` back-reference, so the target WU surfaces it when worked.

## 6.6 Index lint (OPTIONAL — Standard profile only)

If the doc linter hook is installed (Standard profile), run `python3 .claude/hooks/lint-docs.py --root .agent-docs`. `/handoff` is the thorough checkpoint: fix EVERY reported drift across all managed dirs (entry shape per the `CONVENTIONS.md` index template; carry-away must be traceable — write the entry WITHOUT one rather than guess). Append a `lint | ...` op line to `log.md` when fixed. If the hook isn't installed, skip this step.

## 7. Lesson reflection (two-step gradient + per-entry review)

`/handoff` is the promotion gate for the lessons ledger (`lessons/`, CONVENTIONS §1 · `templates/lesson-template.md`). Two-step gradient prompting mitigates same-model reflection failure modes (mode collapse, confirmation bias).

- **7a — Critique-only:** "What didn't go well this session? Surprises, near-misses, failures, instincts that turned out wrong. Do NOT propose changes — just enumerate." Write to a transient buffer.
- **7b — Propose-only:** Given 7a, "What (if anything) should enter the lessons ledger? For each: Trigger, Claim, Evidence." Append 0–3 qualifying candidates to `.agent-docs/now/lessons/proposals.md` (`provenance: llm-draft`, `maturity: seedling`). If a lesson-distillation pass already ran this session, use its proposals. If none qualify, that's fine — don't lower the bar.
- **7c — Per-entry review with the user:** for each proposal, surface id + one-line claim + severity; ask **accept / defer / reject**. Accept → move to `.agent-docs/lessons/<id>.md`, add a `lessons/index.md` entry (+ a `now/lessons/MOC.md` row if Tier-1). Defer → keep in proposals. Reject → remove + log a one-line reason. **Silent/hook mode:** do NOT auto-promote; leave proposals for the next manual `/handoff`.
- **7d — If mode-collapse:** if 7b just restates 7a, escalate to a separate critic subagent.

## 8. Regenerate `.agent-docs/now/handoff.md`

THE load-bearing artifact. **Date rule:** `date +%Y-%m-%d` (LOCAL) for frontmatter + body dates — the interpolated date at the top of §1 IS this value; UTC only for the archive filename in §2.

Frontmatter: `provenance: llm-reviewed`, `created`/`last-modified` (local), `tags: [current, handoff, session-state]`, `related: [status, work-plan, open-questions]`, `generator: /handoff`.

Sections:

1. `# Session handoff — READ FIRST` (with date)
2. `## Project in one paragraph` — repo, branch, current initiative
3. `## Current state summary` — paragraph + phase status table if mid-procedure
4. `## Important context` — decisions with rationale, standing rules, gotchas the next agent MUST know. **Reference ADRs / memories / runbooks by ID** rather than duplicating.
5. `## ⚠️ Anti-assumptions / traps` — **REQUIRED, load-bearing.** The single best defense against "leaving room for assumptions." Every "looks like X → actually Y" from the session: corrected inference errors, misleading names, cross-layer drift the obvious grep misses, dead-looking-but-load-bearing units, tooling traps. Wrong-inference + correction + evidence. If the session genuinely surfaced none, scan the touched units anyway; "none" is a rare valid answer, not a skip.
6. `## Detour-chain` — **REQUIRED.** The side-quest map (MAIN objective → each nested side-quest: what spawned it → what it found → resolved/open), so the next agent can climb back to the main thread.
7. `## Immediate next steps` — concrete, with specific paths, commands, confirmation gates. Load-bearing for resume. For any in-flight / just-completed workflow carried forward (if you ran any), add a **verify-AFTER-the-workflow block**: the result-integrity checks + metric confounds + "trust X not Y" caveats the next agent must apply to its output (not just resume mechanics). Include any reusable **env/build RECIPE** / verification GATE discovered as a **labeled, greppable verbatim block**.
8. `## Recent decisions made` — table: when, decision, rationale/reference.
8.5. `## Obligations` — **present ONLY when `now/obligations.md` does NOT exist** (if the standalone file exists it is the ledger, ADR-0012, and this section is omitted). Carry the SAME schema as `obligations.template.md` — the single authority; do NOT restate columns that could drift from it — rendered as a compact bullet list, not the full tables: a **Waiting on (owed to me)** list (each bullet: *counterparty · what (may cite an id) · HARD (gates MY work) / SOFT · @trigger · default-if-silent* — Trigger + default-if-silent mandatory; no `apply-default` on an operator / authorization row) and an **I owe (owed by me)** list (*counterparty · what · HARD (gates THE COUNTERPARTY's work) / SOFT · due/trigger*), plus a one-line Tripwires note (POINT at an id) and a Settled line (journaled to `log.md`, then pruned). Rows point at `OQ-`/`WU-`/`REV-` ids, never duplicate them.
8.6. `## Room-threads` — **present ONLY on multi-party installs with ≥1 live thread**
     (§5.6 is the sweep that populates it; omit the section entirely otherwise). One block
     per live thread carrying the §5.6 fields — participants + locked roles, your role +
     status, message anchors, standing hooks, durable-base pointers, do-not-relitigate
     markers, and the re-read rule verbatim. This is the section `/orient`'s room-thread
     resume step reads BEFORE the agent touches the comms layer.
9. `## Breadcrumbs / artifacts` — scratch dirs / spike harnesses built outside the repo (location + verdict + keep-or-clean); ephemeral / temp-dir outputs + their durable transcript paths + resume commands. Things that live in no git tree.
10. `## Reading order` — pointer at status/work-plan/open-questions/CLAUDE.md **+ the latest `checkpoints/` sitrep if one post-dates this handoff** (it is the zero-loss forensic record — the handoff curates; the sitrep preserves the dead-ends at full fidelity).
11. `## Recent commits` — head of branch (last 5). (Dispatch-heavy session? Fold the §6.5a ledger here.)

Footer: "How to refresh this file" → `/handoff`. Length: 120-200 lines (anti-assumptions + detour-chain earn the extra length).

### Eject/migration mode (OPTIONAL — when the operator signals context will move repos)
When part of the context belongs in a DIFFERENT repo (a new meta-repo, a sibling project), §Immediate-next becomes an **EJECT INVENTORY**: (a) the explicit what-moves list (docs by path + now/* slices), (b) what STAYS, (c) the **move caveats** — fix cross-doc path/ID references, preserve `provenance:`/`sources:` front-matter, re-run the index lint in BOTH repos after, **copy-then-verify before deleting** (the source working tree may be the only copy if uncommitted). The handoff CAPTURES the eject plan; a later session EXECUTES it — do NOT eject during the handoff unless told to.

## 9. Report

**Manual:** "N files updated; previous handoff archived to `<path>`" + one-line summary per file + "Recommended next: review, then commit — WORK changes and doc updates as SEPARATE commits, never blended (don't auto-commit either)."
**Silent (hook):** reply literally `NO_REPLY`.

**DO NOT auto-commit in either mode.**

## Anti-patterns

- Do NOT run mid-destructive-operation. Wait for a natural checkpoint.
- Do NOT let "immediate next action" be vague. Specific paths + commands + gates.
- Do NOT duplicate ADR/memory content — reference by ID.
- Do NOT auto-commit. Do NOT skip the archive step. Do NOT include secrets or regulated / user data.
- Do NOT recommend blending WORK changes and doc updates into one commit — separate commits, always (and you make neither).

## Design rationale

The session-lifecycle contract + the residue-sweep and lesson-gate disciplines live in `standing-rules-core.md` (§Context lifecycle, §Findings-decisions-and-review-feedback-to-disk) and `CONVENTIONS.md` (§6 checkpoint contract this skill consumes, §1 lessons ledger). Git state and today's LOCAL date are pulled at invocation via the shell-interpolation blocks in §1, so the handoff is written against current reality (and the date rule is pinned mechanically, not by convention alone). Work/doc commit separation is operator GUIDANCE layered on the never-auto-commit rule, not a loosening of it: the skill recommends the split; the operator makes every commit.
