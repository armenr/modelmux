---
entry_type: lesson
provenance: llm-reviewed
maturity: budding
status: active
severity: high
module: knowledge-capture
type: process
created: 2026-07-31
last-modified: 2026-08-04
last-applied: 2026-07-31
related: []
tags: [lesson, knowledge-capture, docs, staleness, provenance]
---

# LP-009 — A defect cited as JUSTIFICATION outlives its own remediation

**Question.** You are citing a past defect to explain why something matters. Is it still there?

**Claim.** Fixing a defect does not touch the arguments that cite it. A citation lives in prose, a fix
lives in code, and **no gate joins them** — so a motivating example stays word-for-word true as
HISTORY while reading as a claim about the PRESENT. A citation of a fixed defect is
byte-indistinguishable from a live one, and **the better the motivating example, the more load-bearing
the stale citation becomes**.

The uncomfortable generalisation: every *"why this matters"* passage in every doc is a citation of a
defect — OQ bodies, ADR Context sections, lesson evidence, commit rationale, config comments. All of
them cite conditions that may since have been remediated, often **by us**.

**Evidence.**
- *The original (2026-07-31), caught only because an external peer asked everyone to run a grep.*
  `OQ-008` motivates its entire "frozen tables rot" argument with *"which is exactly how the README
  came to ship `gpt-5.3-codex`, a model that does not exist."* True as history: `fd08a9a` shipped
  `flagship = "codex:gpt-5.3-codex"` as a working example. **But `5e862d8` fixed it** — the slug has
  since appeared only in a ❌ Rejected column beside a live-probe date. I quoted the motivation forward
  as PRESENT tense into a commit body (`38cd513`), the live proxy config, this repo's journal, and
  **twice into messages to a peer**. Re-deriving it took one `git log -S`. Corrected in `be97ee3`.
- *It caught itself, same day.* This lesson's own second-order note cited a peer's synthesis verdict
  (*"structural, not contagious — zero shared carrier"*). That verdict was corrected hours later and
  split in two: version-string rot was indeed structural, but a second shape **did** travel through
  shared payload. So the lesson contained a citation that was subsequently amended — its own mechanism,
  operating on itself. Amended in `dc27c53`, and whether the payload reached this tree was **checked
  rather than assumed** (kit adopter at 0.8.2, `agents-starter` never installed, zero `model:` pins).

**Trigger.** You are about to cite a past defect as motivation — in an OQ, an ADR Context, a lesson's
evidence, a commit message, a config comment, a message to a peer. **Also the reverse:** you just
FIXED something that other documents cite as motivation.

**Failure mode.** A false present-tense claim propagates with the authority of a real measurement, and
it is invisible to the obvious sweep. A grep for the defective *artifact* will not find a false
*statement about* it — phrased without the literal token, the stale citation is undetectable by that
check entirely. Worse, an inter-agent channel carries it onward and strips its provenance the same way
quoting strips a date.

**Mitigation.** When you cite a defect as motivation, **re-derive whether it is still there** — one
`git log -S` is usually the whole cost. And when you FIX something, grep for the arguments that cite
it; the fix and its citations live in different files and nothing links them.

**Recurrence count.** 2 (2026-07-31: the `gpt-5.3-codex` citation, and this lesson's own cited verdict).
