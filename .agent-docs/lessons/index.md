---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-09
tags: [meta, index, routing, lessons]
related: [CONVENTIONS]
---

# lessons/ — routing catalog

Typed, append-only lessons-learned ledger. **Read before action.** The full ledger lives here; the
bounded auto-loaded surface is `now/lessons/MOC.md` (the Tier-1 MOC, ~30 entries) — this index never
replaces the MOC. Schema authority: `../CONVENTIONS.md` (lesson template).

> **Why a typed ledger.** Every durable rule is the fossil of a real, recurrence-counted incident.
> Without typing + a decay signal + a human promotion gate, lessons either re-learn themselves each
> time or drown the signal in noise.

## Entry purpose + naming

- **Purpose:** an atomic, evidence-linked lesson or near-miss — "when X, do Y, because Z."
- **Filename:** `lessons/<kebab-slug-of-claim>.md`; superseded entries → `lessons/archive/`.
- **Write-discipline:** APPEND-ONLY (`status:` may change to `superseded`/`deprecated`/`quarantined`).

## Entry SCHEMA (front-matter axes + body)

- Front-matter: `entry_type` (lesson | near-miss) × `provenance` × `maturity` (seedling → budding →
  evergreen) × `status` × `severity` × `module` × `type`.
- Body: Question · Claim · Evidence (a log timestamp / commit / ADR / incident — required past
  seedling) · Trigger · Failure mode (or "What almost happened" + "What made the save reliable" for a
  near-miss) · Mitigation · Recurrence count.

## Quarantine (model/harness-bound lessons)

A lesson true only of a specific model or tool-era gets `status: quarantined` and lives in a
quarantine sub-section — kept for genealogy, NOT auto-loaded into the Tier-1 MOC.

## Promotion (always human-gated)

The distillation pass drafts candidates → `now/lessons/proposals.md` → promoted at `/handoff`.
Maturity `seedling → budding → evergreen`; prune `last-applied > 90d` → `lessons/archive/`. An
accepted lesson gets BOTH a `lessons/index.md` entry (here) AND a possible MOC row. Severity /
cost-of-recurrence can justify promotion on first sighting — it need not wait for the 3rd recurrence.

## Lessons

<!-- EXAMPLE (delete this block on the first real lesson):
- `example-when-x-do-y.md` — **Open when:** <the concrete situation that should trigger recall>.
  **Carry-away:** <the "when X, do Y, because Z" in one sentence, traceable to the evidence>.
  *(seedling · medium · process.)*
-->

## Maintenance

APPEND-ONLY; adding/retiring a lesson updates this index in the same change. Carry-away claims must
be traceable to the source lesson — a wrong carry-away is worse than none.
