---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [meta, index, routing, root]
related: [glossary, charter, CONVENTIONS]
---

# .agent-docs/ — root catalog (directory-level only)

The top of the routing tree for the **modelmux** context system. **Directory-level
only** — one line per top-level dir pointing at that dir's own `index.md`, plus the root files. It
does **not** enumerate individual docs (that is each dir's `index.md` job — route, don't browse).
Touch this file only when a directory is added/removed or its organizing principle changes; **no new
top-level category without a decision record (ADR).** Schema authority: `CONVENTIONS.md`.

> **Reading order.** Start at `CONVENTIONS.md` (the normative schema) → `now/` (every session) → then
> route on-demand into the dir whose `index.md` matches the job. Tier-1 surfaces (`now/`, the lessons
> MOC, this catalog, per-dir indexes) load early; Tier-2 (`decisions/`, `reference/`, `research/`) is
> on-demand by ID; Tier-3 (`archive/` snapshots) is reached only via an `archived-from:` breadcrumb,
> never bulk-loaded.

> **Profiles.** This kit ships in tiers — **minimal** (`now/` · `decisions/` · `lessons/`),
> **standard** (adds `checkpoints/` · `memories/` · `reference/`), **full** (adds `traceability/` ·
> `dispatch-charters/` · `research/` · `runbooks/` · `incidents/` · `experiments/`). A directory
> absent from your install simply has no row to route to — delete its row here to keep the catalog
> honest.

## Directories (route via each dir's own index)

| Dir | Profile | Holds | Route to |
|---|---|---|---|
| **now/** | minimal | Fleeting working state: status · work-plan · open-questions · handoff · `lessons/{MOC,proposals}` · the append-only log | [now/index.md](./now/index.md) |
| **decisions/** | minimal | Decision records (`ADR-NNNN`) — why we chose what, with the rejected alternatives | [decisions/index.md](./decisions/index.md) |
| **lessons/** | minimal | Typed, append-only lessons-learned ledger — "when X, do Y, because Z" | [lessons/index.md](./lessons/index.md) |
| **reference/** | standard | Stable WHAT-IS facts: architecture, inventories, syntheses, standards of record | [reference/index.md](./reference/index.md) |
| **checkpoints/** | standard | WRITE-ONLY 10-point zero-loss sitreps (the anti-naive-summarization tier) | [checkpoints/index.md](./checkpoints/index.md) |
| **memories/** | standard | Non-obvious gotchas / findings, titled as claims | [memories/index.md](./memories/index.md) |

## Root files

| File | Holds |
|---|---|
| `CONVENTIONS.md` | **THE schema contract** (normative) — taxonomy, front-matter, write-disciplines, the typed work-unit ID spine, lint rules |
| [glossary.md](./glossary.md) | Framework jargon — the ID spine, the write-disciplines, the lifecycle skills |
| [charter.md](./charter.md) | The long-term mission / north star (the compass, not the odometer) |
| [log.md](./log.md) | The ONE append-only operational journal (newest-at-top; grep-parseable `## [DATE] op | summary`) |

## Maintenance

UPDATE-IN-PLACE, but **rarely** — only on a directory add/remove or an organizing-principle change.
Per-doc adds/retires update the *dir's* `index.md`, never this one. The completeness lint operates at
the dir level here, not the doc level. No new top-level category without an ADR.
