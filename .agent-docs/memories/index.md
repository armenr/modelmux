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

- 🔌 `the-proxy-is-not-running-on-the-development-machine.md` — **Open when:** you are about to reason
  about which model answers a request from this repo, describe this project's capability to anyone, or
  infer runtime behaviour from `routes.toml` / the `<<route:>>` tags. **Carry-away:** modelmux is built
  here, not run here — sessions in this tree are ordinary Claude Code on subscription auth, so routing
  config is specification and not observation; four peers manufactured false operational conclusions
  from exactly this confusion. (Stated by the operator 2026-07-25.)

- 🔍 `doc-lint-clean-is-a-partial-claim-kit-template-provenance-disables-four-rules.md` — **Open when:**
  you are about to cite "doc-lint clean — N files" as evidence, or wondering why a reference/annotation
  defect went unreported. **Carry-away:** `lint-docs.py` skips rules 8/15/21/12 on any doc whose
  `provenance:` is `kit-template` regardless of path — **17 of our 37 files**, so a clean headline means
  "clean on the rules that ran". Those 17 split two ways: **10 SEED-THEN-LIVE** (every `index.md`, plus
  `log.md` and `glossary.md`) that the *adopter writes* — rule 13 mandates adding index rows, and the
  label then exempts exactly what you wrote — and **7 static-normative** that are genuinely verbatim.
  An armed-vs-control diff found 2 real hidden findings here, both in the static-normative bucket, both
  kit-owned. **Do not patch, and do not self-bump the seed files** (zero findings gained, manifest
  `sha256` divergence risk). Hit count is not debt (17→2 here vs 4→6 on another tree), the buckets are
  **not filename-separable** (`MOC.md` is seed-then-live despite its name), and a subset control is only
  evidence if you can say why the subset is representative. (Measured firsthand 2026-07-25; kit-side
  confirmed and the two-class taxonomy corrected by `fieldbook`; fix queued behind v0.8.3.)

## Maintenance

UPDATE-IN-PLACE; adding/retiring a memory updates this index in the same change. Carry-away claims
must be traceable to the source memory.
