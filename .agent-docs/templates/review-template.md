<!--
Review report template — one REV-NNN per review pass. The disposition contract is canonical in
standing-rules-core.md ("Capture ALL review feedback"); this scaffold does NOT restate it — every
finding, every severity, gets a durable home + an explicit disposition.
Instantiate to `.agent-docs/reviews/REV-NNN-<slug>.md` (next sequential id, 3-digit). Add a row to
`reviews/index.md` (the ledger table) in the SAME change. Reproduce each finding firsthand on the
live tree before filing it. Log: `## [DATE] review | REV-NNN <short>`.
APPEND-ONLY report; dispositions UPDATE IN PLACE as findings resolve.
Delete this comment block + the inline guidance once filled in.
-->

---
provenance: llm-draft            # llm-draft until the operator signs the dispositions → llm-reviewed
template-version: 1.0.0
created: <YYYY-MM-DD>            # LOCAL date (§2)
last-modified: <YYYY-MM-DD>
work-unit: WU-NNNN
related: []                      # [ADR-NNNN, OQ-NNN, FR-NNNN] — must resolve
tags: [review]
---

# REV-NNN — <what was reviewed> — <WU-NNNN>

- **Review type:** <adversarial design review | security red-team | /code-review | verifier gate>
- **Reviewer:** <clean-context verifier ≠ the builder; the security reviewer is the red-team>
- **Target:** <the diff / design / doc under review, with a git SHA or path>
- **Verdict:** <pass | pass-with-findings | block>

## Findings
<!-- One block per finding. Severity ∈ BLOCKER · MAJOR · MINOR · NIT.
     Disposition ∈ FIXED · DEFER(+reason) · WONTFIX(+reason) · TRACKED(→OQ-NNN);
     a DEFER/TRACKED finding cites an OQ-NNN that references it back. -->

### F1 — <one-line finding title>
- **id:** `REV-NNN-F1`
- **severity:** <BLOCKER | MAJOR | MINOR | NIT>
- **lens:** <OPTIONAL — the review lens/angle that produced the finding; omit if the pass had one lens>
- **claim:** <the defect, stated as a falsifiable claim>
- **evidence:** <file:line · a repro · a trace · the failing assertion — reproduced firsthand on the live tree>
- **disposition:** <FIXED | DEFER (reason) | WONTFIX (reason) | TRACKED → OQ-NNN>
- **x-ref:** <the WU/ADR/OQ this finding joins to>
- **test-obligation:** <the named RED-on-HEAD test that would have caught it / must be added; or "unbound → <owner>">

### F2 — <one-line finding title>
- **id:** `REV-NNN-F2`
- **severity:** <…>
- **claim:** <…>
- **evidence:** <…>
- **disposition:** <…>
- **x-ref:** <…>
- **test-obligation:** <…>

## Deferred obligations (OPTIONAL — delete if none)
<!-- Findings the current harness/fixture structurally CANNOT bind to a test here (e.g. a hermetic
     fake cannot fault-inject a live failure). Each becomes an explicit TRACKED → OQ-NNN so the half
     of the guarantee this pass can't reach is not silently dropped at acceptance. -->

## Related
- WU: `WU-NNNN` · any spawned `OQ-NNN` · the ADR / FR-NNNN under review
