---
provenance: kit-template
template-version: 1.0.0
created: 2026-07-03
last-modified: 2026-07-09
tags: [index, templates]
related: [CONVENTIONS]
---

# templates/ — index

The canonical, versioned fill-in scaffolds new docs instantiate from (CONVENTIONS.md §8). Each
carries a `template-version`; an instantiated doc records which version it was scaffolded from so
drift is detectable (version mismatch), not invisible. **Instantiate from the template — never
hand-copy an existing doc.**

## Authoring a decision

- 🔨 `adr-template.md` — an architecture decision record (`decisions/NNNN-*.md`).
  **Open when:** making a non-trivial choice — author it BEFORE acting.
  **Carry-away:** the `## Alternatives Considered` field is mandatory and written before the work (§5).

## Capturing state

- 🔨 `checkpoint-template.md` — the 10-point zero-loss sitrep (`checkpoints/`, WRITE-ONLY).
  **Open when:** before a risky op / phase gate / compaction — losing the conversation would lose rationale.
  **Carry-away:** all ten §6 points are mandatory; point 6 (dead-ends) is what a naive summary deletes.
- 🔨 `handoff-template.md` — the curated cold-start surface (`now/handoff.md`, UPDATE-IN-PLACE).
  **Open when:** session end / before compaction / context >~80%.
  **Carry-away:** the handoff orients; the checkpoint preserves — point one to the other.

## Recording durable knowledge

- 🔨 `memory-template.md` — a non-obvious gotcha, titled as the claim (`memories/`).
  **Open when:** you hit a finding that would cost the next agent time to rediscover.
  **Carry-away:** title is the CLAIM, not the topic.
- 🔨 `lesson-template.md` — a lesson / near-miss in the append-only ledger (`lessons/`, `LP-NNN`).
  **Open when:** an error or near-miss teaches a durable "when X, do Y, because Z."
  **Carry-away:** append-only, read before action; promotion is human-gated.

## Reviewing *(Standard profile adds)*

- 🔨 `review-template.md` — a typed `REV-NNN` review report (`reviews/`, APPEND-ONLY; dispositions update in place).
  **Open when:** filing any review pass with findings — adversarial review, verifier run, security audit.
  **Carry-away:** every finding gets a stable `REV-NNN-FNN` id, a disposition (FIXED / DEFER / WONTFIX / TRACKED→OQ), and a test-obligation — no silent drops.

## Routing

- 🔨 `index-template.md` — a per-dir routing catalog (`<dir>/index.md`).
  **Open when:** a content dir gains its first doc, or you add/retire any doc in it.
  **Carry-away:** what-it-holds · Open when: · Carry-away: — grouped by job, updated in the SAME change (hook-enforced, §7.1).
