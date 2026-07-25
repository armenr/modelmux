---
provenance: kit-template
created: 2026-07-10
last-modified: 2026-07-10
tags: [current, obligations]
related: [status, work-plan, open-questions, handoff]
---

# Obligations — modelmux

…<!-- example:end -->` block on first
     real use. -->

> Inter-party debts, both directions: what you OWE counterparties and what they OWE you — **plus what
> to do when a counterparty goes silent**. Tier-1: read at session start, UPDATE-IN-PLACE (`/flush`
> mid-session, swept by `/handoff`, deltas surfaced by `/orient`).
>
> **Rows are for debts that OUTLIVE a session** — that boundary is the whole reason this surface exists:
> to carry an obligation across the compaction / session-end gap where conversation is lost. An
> obligation both MADE and SETTLED within ONE session, before any `/handoff` runs, may take a single
> `log.md` line instead of the full row lifecycle (open → strike → journal → prune); a debt that will
> still be open at the next session boundary gets a row. **Gate-safety is unconditional:** an operator-
> or authorization-gated wait (approval / sign-off / release / deploy / merge) takes a row regardless of
> its expected lifetime — the row is the durable record that the gate was respected (framework-rationale/0012 amendment).
>
> A row **POINTS at** an `OQ-` / `WU-` / `REV-` / DEFER by id — it never **duplicates** one. `OQ-NNN`
> is the open question; an obligation row is the *who-owes-whom* + the *silence rule*. A counterparty
> is another agent, another repo, or the operator. (This "point, don't duplicate" join is discipline,
> not lint-checked — honor it or the joins rot.)
>
> **Source column (both tables) — the promise's provenance, in one of two species:** an agent-comms
> **message id** (the coordination log's own id, on a multi-party install) **|** a **commit SHA / PR /
> issue link / dated conversation note** (on a single-party install, or for an operator / external
> counterparty). Distinct from this file's front-matter `provenance:`. `/orient` looks a row up by its
> `Source` when it checks whether the deliverable landed — so a row with no resolvable Source can settle
> but can't be *verified* settled.

## Owed to me (receivables)

> Every row MUST carry **both** a parseable **Trigger/by-when** (the point at which silence becomes
> actionable — a stage, an event, a date; without it a receivable can never come due and rots unstruck)
> and a **default-if-silent** (the pre-decided rule *at* that trigger). Canonical default-if-silent
> values: **chase-once** (one ping at the trigger, then a recorded fallback) · **apply-default**
> (proceed on a pre-decided fallback, no chase) · **never-chase-never-peek** (silence = a specific
> recorded disposition; for fenced / operator-keyed rows).
>
> **Gate safety (hard rule):** `apply-default` is FORBIDDEN on a HARD row whose counterparty is the
> operator, or whose deliverable is an authorization (approval / sign-off / release / deploy / merge).
> Such rows MUST use `chase-once` or `never-chase-never-peek` — never auto-proceed past a gate.
>
> **Class:** HARD = gates MY work (I am blocked) · SOFT = does not.

| Counterparty | What (may cite an id) | Class | Trigger / by-when | Default-if-silent | Source |
|---|---|---|---|---|---|
<!-- example:start · delete these rows on your first real entry — lint rule 17 skips table rows between these markers -->
| repo-b | the shared event-schema doc (blocks `OQ-014`) | HARD | Stage-2 start | chase-once, then apply-default: proceed against the v1 schema and file the drift as a new `OQ-` | msg 7f3a-c2 (2026-07-08) |
| operator | release-or-hold on the fenced experimental flag | SOFT | before the demo cut | never-chase-never-peek — silence = "held, operator-keyed, no action" | charter §4 |
<!-- example:end -->

## Owed by me (debts)

> A debt you control has no silence problem — its risk is a *missed trigger*, so column 4 is the
> due-point (a stage, an event, a date), not a silence rule.
>
> **Class:** HARD = gates the COUNTERPARTY's work (they are blocked on my delivery) · SOFT = does not.

| Counterparty | What (may cite an id) | Class | Due / trigger | Source |
|---|---|---|---|---|
<!-- example:start · delete this row on your first real entry — lint rule 17 skips table rows between these markers -->
| repo-c | the migration runbook I promised (`WU-0031`) | HARD | before repo-c's cut-over rehearsal | log 2026-07-08 — "I'll draft the runbook" |
<!-- example:end -->

## Tripwires (watched — nobody owes)

> Conditions that flip a decision but that no counterparty is on the hook for. Watch, don't chase.
> **POINT-ONLY:** cite the `RV-` / `DEFER` / `WU-` id whose flip-condition you are watching; do NOT
> restate that trigger's action here (the cited row holds it). At Full these graduate to typed `RV`
> anchors (ADR-0007).

<!-- example:start · delete on your first real entry -->
- the deferred index-split lands → see `WU-0042` (its flip-condition reopens the doc-size-cap decision)
- a second consumer adopts the API → see the versioning `DEFER` row in traceability
<!-- example:end -->

## Settled (do not re-chase)

> Settling = **strike the row AND move it into THIS section in the same edit** (the strike marks it,
> the move keeps the live tables scannable), stamped (date + Source), kept for ONE cycle so `/orient`
> can surface "settled while away". Then it is **journaled to `log.md`** (folded into the `/handoff`
> log entry — the permanent append-only record) and **pruned** from this file, so this section stays
> bounded. The Settled entry is deliberately a compact BULLET (counterparty · what · stamp · Source),
> not the full table row — an audit stub; column-level fidelity lives in the journal entry. Never
> *silently* delete a row — the log entry is the preserved audit trail; a row that vanished with no
> journal entry reads as a *dropped* obligation, not a discharged one.

<!-- example:start · delete on your first real entry (a settlement, before it folds to log.md) -->
- ~~repo-b · shared event-schema doc~~ — SETTLED 2026-07-09 (received; filed as `reference/event-schema.md`; closes `OQ-014`) — msg 9c1d-40
<!-- example:end -->
