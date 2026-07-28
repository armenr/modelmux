---
entry_type: lesson
provenance: llm-reviewed
maturity: evergreen
status: active
severity: high
module: verification
type: process
created: 2026-07-28
last-modified: 2026-07-28
last-applied: 2026-07-28
related: [an-empty-result-is-evidence-about-the-query-not-the-world, the-spec-is-the-floor-not-the-proof]
tags: [lesson, verification, inference, controls, meta]
---

# LP-006 — A correct mechanism with an inverted consequence is invisible to every control

**Question.** Every fact you stated is true, every control fired, the instrument was sound. What can
still be wrong?

**Claim.** The **step between** them. A control catches a FALSE STATEMENT; it cannot catch a **true
observation followed by a one-token inference that is wrong in sign**, because there is nothing false
to control against. **Reading gives you the mechanism; only RUNNING gives you the consequence.** For
any claim about an artifact's *behaviour*, the leg must execute it — a "therefore" spanning two true
statements is the thing to distrust.

**Evidence — four firsthand instances in one day, plus fleet corroboration.** The fourth is in
**Mitigation** below, because it refutes part of the mitigation itself.

- **The stale clone.** Observed `package.json` read `0.5.0` **and** a `v0.5.1` tag existed. Both true.
  Inferred *"the release process is broken"* and reported it to the operator as a defect. It was a
  stale clone — `origin/main` carried the release commit and read `0.5.1`. No control could have
  caught it: the observations were right and the instrument was fine. What caught it was **running
  `git fetch`**, not reading harder.
- **The hardcoded manifest.** Read `preamble.js`'s literal `coverage: 'COMPLETE'`, correctly observed
  it was hardcoded, and filed *"a manifest nothing computed."* It is **entailed** — `assertComplete`
  has already thrown unless no slot is null and the length matches. A peer **executed** both the
  literal and a computed form with a control and got identical verdicts. Filed into the very memory
  that records this shape.
- **The unverified write.** The commit correcting the second instance asserted *"LP-006 gains this as
  its second instance"* while the edit adding it had raised an `AssertionError` on a stale anchor —
  and the `git commit` on the next line ran anyway, because the two were newline-separated rather than
  `&&`-chained. The claim was written before the write was checked. Grep afterwards: zero hits.
- **Fleet, same day.** The kit owner's own verification workflow — built with mandatory controls, a
  scope-hunter and a contradiction-hunter — emitted an inverted consequence (*"the id is manufactured"*
  → therefore *"a dropped id is caught"*, the truth being the reverse). Every stated fact was true and
  every control fired. Caught only by an agent who **executed** the artifact where everyone else had
  read it. Two further inversions the same morning, both correct-mechanism/wrong-sign.

**Trigger.** You have read something correctly and are about to state what it *implies* — especially
when the reading was careful and the controls were green. That is the moment of maximum confidence and
minimum scrutiny, which is exactly when this lands.

**Failure mode.** A verdict that survives a fully-controlled verification pass. It is uniquely durable
because every visible signal endorses it: the facts check out, the instrument works, the review passes.
Only the unstated step is wrong, and nothing in the apparatus is pointed at it.

**Mitigation.** Mechanical, not exhortative:

- **A behaviour claim owes an EXECUTION.** If the assertion is about what an artifact *does*, run it —
  do not re-read it. Re-reading yields the same mechanism and the same inference.
- **Mark the "therefore".** When two true statements are joined by an inference, that joint is the
  claim under test, not the statements. State it separately so it can be attacked separately.
- **Chain commands with `&&`, never newlines**, when a later step asserts the earlier one succeeded —
  the third instance above exists solely because a failed edit rode into a successful commit.
  **But `&&` is not sufficient, and the fourth instance proves it:** chaining the promotion commit with
  `&&` exactly as prescribed still failed, because in zsh a heredoc cannot follow a `\`-continued `&&`
  chain — the commit died on a glob error, the `git push` in the same chain ran anyway, and "pushed"
  printed under a commit that had never happened. **`&&` guards the ORDER of commands, not the
  ATOMICITY of a compound one.** Pass a long message via `-F <file>` rather than a chained heredoc.
- **Verify a write before claiming it.** Grep for the string you believe you just wrote, in the same
  breath as writing the claim that you wrote it.

**Relation to the neighbours.** `LP-001` says the *spec* is not the *deployment* — an external-contract
gap. `LP-004` says an *empty result* is evidence about the query — an instrument gap. This is the
**inference** gap: the source was read correctly and the instrument worked. The remedy rhymes with
LP-001's (*execute, don't trust the reading*) for a different reason.

**Recurrence count:** 4 firsthand (2026-07-28) + 3 corroborated across peer trees the same day.
