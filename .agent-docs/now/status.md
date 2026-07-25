---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [current, status]
related: [work-plan, open-questions, handoff]
---

# Status — modelmux · <one-line current headline> · <YYYY-MM-DD>

<!-- The always-current "where are we?" snapshot. UPDATE-IN-PLACE at /flush and /handoff.
     Keep it short and true; history lives in the version-control log, not here. -->

## TL;DR
<One short paragraph: the active work-unit (`WU-NNNN`), what just landed, what is next. Replace on
every update; this is the first thing read at session start.>

## Branch / working tree
- Branch `<branch>` (base: `main`). <pushed? ahead-by-N? never-stage list, if any.>
- HEAD `<short-sha>` — <one-line description of the tip commit.>

## Build / test state
- Gates: `bun run build` · `bun test test/` · `bun run lint` · `` — <last-run result / clean
  or the failing gate.>
- <Any environment/toolchain note needed to reproduce a green build.>

## Context-system state
- <What changed in `.agent-docs/` this session: new ADRs / lessons / OQs / checkpoints; lint state.>

## What this means for next steps
<The concrete next action, and why. Should agree with `work-plan.md` §Immediate next — if they
disagree, `now/*` wins and this line is the tiebreaker for "today".>
