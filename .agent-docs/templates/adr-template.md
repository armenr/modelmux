<!--
ADR template per CONVENTIONS.md §5 (decision policy) + §2 (front-matter) + §8 (versioned templates).
Instantiate to `.agent-docs/decisions/NNNN-kebab-claim-as-title.md` and fill in.
  NNNN = next zero-padded 4-digit sequential ADR number · title = the decision AS A CLAIM.
Record the `template-version` you scaffolded from (§8) so drift is detectable, not invisible.
The `## Alternatives Considered` field is authored BEFORE the work, not reverse-engineered after (§5).
Delete this comment block + the inline guidance comments once filled in.
-->

---
provenance: llm-reviewed        # §2 — accepted ADRs may NOT be llm-draft/llm-autonomous
status: proposed                # proposed → accepted/rejected → superseded/deprecated (§2, §5)
                                # §5 veracity gate: proposed→accepted needs load-bearing reality-claims [code-verified]
template-version: 1.0.0
created: <YYYY-MM-DD>            # LOCAL date (date +%Y-%m-%d), not UTC (§2)
last-modified: <YYYY-MM-DD>
work-unit: WU-NNNN              # §4 spine — the work-unit this decision serves
supersedes: []                  # ADR(s) this overrides (they get status: superseded + superseded-by)
superseded-by: null             # back-pointer, set if THIS ADR is later overridden
related: []                     # ADR / memory / OQ ids in the breadcrumb graph
tags: []
---

# ADR-NNNN — <the decision stated as a claim>

## Context
<!-- What forced this decision. The problem, the constraints, what triggered it now. -->

## Alternatives Considered          <!-- MANDATORY (§5) — the dead-ends ARE the value -->
<!-- Each rejected option + WHY it was rejected (its superseded-but-instructive lesson).
     A summarizer that drops these destroys the WHY. Written BEFORE acting.
     Capture the LOAD-BEARING why, not just the verdict: the deciding axis, a runner-up STEELMAN, and the
     flip-condition (below). If the conversation was richer than this section, it isn't done. -->
- Option A — rejected because …
- Option B (the runner-up) — genuinely strong because … (no strawman) · rejected because … (on the deciding axis)
- <Chosen option> — named here; defended in Decision.

**Deciding axis:** <the one dimension the choice turned on — the thing that, if it changed, changes the answer>.
**Axis check (test it against YOUR OWN option before writing Decision):** does the deciding axis
SELECT the chosen option too — by the same criterion that killed the runner-up? If defending your
choice reaches for a DIFFERENT justification than the one that rejected the alternatives, the axis is
rhetoric reverse-engineered from the conclusion. The tell: a second, softer criterion appearing in
Decision that never appeared here. (Field-found: an ADR named an axis, used it to kill the runner-up,
then chose an option that failed the same axis — flagged by its reviewer as the clearest author-bias
tell in the document.)
**Flip-condition:** <what would reverse this — a different goal, new evidence, a changed constraint
(e.g. "for a product rather than a reference architecture, we'd choose the runner-up")>.

## Prior art / reference
<!-- Cite the backing reference architecture, canonical pattern, or ecosystem precedent.
     If the shape is novel, say so and cite the absence of prior art as a risk. -->

## Decision
<!-- What we chose, in one paragraph. -->

## Consequences
<!-- What this means going forward — good AND bad. Name the costs, not just the wins. -->

## Related
<!-- ADR-XXXX · memories/some-gotcha · WU-NNNN · the log.md entry where this was decided. -->
