---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [meta, glossary, framework]
related: [index, CONVENTIONS, charter]
---

# Glossary — framework terms

The context-system vocabulary (the process, not any product). Keep claims short; link to the doc that
owns the detail. Route via per-dir `index.md`, don't browse. *(Product/domain terms for
**modelmux** belong in `reference/`, not here.)*

## The store + the schema

- **`.agent-docs/`** — the ONE unified, in-repo knowledge store: all durable context (state,
  decisions, lessons, findings) lives here as Markdown, version-controlled with the code.
- **`CONVENTIONS.md`** — THE schema contract (normative): the taxonomy, front-matter, write-
  disciplines, the ID spine, and the lint rules every doc obeys.
- **Tier-1 / Tier-2 / Tier-3** — the loading tiers. Tier-1 (`now/`, the lessons MOC, the indexes)
  loads early; Tier-2 (`decisions/`, `reference/`, `research/`) is on-demand by ID; Tier-3 (`archive/`
  snapshots) is reached only via an `archived-from:` breadcrumb, never bulk-loaded.
- **Progressive disclosure** — the load-bearing principle: pointers-not-content, per-dir index
  routing, front-matter as a breadcrumb graph, tiered loading, reference-by-ID. *Route, don't browse.*

## The ID spine

- **WU-NNNN** — **work-unit**: one ledgered unit of intended work. The join key across the store —
  ADRs, charters, checkpoints, and traceability rows all key back to the WU that spawned them.
- **ADR / ADR-NNNN** — **Architecture Decision Record**: the canonical decision ID, stable forever;
  carries a mandatory `## Alternatives Considered` field. Supersession, not deletion.
- **OQ-NNN** — **open question**: single source in `now/open-questions.md`, referenced by number; a
  resolved OQ cites the ADR/WU that closed it.
- **LP** — **lesson proposal**: a staging ID for a candidate lesson in `now/lessons/proposals.md`,
  before human-gated promotion into the ledger.
- **FR-NNNN** — a **dispatch-charter** ID (full profile).
- **R-NNNN** — a **research investigation** ID (full profile).
- **INC-NNN** — an **incident** / post-mortem ID (full profile).
- **RV-NNN** — a **REVISIT anchor**: a typed code-comment change-intent marker linked to a ledger in
  `reference/` (classes: `until:` · `retire-at:` · `twin:` · `claim:`).

## Routing + index vocabulary

- **carry-away** — the one-sentence takeaway every per-dir index entry carries. Must be traceable to
  the source doc — a wrong carry-away is worse than none.
- **Open when:** — the trigger clause on an index entry: the situation that should send a reader to
  that doc.
- **same-change rule** — creating/retiring a doc updates its dir's `index.md` in the SAME change.
- **MOC** — **Map of Content**: `now/lessons/MOC.md`, the bounded (~30-entry) always-loaded index over
  the full `lessons/` ledger. The MOC never replaces the ledger.

## Write-disciplines + provenance

- **write-disciplines** — the per-dir write rule: **APPEND-ONLY** (new entries only; status may
  change) · **UPDATE-IN-PLACE** (edit the living doc) · **WRITE-ONLY** (immutable once written — a
  checkpoint).
- **provenance ladder** — the trust signal on every doc: `human` > `llm-reviewed` > `llm-draft` >
  `llm-autonomous`. `kit-template` is the unfilled-seed state; fill a template and bump it. An
  `accepted` ADR may not be `llm-draft`/`llm-autonomous`.
- **findings-to-disk** — a finding, dead-end, or rejected alternative that lives only in conversation
  is DEAD at compaction; write it to its durable home the moment you have it.

## Verification + wiring

- **IMPL → WIRED** — verification by **production-reachability, not test-pass**: a unit is done when a
  path traces from a real entrypoint to the new code (see `traceability/`). The built-but-not-wired
  trap is the recurring failure this closes.
- **DEFER** — an intentional, recorded decision NOT to wire something yet, with a reason (a
  `traceability/` row) — the honest alternative to a silent half-wiring.
- **sitrep / checkpoint** — a WRITE-ONLY 10-point zero-loss record (`checkpoints/`): the
  anti-naive-summarization tier that preserves dead-ends + rejected alternatives a lossy summary drops.

## Orchestration + review

- **clean-context verifier** — the adversarial reviewer run with no authorship stake, as a gate stage.
  The executor never audits its own work (reviewer ≠ builder) — applies to designs, not just code.
- **adversarial separation of duties** — the reviewer is never the builder; independent verification
  re-derives the claim against the live tree before the work proceeds.
- **recon-first** — a read-only scope recon that recalibrates stale assumptions against the LIVE tree
  before any bulk build, and returns the complete file-ownership set.
- **dispatch-charter** — a single-owner (one-file-one-owner) work-spec with a hard scope fence and a
  named wiring-proof target. *(Renameable to your team's vocabulary.)*
- **wave-plan / wave** — the decomposition of a work-unit into single-builder charters, sequenced into
  **waves** that have NO file-overlap. *(Renameable to your team's vocabulary.)*
- **dispatch contract** — the standing rules every dispatched agent obeys: a hard **scope-fence** (the
  exact files it may touch) + **halt-and-report** (record any out-of-scope find to a required
  `discoveries[]` field and stop, never improvising a workaround).

## Lessons vocabulary

- **near-miss** — a lesson subtype recording a save that worked ("what almost happened" + "what made
  the save reliable"), not only failures.
- **maturity ladder** — a lesson's confidence: **seedling → budding → evergreen**; only evergreen
  lessons earn an MOC row.
- **quarantine** — the status for a lesson true only of a specific model/tool-era: kept for genealogy,
  not auto-loaded.

## Lifecycle skills

- **orient** — session-start: read `now/handoff.md` + surface current state; verify it against the
  repo.
- **flush** — mid-session housekeeping: bring `now/*` + `log.md` to current reality, keep working.
- **handoff** — session-end / pre-compaction: capture a curated cold-start brief; run the lesson
  promotion gate. Never auto-commits.
