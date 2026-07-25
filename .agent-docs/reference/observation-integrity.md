---
provenance: kit-template
created: 2026-07-18
last-modified: 2026-07-18
tags: [reference, observation-integrity, gates, contract]
related: [fail-loud-dispatch-contract, doc-refs-contract]
---

# The observation-integrity contract

**The problem this exists for:** a filtered, failed, or truncated view is byte-indistinguishable
from a clean or empty world. A gate that errored and a gate that passed can both print nothing.
A truncated flood and no flood look the same. Field record: a known, written, self-cited rule
("never answer from absence") was violated three times in one session by a compliant agent —
twice into durable records, once as a fabricated acceptance proof in a traceability ledger —
because the failure is INVISIBLE at the point of observation. A rule that exists, is known, and
still fails needs MECHANIZATION, not restatement.

## The one-line test (apply before recording ANY observation)

> **"If this instrument were broken, empty, or truncated, would my output look any different?
> If no — you do not have an observation, you have an artifact."**

## The three failure shapes (they need DIFFERENT gates — none substitutes for another)

- **(a) The tool failed and silence read as clean.** An errored command with empty stdout,
  hidden stderr, unchecked exit code → recorded as "clean". *Caught by the runtime rules below.*
- **(b) The stored verdict rotted.** A recorded YES is a snapshot of an author belief, never
  re-derived; it drifts silently while staying green. Field measurement: a registry asserting
  100% non-vacuous bindings measured at 65/83 genuine under mutation-verification. *Caught by
  re-derivation at point of use — prefer storing the BREAK (broke X, watched Y fail for reason
  Z, restored) over storing the link: a break that stops firing shows up as a test that stops
  failing; a stored link rots invisibly.*
- **(c) The query is inverted from the proposition.** The instrument runs PERFECTLY — exit 0,
  truthful output, nothing malfunctions — but it answers a DIFFERENT QUESTION than the verdict
  claims. Field cases: a dead-code gate invoked with test binaries as extra roots (can only make
  MORE code reachable — the weakest possible probe for built-but-not-wired, the exact failure it
  existed to catch: 48 findings bare vs 0 with the flag, same commit); a process-reaper whose
  kill-marker existed only in a wrapper process ("I killed a process" ≠ "the watcher is dead").
  *(c) DEFEATS every (a)-gate: exit codes pass, and a canary only proves the instrument FIRES,
  not that it fires on the RIGHT proposition. Caught only at design time — see the entailment
  requirement.*

## Runtime rules (mechanize these; MUST for any command whose output becomes a recorded verdict)

1. **Pinned-runner-only.** Gates and verifications run ONLY via the pinned task-runner target
   (`{{LINT_CMD}}`, `{{TEST_CMD}}`, a justfile/Makefile recipe) — never a hand-rolled
   re-derivation of the invocation. The field incident: a hand-rolled run without the pinned
   version errored on a missing dependency and its empty stdout was recorded as proof.
2. **Assert exit 0.** Never infer success from empty output. Capture-and-test, never
   pipeline-exit (`head` exits 0 on empty input; `$(...)` captures stdout while the exit
   status falls on the floor unless checked).
3. **Never `2>/dev/null` on a verification command.** It converts a loud failure into a silent
   false pass. Stderr on a gate is signal, always.
4. **"Empty == clean" owes a canary that fired THAT run.** Absence is evidence only after the
   instrument is proven live — a known-positive planted case must fire in the same run that
   claims emptiness.
5. **Harness-summarized views owe a raw-source re-derivation.** Any claim drawn from a
   truncated notification, batched event stream, `head`/`grep` pipeline, or tool-result preview
   must be re-derived from the raw source BEFORE it is posted or recorded. The truncation is
   invisible in the resulting claim — it reads as firsthand when it is not. (Field case: an
   88-line flood presented as ~6 lines + "(truncated)" and was reported as "no flood" — to a
   peer who was actively debugging that flood.)

## The entailment requirement (design-time; the only gate that catches shape (c))

Every gate/instrument whose output feeds a verdict owes a WRITTEN entailment statement at its
definition site: **what QUESTION does this invocation actually answer, and does that answer
ENTAIL the proposition the verdict asserts?** If the query answers a different question, say
which, and what covers the gap. The known tells:

- **The reuse tell:** a query silently changes proposition when it is REUSED across two
  purposes (a pattern built for detecting arming reused for reaping; a reachability query
  built for deletion-candidates reused for wiring-proof). Reuse of an instrument = re-derive
  the entailment, every time.
- **Fixing an inversion is not always a one-token swap.** The corrected query may be NOISY
  where the inverted one was quiet (the honest dead-code query surfaced 46 legitimate test-infra
  hits alongside the 2 real ones) — budget for an allowlist or a per-unit witness query, not
  just a flag change.

## The classified-residual rule (IMPL→WIRED records)

A wiring claim's record ENUMERATES and CLASSIFIES its residual (each bare finding: test-only /
deferred / dead) — never a bare "clean". An unclassified residual is an unread instrument.

## Seam

This contract governs OBSERVATIONS (what may be recorded as seen). The fail-loud dispatch
contract governs COMPLETENESS (what may be claimed as covered). The deferral test governs
OMISSIONS (what may be skipped). A verdict must survive all three.
