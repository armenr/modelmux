---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [current, work-plan, decisions]
related: [status, open-questions]
---

# Work plan — modelmux

<!-- The plan + the locked decisions + the immediate next action. UPDATE-IN-PLACE as work progresses.
     The board/backlog/completed split is optional; keep whatever shape stays true with least effort. -->

## The plan (phases / milestones)
<The current phases or milestones, each with a one-line state (done / in progress / not started). Keep
it coarse — this is the map, not the turn-by-turn.>

## Locked decisions (this cycle)
<The decisions that are settled and should NOT be re-litigated without an ADR. One line each; link the
`ADR-NNNN` that owns each where one exists.>

## Immediate next
> **🎯 CURRENT — <WU-NNNN>: <one-line objective>.** <The next concrete step, actionable cold; the
> acceptance bar; the do-NOT (e.g. do not push without an explicit go). Link the plan/build doc that
> carries the detail.>

## Work-unit spine
<One row per active/queued work-unit. A `WU` is done only when it is WIRED (reachable from a production
entrypoint) or has a recorded `DEFER` — not merely test-green.>

| WU | Objective | Depends | Status |
|---|---|---|---|
| WU-0001 | Give the CLI a way to add a FIRST `<<route:>>` tag, so untagged third-party agents can be pinned instead of silently diverted by the `anySubagent` catch-all | — | WIRED |
