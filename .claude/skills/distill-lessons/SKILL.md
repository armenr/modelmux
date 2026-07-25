---
name: distill-lessons
description: Surface candidate lessons (or near-misses) from recent log.md journal entries + session activity — scanning for false-beliefs, over-generalizations, staleness, tool-failures, and near-misses. Writes proposals to .agent-docs/now/lessons/proposals.md for two-step human-gated promotion (maturity seedling→budding→evergreen; provenance llm-draft→llm-reviewed). Use after a failed-then-fixed pattern, a surprising discovery, a runbook's first run, or as part of /handoff.
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
allowed-tools: Bash(tail:*), Bash(cat:*), Bash(grep:*), Bash(git log:*), Read, Write, Edit
---

# /distill-lessons — surface candidate ledger entries

Run after a meaningful chunk of work (a commit, an ADR write, a design discussion, a
failed-then-fixed pattern) to extract candidate entries for the append-only lessons ledger. Output
goes to `.agent-docs/now/lessons/proposals.md` — **promotion to `.agent-docs/lessons/<slug>.md` is
human-gated** (a load-bearing discipline; if you formalize it, record it as an ADR). This skill NEVER
writes into `lessons/` directly.

**Foreground in the main agent.** Context-capture skills don't background cleanly (same reasoning as
`/flush`): the session state they read from is the live conversation.

---

## Recent journal entries (last 50)

!`tail -50 .agent-docs/log.md 2>/dev/null || echo "(no log.md yet)"`

## Existing Tier-1 lessons MOC (for the dedup check)

@.agent-docs/now/lessons/MOC.md

## Existing proposals (don't duplicate)

@.agent-docs/now/lessons/proposals.md

---

## Steps

### 1. Review the inputs above

The shell-interpolated `tail -50` gives you the fresh journal. The `@`-imports show what's already in
the Tier-1 MOC and staged as a proposal — that is your dedup baseline. If a candidate is already
covered by a MOC row or an existing proposal, skip it.

### 2. Scan the session for the five candidate TYPES

Walk the recent work through each lens (the `type:` axis of `templates/lesson-template.md`). Most
sessions surface zero to a few — that is fine:

- **false-belief** — you (or an agent) acted on something that turned out not to be true. "I assumed
  X; the tree/tool/docs said Y." The correction is the lesson.
- **over-generalization** — a rule or pattern applied where it didn't hold; the boundary condition
  you hit is the lesson.
- **staleness** — a fact, version, or path that was right once and has drifted; what you now trust
  instead, and how you'd detect the drift next time.
- **tool-failure** — a tool/command/agent that failed, misreported, or needed a workaround; the
  reliable path forward.
- **near-miss** — something expensive *almost* happened and a specific save caught it; the
  reliable-save is the lesson (not the luck).

### 3. Keep only candidates that meet ALL of the bar

For each candidate, verify it meets **all** of:

- **Concrete trigger** — one sentence naming the condition that fires this lesson (the paths,
  commands, or error signatures that say "this is happening now").
- **Stable claim with consequence-rationale shape** — "When X, do Y because Z" (lesson), or "X almost
  happened; Z saved us; the reliable-save is Y" (near-miss).
- **Evidence link** — a `log.md` timestamp / commit SHA / `ADR-NNNN` / `INC-NNN` — REQUIRED to
  promote past the `seedling` stage.
- **Not a duplicate** — neither the slug nor the underlying claim appears in the MOC or
  `proposals.md`.

If you can't identify any candidate meeting all four, that's a fine answer. **Don't lower the bar** —
better zero high-quality proposals than three weak ones.

### 4. For each surviving candidate, append a draft proposal

Append to `.agent-docs/now/lessons/proposals.md` (NOT to `lessons/`). Use the
`templates/lesson-template.md` schema. **This skill always writes `provenance: llm-draft` and
`maturity: seedling`** — the two-step promotion is somebody else's gate, not yours:

- **Axis 1 — maturity: `seedling` → `budding` (applied at least once) → `evergreen` (recurred 3+; earns
  a Tier-1 MOC row).** You only ever emit `seedling`.
- **Axis 2 — provenance: `llm-draft` → `llm-reviewed` (operator signs off on the claim) → `human`
  (substantially rewritten).** You only ever emit `llm-draft`.

Default `severity: low`. Reserve `high` for could-have-been-production-critical. For a near-miss, keep
the near-miss body variant (`## What almost happened` / `## What made the save reliable` /
`## Recurrence count`) and delete the plain-lesson sections.

**Possible MOC row.** If a candidate's claim already looks like it has recurred 3+ times (you can see
the repetitions in the journal), note in the proposal body that it is an *evergreen candidate* — a row
for `now/lessons/MOC.md`. Do **not** add the MOC row yourself; flag it for the human gate.

### 5. Surface to the user

- "/distill-lessons surfaced N candidates → written to `.agent-docs/now/lessons/proposals.md`"
- One line per candidate: its `type` + its claim.
- "Review at the next /handoff for accept / defer / reject (and any promotion)."

If N=0: "/distill-lessons reviewed the last 50 journal entries; no candidates meet the promotion
criteria right now."

---

## When to invoke

- After a work session that surfaced something future-you would benefit from remembering.
- After a **failed-then-fixed** pattern (these almost always make good lessons).
- After running a runbook procedure for the first time (the gaps you hit on first run are the lesson).
- Periodically as part of `/handoff` (which can call this internally — but standalone is fine).

## Anti-patterns

- **Do NOT promote directly to `.agent-docs/lessons/`.** Proposals only. The human gate is the point.
- **Do NOT inflate severity.** Default `low`; `high` = could-have-been / was production-critical.
- **Do NOT write lessons that are really runbooks** (a procedure → `runbooks/`) **or really ADRs** (a
  decision with alternatives → `decisions/`). A lesson = observed pattern + mitigation.
- **Do NOT include secrets, credentials, or regulated / user data** — reference a path, never a value.

## Design rationale

The lessons ledger is the `LP-NNN` spine (`CONVENTIONS.md` §4) with the three-axis front-matter
(provenance × maturity × severity) and the five `type` discriminators (`templates/lesson-template.md`).
Human-gated promotion exists because an unreviewed auto-promoted "lesson" is as likely to encode a
one-off accident as a durable pattern — the review is what separates the two. Fresh journal content is
pulled at invocation via the shell-interpolation block above, so the skill always sees current reality
rather than a stale snapshot.
