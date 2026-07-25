---
provenance: kit-template
created: 2026-07-09
last-modified: 2026-07-09
tags: [meta, index, routing, reviews]
related: [CONVENTIONS]
---

# reviews/ — routing catalog

Typed **review reports** (`REV-NNN`, 3-digit, monotonic, never reused): findings as a dispositioned,
test-mappable ledger. EVERY review pass that returns findings files one — an adversarial design
review, a clean-context verifier gate, a security red-team, a `/code-review` sweep
(schema authority `../CONVENTIONS.md` §7.4). EVERY finding gets a stable
`REV-NNN-FNN` sub-id and four columns: **severity** (`BLOCKER` · `MAJOR` · `MINOR` · `NIT`),
**disposition** (`FIXED` · `DEFER` (+reason) · `WONTFIX` (+reason) · `TRACKED` → `OQ-NNN`),
**x-ref** (the WU/ADR/OQ it joins to), and **test-obligation** (the named binding test that would
have caught it — or `unbound → <owner>`). Schema authority: `../CONVENTIONS.md` +
`../templates/review-template.md`.

> **Why this tier exists.** This directory is the durable home the findings-to-disk standing rule
> mandates ("Capture ALL review feedback — every severity, never just the blockers",
> `standing-rules-core.md`). A finding without a filed report and a terminal disposition is an open
> obligation that dies at compaction — minors and nits included.

## Entry purpose + naming

- **Purpose:** record one review pass — scope, method, verdict, and the full findings ledger — so
  dispositions are auditable and every finding maps to a test or a tracked owner.
- **Filename:** `reviews/REV-NNN-<slug>.md` (next sequential id; 3-digit).
- **Write-discipline:** reports are APPEND-ONLY — findings are never deleted or renumbered.
  Dispositions UPDATE IN PLACE as findings resolve (`FIXED` + SHA, `DEFER`/`TRACKED` citing the
  `OQ-NNN` that references it back).

## Reviews (ledger)

<!-- EXAMPLE (delete this block on the first real review):
| REV | WU | Type | Target | Verdict | Open when |
|---|---|---|---|---|---|
| `REV-001-example-slug.md` | WU-NNNN | adversarial design review | <the diff / design / doc reviewed, with SHA or path> | pass-with-findings | <re-reviewing this surface or its finding dispositions> |
-->

| REV | WU | Type | Target | Verdict | Open when |
|---|---|---|---|---|---|

## Maintenance

Filing a review adds a row here **in the same change** (backtick-token filename). Rows are never
removed — a retired/lost REV keeps a tombstone row so the ID stays resolvable. Disposition changes
update the report in place; the row's Verdict/Open-when follow only if they materially change.
