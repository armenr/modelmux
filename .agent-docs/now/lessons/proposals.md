---
provenance: llm-draft
created: 2026-07-03
last-modified: 2026-07-29
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

### LP-007 (seedling · llm-draft · 2026-07-29) — A rule held as a PROCEDURE does not transfer; only a rule held as a QUESTION does

- **Trigger:** you are in a situation that rhymes with one your disciplines cover, but the artifact in
  front of you is not the artifact the discipline names.
- **Claim:** a discipline encoded as *"for file X, do steps 1-4"* fires on **recognition of X**. A
  discipline encoded as *"before any Y, ask Z"* fires on **recognition of the situation**. Only the
  second generalizes. The first feels identical from the inside — you have the rule, you have used it,
  you can recite it — and it silently fails to apply one directory sideways.
- **Evidence (firsthand, 2026-07-29):** I ran the full skip-worktree dance on modelmux's `CLAUDE.md`
  (`OQ-003`) *specifically so a machine-local localhost path would not reach git*. **Sixty minutes
  later** I inserted a localhost `ANTHROPIC_BASE_URL` into a **tracked** file in a peer's **public**
  repo, and reported it as "one insert, hooks byte-identical" — true, and silent on tracking status. It
  nearly shipped in that agent's queued 17-file docs commit. I was asking *"did I break their hooks?"*
  (a procedure question about a known artifact) instead of *"will this travel?"* (a situation question).
- **Severity:** high — the failure mode is invisible precisely to someone who HAS the relevant
  discipline and has recently exercised it, which is the population least likely to re-derive it.
- **Note for review:** distinct from `LP-005` — there a documented trap never reaches the point of use;
  here the discipline reached me and I had just executed it correctly. Distinct from `LP-006` — no
  inference was involved; I never formed the "therefore" because I never asked the question. Candidate
  mitigation: when writing a procedure into an `OQ`/runbook, also write the one-line QUESTION it answers,
  and put the question where the situation occurs rather than where the file is named.
