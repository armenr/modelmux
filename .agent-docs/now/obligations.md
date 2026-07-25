---
provenance: llm-reviewed
created: 2026-07-10
last-modified: 2026-07-25
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
| operator | ruling on `CLAUDE.md` machine-specific paths in the PUBLIC repo (`OQ-003`) | SOFT | before the next release cut | chase-once — silence = leave as-is and re-raise at the cut; do NOT edit the partyline-managed marker block unilaterally | conversation 2026-07-25 ("are you wiring up configs that will only work on this computer?") |
| fieldbook | comes to me at kit cut-time to use this tree as the settings deep-merge test case | SOFT | fieldbook's next kit cut | never-chase-never-peek — silence = they cut without it; nothing of ours is blocked | room msg `683fbb1b` + their acceptance (2026-07-25) |

## Owed by me (debts)

> A debt you control has no silence problem — its risk is a *missed trigger*, so column 4 is the
> due-point (a stage, an event, a date), not a silence rule.
>
> **Class:** HARD = gates the COUNTERPARTY's work (they are blocked on my delivery) · SOFT = does not.

| Counterparty | What (may cite an id) | Class | Due / trigger | Source |
|---|---|---|---|---|
| operator | ruling on `OQ-003` — machine-specific partyline paths in the PUBLIC `CLAUDE.md` | HARD | before the next release cut | conversation 2026-07-25 — the last open OQ; `partyline wire` offers no alternate target, so every option is a real trade |

## Tripwires (watched — nobody owes)

> Conditions that flip a decision but that no counterparty is on the hook for. Watch, don't chase.
> **POINT-ONLY:** cite the `RV-` / `DEFER` / `WU-` id whose flip-condition you are watching; do NOT
> restate that trigger's action here (the cited row holds it). At Full these graduate to typed `RV`
> anchors (ADR-0007).

- OpenAI's Codex endpoint stops returning `circuit_open` → see `OQ-001` (unblocks acceptance testing)
- the Codex `access_token` passes its 2026-07-28 expiry → see `OQ-002`
- fieldbook ships the rule-21 extractor fix (upstream OQ-055) → re-run doc-lint here to confirm the
  latent-on-Standard case clears

## Settled (do not re-chase)

> Settling = **strike the row AND move it into THIS section in the same edit** (the strike marks it,
> the move keeps the live tables scannable), stamped (date + Source), kept for ONE cycle so `/orient`
> can surface "settled while away". Then it is **journaled to `log.md`** (folded into the `/handoff`
> log entry — the permanent append-only record) and **pruned** from this file, so this section stays
> bounded. The Settled entry is deliberately a compact BULLET (counterparty · what · stamp · Source),
> not the full table row — an audit stub; column-level fidelity lives in the journal entry. Never
> *silently* delete a row — the log entry is the preserved audit trail; a row that vanished with no
> journal entry reads as a *dropped* obligation, not a discharged one.

- ~~fieldbook · install report card (kit-version, profile, manifest, doc-lint COUNT)~~ — SETTLED
  2026-07-25 (delivered; accepted, and finding 1 booked upstream as a kit defect) — room msg `683fbb1b`
- ~~partyline · audit of this repo's partyline install/config~~ — SETTLED 2026-07-25 (delivered; ruled
  SOUND, cursor-seeding ruled correct) — room msg `98896e54`
- ~~operator · ruling on the `OQ-002` token-refresh fork~~ — SETTLED 2026-07-25: operator said "knock
  those out", option (b) implemented (fail loud on 401 with the remedy) — commit `df9347b`
- ~~operator · ADR-0003 + README Codex fix + PR #15 retitle, then commit WU-0003~~ — SETTLED
  2026-07-25, all four delivered; README scope was 5 stale spots not 1, incl. a false security claim —
  commits `7ef2d4c`, `fd08a9a`
- ~~fieldbook · the two citing file paths for `0014-docs-impact-gate` / `0012-obligations-ledger`~~ —
  SETTLED 2026-07-25 (answered NONE, reference-field grep run with a positive control; accepted and
  recorded as mine-or-nobody's) — room msg `e088ccf0`, their ack in the 09:43:44Z broadcast
