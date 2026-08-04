---
entry_type: near-miss
provenance: llm-reviewed
maturity: budding
status: active
severity: high
module: knowledge-capture
type: process
created: 2026-07-29
last-modified: 2026-08-04
last-applied: 2026-07-29
related: []
tags: [near-miss, knowledge-capture, generalisation, config, cross-repo]
---

# LP-007 — A rule held as a PROCEDURE does not transfer; only a rule held as a QUESTION does

**Question.** You are in a situation that *rhymes* with one your disciplines cover, but the artifact in
front of you is not the artifact the discipline names. Will the discipline fire?

**Claim.** A discipline encoded as *"for file X, do steps 1–4"* fires on **recognition of X**. A
discipline encoded as *"before any Y, ask Z"* fires on **recognition of the situation**. Only the
second generalises. The first feels identical from the inside — you have the rule, you have used it,
you can recite it — and it silently fails to apply one directory sideways.

**What almost happened.** On 2026-07-29 I ran the full skip-worktree dance on modelmux's `CLAUDE.md`
(`OQ-003`) *specifically so a machine-local localhost path would not reach git*. **Sixty minutes
later** I inserted a localhost `ANTHROPIC_BASE_URL` into a **tracked** file in a peer's **public**
repo, and reported it as *"one insert, hooks byte-identical"* — true, and silent on tracking status.
It nearly shipped inside that agent's queued 17-file docs commit.

I was asking *"did I break their hooks?"* — a procedure question about a named artifact — instead of
*"will this travel?"*, a situation question. The discipline had reached me and I had **just executed
it correctly**, one hour earlier, on a different file.

**What made the save reliable.** Nothing I did. The peer caught it on their own review of their own
tree. That is the uncomfortable part of this entry: there was no mechanism on my side, and the
recovery depended entirely on a second party looking. The durable fix went in as
`memories/a-setup-change-to-another-repo-needs-its-tracking-status-not-just-its-diff.md` (`9995bc6`),
which turns the procedure into a check at the point of use: `git ls-files --error-unmatch <path>`
before editing config in a repo that is not yours.

**Trigger.** You are about to modify configuration, hooks or settings in a repo, directory or machine
that is not the one your disciplines were written against — especially when you have recently and
correctly applied the analogous rule somewhere else.

**Failure mode.** The failure is invisible **precisely to someone who HAS the relevant discipline and
has recently exercised it** — which is the population least likely to stop and re-derive it. Recent
correct application creates the confidence that suppresses the check.

**Mitigation.** When writing a procedure into an `OQ`, runbook or memory, also write the one-line
QUESTION it answers, and put the question where the *situation* occurs rather than where the *file* is
named. "Before editing config in a repo that is not yours, ask: will this travel?" generalises;
"for `CLAUDE.md`, run the skip-worktree dance" does not.

**Recurrence count.** 1 (2026-07-29). Filed at `budding` rather than `evergreen` on that basis — the
mechanism is sharp and the mitigation is concrete, but it has one supporting instance and no
cross-session confirmation.

**Distinctness.** Not `LP-005` — there a documented trap never reaches the point of use; here the
discipline reached me and I had just executed it correctly. Not `LP-006` — no inference was involved;
I never formed a wrong "therefore" because I never asked the question at all.
