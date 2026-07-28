---
provenance: llm-reviewed
created: 2026-07-10
last-modified: 2026-07-26
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
| fieldbook | comes to me at kit cut-time to use this tree as the settings deep-merge test case | SOFT | fieldbook's next kit cut | never-chase-never-peek — silence = they cut without it; nothing of ours is blocked | room msg `683fbb1b` + their acceptance (2026-07-25) |

## Owed by me (debts)

> A debt you control has no silence problem — its risk is a *missed trigger*, so column 4 is the
> due-point (a stage, an event, a date), not a silence rule.
>
> **Class:** HARD = gates the COUNTERPARTY's work (they are blocked on my delivery) · SOFT = does not.

| Counterparty | What (may cite an id) | Class | Due / trigger | Source |
|---|---|---|---|---|

## Tripwires (watched — nobody owes)

> Conditions that flip a decision but that no counterparty is on the hook for. Watch, don't chase.
> **POINT-ONLY:** cite the `RV-` / `DEFER` / `WU-` id whose flip-condition you are watching; do NOT
> restate that trigger's action here (the cited row holds it). At Full these graduate to typed `RV`
> anchors (ADR-0007).

- 🔔 **FIRING TODAY** — the Codex `access_token` expires **2026-07-28T14:38Z** (measured 10:57 local,
  ~7.7 h out; the `id_token` expired 07-18 and is identity-only, not used for API auth). Past it,
  `OQ-002`'s fail-loud path is what a codex-routed request will hit. Remedy: `codex login`, no
  restart needed. Only blocks Codex *field-testing*; no gate, build or test depends on it.
- `typescript-eslint` ships TS 7.x support → `OQ-009`'s hold on the typescript bump lifts
- **partyline ships the wired-block edit** (`unread --count` + the lease/liveness probe + `tail -F -n 0`;
  taken to their operator 2026-07-28) → re-running `partyline wire` REWRITES `CLAUDE.md`, which here
  carries the **skip-worktree** bit per `OQ-003`. Take the edit deliberately: `--no-skip-worktree` →
  re-wire → confirm the committed copy still has **zero** machine paths → re-set the bit. Also note the
  block's liveness advice is **watch-wired only** — a room-side probe cannot see a harness-side
  follower, which is fine for us (we are watch-wired) but is not a general claim
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

*(Previous cycle's settled rows pruned 2026-07-26 — journaled in `log.md`, see the 2026-07-25 entries.)*
