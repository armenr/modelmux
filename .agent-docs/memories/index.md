---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [meta, index, routing, memories]
related: [CONVENTIONS]
---

# memories/ — routing catalog

Non-obvious gotchas + findings, **titled as claims, not topics**. Tier-2 — loaded on demand when the
claim is relevant. UPDATE-IN-PLACE (rare). Schema authority: `../CONVENTIONS.md` (memory template).

> **Memory vs lesson vs ADR.** A *memory* is a standing gotcha/fact ("X behaves surprisingly because
> Y"). A *lesson* is a behavioral rule with promotion + decay (`lessons/`). An *ADR* is a settled
> decision (`decisions/`). When in doubt: did it change how we ACT (lesson) or decide a fork (ADR)?
> Otherwise it's a memory.

## Entry purpose + naming

- **Purpose:** capture a non-obvious finding so it isn't re-derived — the title IS the claim.
- **Filename:** `memories/<kebab-claim-as-title>.md`. Good:
  `build-needs-explicit-env-recipe`. Bad: `build-notes`.
- **Write-discipline:** UPDATE-IN-PLACE (rare).

## Entry SCHEMA (body)

Observed (when/where/how it surfaces) · Root cause (if known) · Workaround / fix · Avoid (specific
anti-actions) · See also (related docs, upstream issues, commit refs).

## Memories

- 🛡️ `installed-safety-gate-does-not-protect-this-repo.md` — **Open when:** you are about to rely
  on the PreToolUse safety gate to stop a destructive command, or you are writing a probe/fixture
  that targets one. **Carry-away:** the gate matches command TEXT, not parsed argv, so eight
  verified spellings reach a protected branch and any safe-list word anywhere on the line disarms
  the recursive-delete rule — treat destructive safety here as discipline plus git history, and
  never patch the kit-owned hook. (Measured firsthand 2026-07-25; reproduced upstream by
  `fieldbook`, rewrite pending.)

## Maintenance

UPDATE-IN-PLACE; adding/retiring a memory updates this index in the same change. Carry-away claims
must be traceable to the source memory.
