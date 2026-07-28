---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-28
last-modified: 2026-07-28
related: []
tags: [dispatch-gate, fail-loud, workflow, gotcha, mechanism]
---

# This repo's dispatch-gate DETECTS a silently-compacted fan-out — and lets it through as a WARN

**Observed:** 2026-07-28, measuring a peer's reported defect against our own shipped hook rather
than taking the report at face value.

## What was tested

The failure shape a peer hit: a `parallel()` **nested inside a `pipeline()` stage**, compacted with
`.filter(Boolean)`, then consumed as a **set** (`.length` and a ratio). `parallel()` null-fills a
dead agent, `filter(Boolean)` removes the null, and the array simply arrives **shorter with nothing
recording that it should have been longer** — so a finding whose refuter *died* gets promoted to
"survived adversarial review". A dead verifier confirming by absence.

Composed the way `self-test.py` composes fixtures — shipped `preamble.js` prepended — and fed to
`.claude/hooks/dispatch-gate/dispatch-gate.sh` as a real PreToolUse payload.

## The two results

**It DOES detect it.** `CW3` fires on the nested case, naming contract v1 R2 and pointing at
`fanout()`. Nesting inside a pipeline stage does not hide it. Known-positive control: the shipped
`fixtures/workflow/filter-boolean.js` fires the identical `CW3` through the same harness, so the
rule ran and could have failed. (`self-test.py`: 12 fixtures, both canaries fired, rc=0.)

**But it is a WARN, and warns never block.** The verdict is not a `permissionDecision` at all — it
is `additionalContext` with `rc=0`, and the payload says so in its own words:

```
[dispatch-gate] 1 advisory finding(s) (allowed — WARN never blocks)
```

**So the defect ships.** The gate prints a correct paragraph about it into the context of an author
mid-compose, which is precisely the moment nobody re-reads a paragraph — see `LP-005`. The mechanism
exists and its enforcement level is set to *reminder*.

## Avoid

- **Do not read "the gate is armed" as "the gate blocks this."** Armed, detecting, and blocking are
  three different states, and this rule sits in the middle one.
- **Do not conclude coverage from a BLOCKED verdict without checking WHICH rule blocked.** The first
  run of this test came back blocked — on `CW1` (missing preamble) and `CB4` (bare return), two
  unrelated rules masking the one under test. A verdict of the right *shape* for the wrong *reason*
  reads exactly like a pass. Isolating a rule needs the preamble present and a real manifest return.
- **Do not assume promoting CW3 is cheap.** Measured here 2026-07-28 after a peer refuted the
  "one token" reading: `self-test.py:111` carries the literal pair `{("CW3", "WARN")}` in its
  expected set, so flipping the severity **goes red** — the change is a coordinated multi-artifact
  edit whose regression test must move with it, not a constant swap. Severity is also
  **per-call-site, not per-rule** (`CB4` is FAIL in `check_workflow` and WARN in `check_agent`).
- **`CW3` is NOT waivable, and the shipped docs say it is.** `apply_escape_hatch`'s own docstring
  reads *"Downgrade **FAIL**s that a well-formed degraded annotation waives"* — yet both
  `.claude/hooks/dispatch-gate/README.md:82` and
  `.agent-docs/reference/fail-loud-dispatch-contract.md:118` use `checks: CB4, CW3` as the worked
  example. CW3 is WARN, so that documented waiver **cannot fire**. Reproduced independently on a
  second tree. Kit-owned — do not patch; it arrives on upgrade.
- **Do not blanket-promote CW3 to FAIL.** `filter(Boolean)` is genuinely correct when downstream only
  ever touches ONE item; a blanket FAIL would false-positive on that independent case and get
  disabled. The safe discriminator is whether the **set** crosses the boundary (`.length`, a ratio, a
  serialization, a synthesis prompt) rather than its members — a static property, not an intention.

## Fix / workaround

Route dependent fan-outs through `fanout()`, which asserts completeness by construction. Placement
gotcha, reported by the peer and worth keeping: **assert at the BARRIER, not inside a pipeline
stage** — a throw inside a stage is caught per-item and becomes a null, so the run misreports "item
X missing" when the truth is "item X's sub-fan-out lost two units". Carry the per-fan-out counts out
of the stage as data.

## See also

Raised fleet-wide by `filemage-gen2` (2026-07-28); measured here and reported back as `56746154` —
the ask reframed from "build a check" to "promote CW3 to FAIL on an aggregate consumption site".
`fieldbook` owns the hook; do not patch it locally.
