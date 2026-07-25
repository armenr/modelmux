---
entry_type: lesson
provenance: llm-reviewed
maturity: evergreen
status: active
severity: high
module: verification
type: process
created: 2026-07-25
last-modified: 2026-07-25
last-applied: 2026-07-25
related: []
tags: [lesson, verification, observation-integrity, false-negative]
---

# LP-004 — An empty or silent result is evidence about the QUERY, not the world

**Question.** A command printed nothing, or exited 0, or returned no matches. What has that established?

**Claim.** Nothing, until you prove the instrument could have spoken. A broken instrument, a
mis-scoped query, a tool that never ran, and a genuinely empty world are **byte-identical** in output —
and the comfortable reading is always the wrong one, because it is the one that ends the work. Before
recording any negative result, run a **known-positive control** through the same instrument.

**Evidence — four firsthand instances in one day, plus fleet corroboration.**
- `bun run src/cli.ts check-latest` printed **nothing** and exited **0**. Read as "the tool found no
  stale slugs"; it actually never ran — `src/cli.ts` has no `import.meta.main` guard. One step from
  being filed as a silent-success defect in our own CLI.
- A negative-control loop reported blank pass/fail counts for all 7 controls because the extractor
  regex did not account for ANSI colour codes. It *looked* like the controls ran.
- A scan for emails in the handoff archive returned empty. Only a positive control (`someone@example.com`
  through the same regex) plus a proven-non-empty file list made that an actual finding.
- An `rc=$?` after a pipeline read `tail`'s status, not `git commit`'s — reporting exit 0 for a commit
  that had in fact been blocked.
- Across the fleet the same day: a `| head ||  echo "(none)"` whose pipe swallowed grep's status; a
  caret-anchored grep reporting "0 gate announcements" about a hook watched printing eight; a probe
  using `<home>` in angle brackets against an alphanumeric-led regex that **could not match at all**.

**Trigger.** Any negative, empty, zero-count, or silent result that is about to become a recorded
verdict — a grep with no hits, a tool with no output, an audit finding nothing, a gate reporting clean.

**Failure mode.** A false negative that closes an investigation. Uniquely dangerous because it is
*self-terminating*: nothing downstream re-opens it, and the absence of a finding is invisible.

**Mitigation.** The three-rung ladder, in order — `command -v` answers *is it on my PATH*; a directory
check answers *is it installed*; **a known-positive probe answers whether it has anything to say.** Only
the third supports a verdict. Assert the true exit code (never a pipeline's), and never suppress stderr
on a verification run.

**Recurrence count:** 4 firsthand (2026-07-25) + 6 corroborated across 5 peer trees the same day. The
class does not close at a count — it closes when somebody stops writing probes.
