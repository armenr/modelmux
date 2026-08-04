---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-04
tags: [current, status]
related: [work-plan, open-questions, handoff, obligations]
---

# Status — modelmux · the fix batch is DEPLOYED and accepted live · 2026-08-04

## TL;DR

The five fixes from 2026-07-30 are **running in production**, and all four owed acceptances passed
against the live service — including the one that was explicitly recorded as IMPL-not-WIRED. The
running binary is **sha256-equal to a fresh build of HEAD**, verified by hashing `/proc/<pid>/exe`
rather than trusting the installed copy. Two operator decisions remain untouched: the **release
version** and the **independent review fan-out**.

## Branch / working tree

- On **`main`** at `abfc6fa`, **0 ahead / 0 behind**, working tree **clean**.
- **PR #20 `chore(main): release 1.0.0`** open — release-please bumped to a MAJOR off the `!`
  breaking change in `e29f344`. **NOT merged, and the version was NOT overridden** (see work-plan).
- **PR #19** dependabot still HELD — CI red, disarms lint AND typecheck (`OQ-009`).
- `CLAUDE.md` still carries the **skip-worktree** bit (`OQ-003`).

## Build / test state

Gates measured 2026-08-04: `lint` ✅ · `build` ✅ · `bun test test/` ✅ **248 pass** ·
`reachability` ✅ (17 files, all reachable) · doc-lint ✅ 50 files.

## Runtime state (delta) — the proxy is on HEAD for the first time since 07-29

- `modelmux.service` **active**, running exe `eae8ed25…` == fresh HEAD build. Previous binary kept
  at `$CLAUDE_JOB_DIR/tmp/modelmux.rollback` (`38f0c765…`) as a rollback point.
- Restarted 2026-08-04 12:01 local, into a **verified-empty flight deck** (zero genuine hex-id
  subagent decisions in the prior 30 min).
- Live `routes.toml` now carries **three** aliases: `orchestrator` (anthropic passthrough),
  `reviewer` → `zai-max:glm-5.2`, and **`builder` → `codex:gpt-5.6-sol`** with
  `extraBody = { reasoning = { effort = "high", summary = "auto" } }` and deliberately no
  `minMaxTokens` (`OQ-019`).
- **`decisions.jsonl` now contains `kind: "usage"` rows** (3 so far) alongside decision rows — new
  in this build. Any query that reads "the last row for an agent" may now land on a usage row,
  which has **no `matchedRule`**.

### Acceptances run against the live service

| what | result |
|---|---|
| `ADR-0004` anchoring live | ✅ — and it caught our own probe's inline tag on the first request |
| `OQ-021` reasoning summary | ✅ **WIRED** — `['thinking','text']`, 113 thinking chars, `end_turn` |
| `OQ-015` usage logging | ✅ both paths — `zai-max in=37 out=211`, `codex in=33 out=18` |
| `OQ-020` hot-reload | ✅ in production, including case 3 (survived a second atomic replace) |

## Context-system state

Fieldbook **0.8.2** Standard, `multi_party: true`. ADRs at **0004** (`ADR-0004` — the `<<route:>>`
own-line rule). Memories: **9**. Lessons: **10** filed (`LP-001..010`) — 6 evergreen, 4 budding, **none staged**. **Open questions:
`OQ-008`, `OQ-009`, `OQ-010`, `OQ-012`, `OQ-018`.** No `checkpoints/` sitrep exists.

## What this means for next steps

Nothing in the repo is blocked. The two live decisions are both operator-owned and neither is
technical: the **release version** (1.0.0 vs 0.6.0) and whether to authorise the **independent
review fan-out** — zero independent review has happened on any of this code, which is the largest
outstanding risk in the tree, not any open OQ. Remaining OQs are backlog: `OQ-018` is the operator's
shell, `OQ-010` has three recorded firings arguing for itself, and `OQ-008`/`OQ-009`/`OQ-012` are
unchanged. See `work-plan.md` §Immediate next.
