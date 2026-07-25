---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [meta, index, routing, checkpoints]
related: [CONVENTIONS]
---

# checkpoints/ — routing catalog

WRITE-ONLY, timestamped, immutable **10-point zero-loss sitreps** — the anti-naive-summarization
tier. A checkpoint preserves exactly what a lossy summary would silently drop: dead-ends, rejected
alternatives, the detour stack. Keyed to the active work-unit (`WU-NNNN`). Schema authority:
`../CONVENTIONS.md`.

> **Why this tier exists.** Findings that live only in the conversation are DEAD at compaction. A
> checkpoint is precise enough to resume cold. `/handoff` consumes the latest checkpoint; `/orient`
> reads it to reconstruct cold-start state.

## Entry purpose + naming

- **Purpose:** capture zero-loss session state at a checkpoint, before compaction, or before a risky
  op — precise enough to resume cold.
- **Filename:** `checkpoints/YYYY-MM-DD-HHMMSS-<slug>.md` (UTC, machine-sortable).
- **Write-discipline:** WRITE-ONLY. Never edited after write. New information ⇒ a NEW checkpoint that
  references the prior by filename (the addendum mechanism).

## Entry SCHEMA — the 10 mandatory points

1. **Mission / objective** — main objective + active `WU` + the side-quest / detour stack.
2. **Current state** — branch, working-tree shape, what builds/runs.
3. **Work completed this segment** — deliverables tied to their `WU`/`FR`.
4. **In-flight / interrupted** — exact pause point + the next concrete action.
5. **Decisions made — WITH rejected alternatives** — chosen + rejected + why (mirrors the ADR
   Alternatives field; mandatory).
6. **Investigation results — INCLUDING dead-ends** — paths that did NOT pan out + the reason. *(The
   single most anti-summarization clause.)*
7. **Open questions / blockers** — `OQ-NNN` refs; what's undecided/blocking, and on whom.
8. **Files / artifacts touched** — paths + one-line why + wiring/reachability status (ties to
   `traceability/`).
9. **Next actions** — the ordered resume queue, actionable cold.
10. **Addendum check** — "what would be LOST if this were the only surviving record?" — re-read 1–9,
    name anything still living only in conversation, add it.

## When to write one

Session-end / pre-compaction / ~80% context / before a risky op / the `/sitrep` skill / at a phase
gate.

## Checkpoints (reverse-chron)

<!-- EXAMPLE (delete this block on the first real checkpoint):
- `2026-07-03-140000-example-slug.md` — **the <objective> checkpoint.** Zero-loss record of <what the
  session did / decided / ruled out>. Read it for the full decisions/dead-ends/rationale if
  `now/handoff.md` is thin.
-->

## Maintenance

WRITE-ONLY — this index lists checkpoints in reverse-chron as they land (most recent first). Adding a
checkpoint adds a row here in the same change.
