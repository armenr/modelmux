---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-25
tags: [current, status]
related: [work-plan, open-questions, handoff, obligations]
---

# Status — modelmux · three wire formats native, WU-0003 committed; cleanup done · 2026-07-25

## TL;DR

modelmux now **speaks three wire formats natively**, which was the point: one binary, users bring
their own subscriptions and local runners, no second daisy-chained process. Landed this session:
`v0.4.0` released (tag + 5 binaries, fully automated), Fieldbook installed, Kimi Code built in, and
both OpenAI adapters — **Chat Completions** and **Responses** — plus Codex subscription auth.
**WU-0003 is now COMMITTED**; the three shipping inconsistencies (dangling ADR-0003 citation, the
ADR-0002 contradiction, the stale LiteLLM README advice) are **all closed**. Codex auth *acceptance*
remains **unverifiable** — OpenAI's endpoint is circuit-broken and their own CLI fails identically.

## Branch / working tree

- Branch `feat/subscription-upstreams` (base: `main`), **5 commits ahead of `origin/main`**,
  PR **#15 OPEN**, retitled to *"speak OpenAI wire formats natively — Chat Completions, Responses, and
  flat-rate subscriptions"*. `main` is at `cd4ac71` (release 0.4.0).
- `7ef2d4c` — WU-0003 work: `src/responses.ts`, `test/codexauth.test.ts`, `codex` auth kind + built-in,
  three `node:path.join` portability fixes.
- `fd08a9a` — README: wire-format docs, Codex section rewrite, **and a security-claim correction** (the
  section asserted modelmux "is not a tool for using a ChatGPT subscription outside its official
  client", which the `codex` built-in makes false; it now states the real bright line and names the
  grey area).
- Uncommitted: `.agent-docs/` only.

## Build / test state

- Gates all green: `bun run lint` ✅ · `bun run typecheck` ✅ · `bun test test/` ✅ **137 pass** ·
  `bun run build` ✅ compiles · doc-lint ✅ clean 35 files · index-lint ✅ rc=0.
- **Toolchain note:** `bun install --frozen-lockfile` must have run or `lint`/`typecheck` exit **127**
  (`eslint`/`tsc` not found) while `bun test` still passes — a partial green that looks fine.

## Runtime state (delta)

- **Three wire formats:** `format = "anthropic"` (default, untouched fast path) · `"openai"`
  (`src/openai.ts`) · `"responses"` (`src/responses.ts`, uncommitted).
- **Five built-in upstreams:** `anthropic`, `openrouter`, `zai`, `kimi`, and `codex` (uncommitted).
- **New auth kind `codex`** — READS the credentials `codex login` already wrote; modelmux never
  performs the login and never writes that file.

## Context-system state

Fieldbook **0.8.2** Standard, `multi_party: true`. ADRs at **0002** — note **ADR-0003 is cited in
`src/upstreams.ts:49` but does not exist**, and ADR-0002 (status `accepted`) is now *contradicted* by
shipped code. Memories: 1. Reference docs: 5. Work-units: WU-0001..0003. No `checkpoints/` sitrep.

## What this means for next steps

Three inconsistencies are **currently shipping** and are the agreed next action: the dangling ADR-0003
citation, the ADR-0002 contradiction, and a README section still telling users to run LiteLLM for Codex.
Fix those, then commit WU-0003 onto PR #15 and retitle the PR honestly. Codex acceptance-testing and
refresh-token handling are parked behind OpenAI's outage, not behind us. See `work-plan.md`
§Immediate next.
