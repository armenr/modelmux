---
entry_type: lesson
provenance: llm-reviewed
maturity: budding
status: active
severity: high
module: verification
type: engineering
created: 2026-08-04
last-modified: 2026-08-04
last-applied: 2026-08-04
related: []
tags: [lesson, verification, acceptance, deploy, false-negative]
---

# LP-010 — When an acceptance probe reports failure, suspect the PROBE before the system

**Question.** Your post-deploy acceptance just came back negative. Is the change broken, or is the
thing measuring it?

**Claim.** The probe is newer, less exercised and more likely wrong than the thing it measures — yet
a probe failure and a real defect are **byte-identical** in what they show you. Two distinct shapes:

1. **The input does not exercise the feature.** The probe runs, the feature is fine, and the stimulus
   never asked the feature to do anything. The result reads as "the capability is absent."
2. **The probe still uses a shape the change deliberately invalidated.** Your tooling encodes the OLD
   contract more densely than anything else you own, so a breaking change's first casualty is your own
   diagnostics — presenting as a broken deployment.

In both cases the correct action is to fix the probe, and the tempting action is to debug — or roll
back — working code.

**Evidence.** Both firsthand, 2026-08-04, minutes apart during the same live deploy.
- *Shape 1.* `OQ-021`'s acceptance asked the codex leg to *"Reply with exactly: BUILD LEG OK"* and got
  `['text']` with no thinking block, reading as a failed reasoning-summary carry-back. A task requiring
  no reasoning generates no summary to carry back. Re-run with a question that genuinely demands
  reasoning: `['thinking','text']`, 113 thinking chars, immediately. The probe had measured the
  **prompt**, not the code.
- *Shape 2.* The very first request after deploying `ADR-0004` fell to
  `default -> anthropic:passthrough`. The probe sent an INLINE `<<route:review>> …` — precisely the
  form the change stops routing. The breaking change was working perfectly and presenting as a failure.

**Trigger.** A post-deploy or post-implementation acceptance returns a negative result — the feature
appears absent, the routing appears wrong, the output appears empty. Sharpest at deploy time, when
confidence is lowest and a rollback looks like the responsible move.

**Failure mode.** A correct change is debugged, reverted, or shipped with a false "known issue" note.
The rollback is the expensive one: it destroys a good change while looking prudent, and the real defect
count for that change is recorded as non-zero forever.

**Mitigation.** Before debugging a failed acceptance, re-read the probe against the change you just
shipped and ask two questions: **does its input actually exercise the feature**, and **does its shape
still satisfy the new contract?** When shipping a breaking change, audit your own probes and fixtures
for the old shape *as part of the change*, not after the deploy surprises you.

**Recurrence count.** 2 (both 2026-08-04, same deploy, distinct shapes).

**Distinctness.** Not `LP-003` (vacuity — the guard CANNOT fire) and not `LP-008` (the guard fires
correctly for the WRONG proposition). Here the guard can fire and is aimed correctly; the **stimulus**
is wrong. Together the three cover the axis: can't fire · fires at the wrong claim · fires but was
never provoked.
