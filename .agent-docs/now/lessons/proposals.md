---
provenance: llm-draft
created: 2026-07-03
last-modified: 2026-08-04
tags: [current, lessons, proposals]
related: [MOC, ../../lessons/index]
---

# Lesson proposals — staging

Two-step human-gated promotion. Candidates land here as seedlings; `/handoff` §7c surfaces each for
**accept / defer / reject**. Accepted → `../../lessons/<slug>.md` + a `lessons/index.md` entry (+ an
MOC row if Tier-1). Rejected → removed, with a one-line reason in `log.md`.

<!-- New candidates appended below as fenced lesson stubs (provenance: llm-draft, maturity: seedling). -->

*(Previously — `LP-005` accepted 2026-07-27 and promoted to
`lessons/a-written-down-trap-is-not-a-disarmed-trap.md`, evergreen, with an MOC row. Its acceptance
shipped `OQ-010` rather than a note-to-self, per its own claim.)*

*(Staging empty — `LP-006` accepted 2026-07-28 and promoted to
`lessons/a-correct-mechanism-with-an-inverted-consequence-is-invisible-to-controls.md`, evergreen,
with an MOC row. Three firsthand instances in one day, the third inside the commit recording the
second.)*

*(No proposals staged. All four candidates — `LP-007`, `LP-008`, `LP-009`, `LP-010` — were
adjudicated on 2026-08-04 and **accepted**, then moved to `../../lessons/`:*

| id | slug | maturity | why that maturity |
|---|---|---|---|
| `LP-007` | `a-rule-held-as-a-procedure-does-not-transfer` | budding | one supporting instance; sharp mechanism, concrete mitigation, but no cross-session confirmation |
| `LP-008` | `a-test-can-specify-a-defect-and-every-gate-defends-it` | **evergreen** | cost ~15.2M tokens billed wrong, AND was applied later to triage four legacy tests under `ADR-0004` — usefulness confirmed in a second session |
| `LP-009` | `a-cited-defect-outlives-its-own-remediation` | budding | two instances, but same window; notable that it caught itself |
| `LP-010` | `suspect-the-probe-before-the-system` | budding | two instances, same day, same deploy; freshest |

*Only `LP-008` took a MOC row — the MOC is the bounded Tier-1 surface and carries evergreen entries
only, consistent with `LP-002` sitting at budding without one.)*
