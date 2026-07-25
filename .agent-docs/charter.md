---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [meta, charter, mission, north-star]
related: [CONVENTIONS, glossary]
---

# charter.md — the long-term modelmux mission

THE mission anchor. **Pointers, not content** — this doc carries the *why* and the *durable
invariants* that outlive any single phase; it does **not** carry current state. For where we are right
now → [`now/status.md`](./now/status.md); for the plan + locked decisions →
[`now/work-plan.md`](./now/work-plan.md); for what's undecided →
[`now/open-questions.md`](./now/open-questions.md). When this charter and `now/*` disagree about *what
is true today*, `now/*` wins — this doc is the compass, not the odometer.

---

## What modelmux is
A batteries-included template for heterogeneous agent routing in Claude Code — keep the orchestrator on Claude, route chosen subagents to OpenRouter models via a small owned proxy.
<Expand to a short paragraph: the problem it solves, for whom, and the one sentence that captures the
thesis. This is the "why we exist," not the feature list.>

## Non-goals (what we deliberately do NOT build)
<The scope boundary — the tempting adjacent things this project is NOT. Guards against scope creep;
each non-goal is a decision you can point at when someone proposes it.>

## Operating posture
<The standing stance toward the codebase and the work — e.g. evolve-vs-rewrite, build-for-completeness
(not a demo slice), correctness-over-speed, embeddable/portable, whatever is load-bearing here. One
line each.>

## Long-term invariants (the compass — they outlive any phase)
<The load-bearing commitments that change only by an ADR that supersedes the one that set them. Number
them; keep each to a claim + a one-line why. Current decision IDs are pointers, not the rule's text.>

1. <invariant — the claim, and why it is non-negotiable.>
2. <invariant.>

## What this charter deliberately does NOT hold
- **Current state, phase, branch, live sequence** → `now/status.md` + `now/work-plan.md`.
- **The architecture decisions themselves** → `decisions/` (cite the ADR; never re-state its body
  here).
- **Open / undecided forks** → `now/open-questions.md`.

## Related
- [`now/status.md`](./now/status.md) · [`now/work-plan.md`](./now/work-plan.md) ·
  [`now/open-questions.md`](./now/open-questions.md) — current state, plan, undecided
- [`CONVENTIONS.md`](./CONVENTIONS.md) — schema · [`glossary.md`](./glossary.md) — framework jargon
