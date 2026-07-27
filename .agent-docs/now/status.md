---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-27
tags: [current, status]
related: [work-plan, open-questions, handoff, obligations]
---

# Status — modelmux · v0.5.1 shipped, board clear, nothing in flight · 2026-07-26

## TL;DR

**Two releases shipped and artifact-verified.** `v0.5.0` made modelmux speak three wire formats
natively — one binary, no daisy-chained second process, which was the whole point. `v0.5.1` gated
reachability in CI and fixed the dead code that gate found on its first run. **Seven of eight open
questions closed**; four lessons promoted to the ledger. Working tree clean, nothing uncommitted,
nothing in flight. The one open item is a **dependabot PR that must not be merged as-is**.

## Branch / working tree

- On **`main`** at `8b989bb`, **0 commits ahead of origin**, working tree **clean**.
- Tags: **`v0.5.1`** (latest) · `v0.5.0` · `v0.4.0`.
- `CLAUDE.md` carries the **skip-worktree** bit (`git ls-files -v` → `S`): the committed copy has no
  partyline block, the local copy does. See `OQ-003` for the branch-switch procedure.

## Build / test state

- Gates all green, **measured 2026-07-26**: `bun run lint` ✅ · `bun run typecheck` ✅ ·
  `bun run reachability` ✅ · `bun run build` ✅ · `bun test test/` ✅ **156 pass** ·
  doc-lint ✅ 43 files.
- **The pre-commit gate is ARMED and proven** (`core.hooksPath=.githooks`). It had silently skipped
  16 commits before this session. Undo: `git config --unset core.hooksPath`.
- **Caveat on the doc-lint number:** 17 of the 43 files carry `provenance: kit-template`, which
  disables rules 8/15/21/12 on them — see
  `memories/doc-lint-clean-is-a-partial-claim-kit-template-provenance-disables-four-rules.md`.

## Runtime state (delta)

- **Three wire formats:** `"anthropic"` (default, untouched fast path) · `"openai"` (Chat
  Completions) · `"responses"`.
- **Five built-in upstreams:** `anthropic`, `openrouter`, `zai`, `kimi`, `codex` — all shipped, and
  `codex` field-tested live end-to-end (non-streaming, streaming, tool call, tool-result round trip,
  streaming tool-call fragment reassembly).
- **Reachability oracle** (`bun run reachability`, ~169 ms) in `check` and CI. Tests are deliberately
  NOT entrypoints; `test/reachability-config.test.ts` guards that.
- **The proxy is NOT running here** — routing config is specification, not observation. See
  `memories/the-proxy-is-not-running-on-the-development-machine.md`.

## Context-system state

Fieldbook **0.8.2** Standard, `multi_party: true`. ADRs at **0003** (ADR-0002 superseded).
Memories: **3**. Lessons: **5** (`LP-001..005`; **four** evergreen with MOC rows — `LP-005` accepted
2026-07-27). Reference docs: 5. Work-units: WU-0001..0003, all ✅ WIRED. **Open questions: `OQ-008`,
`OQ-009`, `OQ-010`** — OQ-001..007 all resolved 2026-07-25. Lesson staging is empty. No
`checkpoints/` sitrep exists for this session.

## What this means for next steps

Nothing is blocked and nothing is half-done. The immediate action is **triaging PR #19**, which
groups a *major* TypeScript bump into a routine dev-deps update and fails CI — merging it would
disarm lint and typecheck at once. After that, the `OQ-008` remainder (per-provider probing in
`check-latest`) is the only substantive open work. See `work-plan.md` §Immediate next.
