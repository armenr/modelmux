---
entry_type: lesson
provenance: llm-reviewed
maturity: evergreen
status: active
severity: high
module: testing
type: engineering
created: 2026-07-25
last-modified: 2026-07-25
last-applied: 2026-07-25
related: []
tags: [lesson, testing, non-vacuity, negative-control]
---

# LP-003 — Red-test the test: a guard you have never watched fail is not yet a guard

**Question.** How do you know a passing test is checking the thing its name claims?

**Claim.** Run every guard against the plausible **wrong** implementation before trusting it. A test can
pass for reasons unrelated to the property it asserts, and its name then actively misleads — it reads as
coverage while providing none. Break the guarded thing on purpose, watch the control go red **for the
right reason**, restore, and verify the restore.

**Evidence.**
- *The original.* A test named "a tag inserted by `tagAgent` is the one the router actually extracts"
  fed `extractSignals` the whole file **including front matter** — so it could not detect a tag written
  into the front matter, the exact defect it existed to catch. Only a deliberate red-test exposed it;
  fixing the test took the falsifier count from 1 to 3.
- *Applied at scale.* The Codex work shipped 8 guards; **all were watched fail** (7 in one batch, 1
  separately), each naming the right test, with `git hash-object` confirming a byte-identical restore.
- *The refinement, learned the hard way.* A negative control on a **subset** is only evidence if you can
  say why the subset is representative. The first control for the lint-suppression finding flipped
  **one** of 17 files — `log.md`, whose references all resolve, making it the file *least* able to
  produce a finding — got zero, and nearly went out as "latent on this tree". Flipping all 17 found two
  real defects. "It was the first one I tried" is not a representativeness argument.

**Trigger.** Writing any test whose name asserts a specific property; adding any gate, hook, linter or
guard; before recording that a check "passes".

**Failure mode.** A vacuous guard is **worse than no guard** — it manufactures confidence. And it is
byte-identical in output to a working one, so nothing will ever tell you.

**Mitigation.** Break it deliberately and watch it fail; confirm the failure names the right cause;
restore and verify the restore (blob hash). For a subset control, state why the subset is
representative — or widen it.

**Recurrence count:** 3+ (2026-07-25: the original `tagAgent` test, the 8-guard Codex batch, the
subset-control near-miss).
