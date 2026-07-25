---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-09
tags: [meta, index, routing, reference]
related: [CONVENTIONS]
---

# reference/ — routing catalog

Stable **WHAT-IS** facts: architecture notes, inventories, syntheses, validated-version matrices, and
**standards of record** (living, agent-enforced standards). Tier-2 — loaded on demand. UPDATE-IN-PLACE
(rare — these are durable facts, not fleeting state). Schema authority: `../CONVENTIONS.md`.

> **reference/ vs research/ vs decisions/.** `reference/` holds the DISTILLED fact ("this is how the
> auth layer is shaped"). `research/` (Full profile by default — some adopters opt it in at Standard too) holds the woven investigation genealogy that
> produced a fact. `decisions/` holds WHY a fork was chosen (an ADR). A fact with no live decision and
> no open investigation belongs here.

## Entry purpose + naming

- **Purpose:** capture a stable, reusable fact so it is not re-derived from scratch each session.
- **Filename:** `reference/<kebab-topic>.md` — a kebab-case topic name (for example an architecture
  overview, or a validated-versions matrix).
- **Write-discipline:** UPDATE-IN-PLACE (rare). A standard-of-record carries `provenance: human`.

## Entry SCHEMA (body)

What-it-is (the fact, stated plainly) · Scope / where it applies · Evidence or source (so it can be
re-verified) · Last-verified (facts drift — date the check) · See also.

## Reference docs

<!-- work-discipline.md is FULL-tier payload: its row lives in the Full overlay of this index
     (base/full/agent-docs/reference/index.md), which layered installs copy over this file —
     so Standard-alone never indexes a file it doesn't ship (rule 13, no phantoms). -->
- 🔍 `doc-refs-contract.md` — the ratified contract for `scripts/doc-refs.sh`, the diff-keyed docs-impact sweep (the twin of the unit-keyed `wu-refs`): gather-then-triage, the five-state output + two fenced lanes, fail-loud + the known-positive canary, the exit semantics the gate wires to.
  **Open when:** running or wiring the docs-impact CLEAR stage (DOCS-time / pre-commit), or reading `scripts/doc-refs.sh` (which implements it) against its spec.
  **Carry-away:** the sweep GATHERS + pre-tags; you actively choose only still-true vs stale per row — it triages, never blocks.
- 🧱 `baseline-mechanism.md` — brownfield-vs-cold-start for the docs-impact gate: the adoption-time drift inventory, the accountable-only-for-touched-drift line, the sealed write-once baseline, and the retirement / scheduled-drift lanes.
  **Open when:** adopting the docs-impact gate on a repo that already carries drift, or reasoning about why an inherited-drift row is (or isn't) fenced.
  **Carry-away:** new debt loud, inherited debt fenced — and touched-inherited debt graduates the moment your diff edits its referent.
- 📣 `fail-loud-dispatch-contract.md` — the fail-loud dispatch contract (R1–R6): completeness asserted at every phase boundary, the banned silent-drop idioms, the two sanctioned shortfall paths (halt-and-repair · declared-degraded), the hardened escape-hatch grammar, and the paste-in preamble the `dispatch-gate` hook hash-checks.
  **Open when:** authoring any dynamic workflow or sub-agent fan-out, declaring a governed dispatch, or dispositioning a dispatch-gate finding.
  **Carry-away:** COMPLETED is not COMPLETE — a dependent phase never consumes a partial set unknowingly; a shortfall halts loud or degrades DECLARED, never silently.

- 🔬 `observation-integrity.md` — the observation-integrity contract: the one-line instrument test
  ("if this instrument were broken, empty, or truncated, would my output look any different?"), the three
  failure shapes (tool-failed-silence · stored-verdict-rot · query-inverted-from-proposition) with their
  DIFFERENT required gates, the five runtime rules for verification commands, and the per-gate ENTAILMENT
  requirement.
  **Open when:** authoring or reviewing any gate/verification command, recording any "clean"/"empty"
  verdict, or dispositioning a claim drawn from a summarized/truncated view.
  **Carry-away:** an instrument that looks the same broken or clean has produced an artifact, not an
  observation — and a canary proves the instrument FIRES, never that it fires on the right proposition.

- 🔁 `fieldbook-install-reconstitution.md` — the recovery inventory for the 2026-07-25 Fieldbook
  install: which files regenerate from the pinned `kit_ref` or from `partyline wire`, which seven
  are authored and irreplaceable, and where the verified second copy lives.
  **Open when:** this tree is damaged, you are deciding whether to restore or re-run, or you are
  about to back something up "just in case".
  **Carry-away:** copying is the expensive answer — a credential wants a reissue path and a
  generated config wants a regenerate command; only authored work earns a second location. Also
  records the inventory trap: `git status` hides gitignored files, which is exactly where
  single-copy-by-policy assets live. (Verified 2026-07-25.)

## Maintenance

UPDATE-IN-PLACE; adding/retiring a reference doc updates this index in the same change. Carry-away
claims must be traceable to the source doc — never approximate from memory.
