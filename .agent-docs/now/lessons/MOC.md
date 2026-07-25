---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [current, lessons, moc, tier-1]
related: [proposals, ../../lessons/index]
---

# Lessons MOC — Tier-1 map-of-content

**Budget: ~30 entries. Hard ceiling — never exceed.** This is the **auto-loaded** surface, read before
action. It is a bounded map *over* the full `lessons/` ledger — it does not duplicate it. The body of
any lesson lives in `../../lessons/<id>.md`; route there via `lessons/index.md`.

> **Why bounded.** The MOC loads every session — an unbounded MOC defeats progressive disclosure. Only
> **evergreen** lessons (human-promoted; recurrence OR high cost-of-recurrence) earn a row here;
> budding and seedling lessons stay in the full ledger. `last-applied > 90d` → archive (drops the row).

## Evergreen lessons (read before action)

<!-- Seeded empty. Rows land here only via human-gated promotion at /handoff. -->

| Lesson (id) | Claim — "when X, do Y, because Z" | Module | Sev | Last-applied |
|---|---|---|---|---|
<!-- EXAMPLE row (delete on the first real promotion):
| `example-when-x-do-y.md` | <the "when X, do Y, because Z" compressed to one line> | process | high | 2026-07-03 |
-->

## How a row gets here

The distillation pass drafts a candidate → `proposals.md` (this dir) → `/handoff` per-entry human
review (accept / defer / reject) → accepted + Tier-1-worthy ⇒ a row here **and** a `lessons/index.md`
entry (the index never replaces this MOC). Promotion is always human-gated; maturity must be
`evergreen` to occupy a row.

## Maintenance

UPDATE-IN-PLACE as a byproduct of `/handoff` promotion. Stays within budget — if it grows past ~30
rows, demote the least-recently-applied to the full ledger. `last-modified` staleness is lint-checked.
