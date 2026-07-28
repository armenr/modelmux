---
provenance: llm-draft
created: 2026-07-03
last-modified: 2026-07-28
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

### LP-006 (seedling · llm-draft · 2026-07-28) — A correct mechanism with an inverted consequence is invisible to every control

- **Trigger:** you have read code (or a spec, or a log) correctly, and are about to state what it
  *implies*. Especially when the reading was careful and the controls all fired.
- **Claim:** controls catch FALSE STATEMENTS. They cannot catch a **true observation followed by a
  one-token inference that is wrong in sign** — there is nothing false to control against. Every fact
  true, every control green, conclusion inverted. **Reading gives you the mechanism; only RUNNING gives
  you the consequence.** The step between the two is the unguarded surface.
- **Evidence (firsthand, 2026-07-28):** I observed that `package.json` read `0.5.0` and that a `v0.5.1`
  tag existed — **both true** — and inferred "the release process is broken," reporting it to the
  operator as a defect. It was a stale clone; `origin/main` had the release commit and read `0.5.1`.
  No control could have caught it: the observations were correct and the instrument was fine. What
  caught it was **running `git fetch`** rather than reading harder.
  **A SECOND instance, minutes after staging this lesson:** I read `preamble.js`'s hardcoded
  `coverage: 'COMPLETE'` literal, correctly observed it was hardcoded, and filed *"a manifest nothing
  computed"* — inferring the hardcoding was the defect. It is **entailed**: `assertComplete` had
  already thrown unless there were no null slots and the length matched. A peer **executed** both
  forms with a control and got identical verdicts. Same shape, committed into the very entry that
  records the shape.
  **A THIRD, in the commit that recorded the second:** that commit's message asserted "LP-006 gains
  this as its second instance" while the edit adding it had silently failed — the claim was written
  before the write was verified. Corroborated across the fleet the
  same day — the kit owner's own verification workflow, built with mandatory controls, a scope-hunter
  and a contradiction-hunter, emitted an inverted consequence ("the id is manufactured" → *therefore*
  "a dropped id is caught"). Every stated fact was true and every control fired; a peer caught it only
  by EXECUTING the artifact where everyone else had READ it. Two more inversions the same morning, both
  correct-mechanism/wrong-sign.
- **Severity:** high — it is the residual failure that survives a fully-controlled verification pass,
  which is exactly when confidence is highest and scrutiny lowest.
- **Note for review:** distinct from `LP-001` (that says the *spec* is not the *deployment* — an
  external-contract gap) and from `LP-004` (that says an *empty result* is evidence about the query — an
  instrument gap). This one is the **inference** gap: the source was read correctly and the instrument
  worked. Mitigation is not another doctrine paragraph — it is that a consequence claim owes an
  EXECUTION, and a "therefore" spanning two true statements is the thing to distrust.
