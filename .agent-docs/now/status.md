---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-29
tags: [current, status]
related: [work-plan, open-questions, handoff, obligations]
---

# Status — modelmux · a billing incident fixed, GLM max-reasoning shipped · 2026-07-29

## TL;DR

**A real defect cost the operator money, and it was ours.** `anthropic:passthrough` preferred an env
`ANTHROPIC_API_KEY` over the caller's subscription OAuth — **93 orchestrator requests, ~15.2M input
tokens** billed to a metered account. Fixed, with the root cause recorded: *a test had SPECIFIED the
defect and kept it green.* Shipped alongside it: reviewers now route to **GLM at max reasoning effort**
with reasoning carried back as Anthropic `thinking` blocks. Five commits pushed; release PR **#20 is
`0.6.0`** and correct.

## Branch / working tree

- On **`main`** at `66399b9`, **0 ahead / 0 behind** origin, working tree **clean**.
- Latest tag `v0.5.1`; **PR #20 (`chore(main): release 0.6.0`) open and correctly versioned** — 2 `feat:`
  + 1 `fix:` in the push, so a MINOR bump is the honest number. It self-corrected from `0.5.2`.
- `CLAUDE.md` still carries the **skip-worktree** bit (`OQ-003`); it now also holds the operator's
  dated dispatch-authorization block.

## Build / test state

- Gates green, **measured 2026-07-29**: `lint` ✅ · `typecheck` ✅ · `reachability` ✅ · `build` ✅ ·
  `bun test test/` ✅ **213 pass** · doc-lint ✅ 48 files.
- **Installed binary == a fresh build of HEAD** (`sha256` compared, not assumed).

## Runtime state (delta) — the proxy is LIVE on this machine now

This reverses a long-standing memory: modelmux used to be built-here-not-run-here. **It runs here now.**

- **`modelmux.service`** is a systemd **user unit**, `enabled` + `active`, and **verified across a
  reboot** (came back on its own, new pid, serving). Key material comes from `~/.config/modelmux/env`
  via `EnvironmentFile=` — never in the unit, never in git.
- Live routing config (`~/.config/modelmux/routes.toml`):
  - `<<route:review>>` → **`zai-max:glm-5.2`** — Coding-Plan endpoint, `reasoning_effort = "max"`,
    `minMaxTokens = 32000`
  - everything else (other subagents AND the orchestrator) → `anthropic:passthrough`, **untouched**
  - there is deliberately **no `anySubagent` catch-all** — GLM is opt-IN by tag
- **`aegis`** routes through it: `ANTHROPIC_BASE_URL` lives in that repo's
  `.claude/settings.local.json` (gitignored — **not** `settings.json`, which is tracked and public).

## Context-system state

Fieldbook **0.8.2** Standard, `multi_party: true`. ADRs at **0003**. Memories: **7**. Lessons: **6**
(`LP-001..006`; five evergreen with MOC rows — `LP-006` accepted this session). Reference docs: 5.
Work-units WU-0001..0003 all ✅ WIRED. **Open questions: `OQ-008`, `OQ-009`, `OQ-010`.** `LP-007` staged
awaiting a ruling. No `checkpoints/` sitrep exists.

## What this means for next steps

Nothing is blocked on this repo. The open work is **PR #19** (still held — it disarms lint *and*
typecheck), **`OQ-010`**'s gate fragments, and **one undecided design question**: whether to widen the
`<<route:>>` tag scan beyond `body.system`, which is the only thing standing between dynamically-spawned
agents and tag-based routing — and which carries a real code-injection tradeoff. See `work-plan.md`
§Immediate next.
