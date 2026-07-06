# hetero-agents

[![CI](https://github.com/armenr/hetero-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/armenr/hetero-agents/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-000000.svg)](https://bun.sh)

**Keep the Claude Code orchestrator on Claude, and route chosen subagents to
other models (GLM, Qwen, DeepSeek, MiniMax, …) via OpenRouter — through a small
proxy you own.**

Claude Code chooses its upstream from a single global env var
(`ANTHROPIC_BASE_URL`); there's no per-subagent model switch on the client. So
this template points Claude Code at a tiny local reverse proxy that inspects
each request and forwards it to the right place: your **main loop stays on
Claude**, while the **subagents you tag** run on cheaper or specialized models.

It's a **batteries-included, test-driven template** — clone it, plug in an
OpenRouter key, and you have a working heterogeneous-routing setup you can shape.

## Architecture

```text
   Claude Code  ──ANTHROPIC_BASE_URL──▶  hetero-proxy (:8787, Bun.serve)
                                              │
                       signals: agent-id?  x-app?  <<route:tag>>?
                                              │
                 ┌────────────────────────────┴────────────────────────────┐
                 ▼                                                          ▼
       main loop  ·  <<route:control>>                       tagged  ·  or any subagent
                 │                                                          │
                 ▼                                                          ▼
          api.anthropic.com                                        openrouter.ai/api
        (passthrough = stays Claude)                     (GLM · Qwen · DeepSeek · MiniMax)
```

Requests flow through three pure steps — `extractSignals` (`src/signals.ts`) →
`route` (`src/route.ts`) → auth rewrite (`src/upstreams.ts`) — and SSE streams
pass straight through untouched. OpenRouter's Anthropic-compatible endpoint means
no request translation is needed.

## Quickstart

```bash
bun install                                  # dev deps (or: devbox shell)
cp .env.example .env                         # set OPENROUTER_API_KEY (openrouter.ai/keys)
bun run proxy                                # → hetero-proxy listening on http://localhost:8787
cp .claude/settings.json.example .claude/settings.json   # opt Claude Code into the proxy
# ...then RESTART Claude Code (ANTHROPIC_BASE_URL is read at startup)
```

Now dispatch a subagent and watch it land on OpenRouter while the main loop stays
on Claude:

```bash
tail -n 5 decisions.jsonl
```

```text
{ "isSubagent": true,  "matchedRule": "tag:flagship", "upstream": "openrouter", "resolvedModel": "z-ai/glm-5.2" }
{ "isSubagent": false, "matchedRule": "default",      "upstream": "anthropic",  "resolvedModel": "passthrough" }
```

New here? Run the **`/getting-started`** skill, or dispatch the
**`setup-assistant`** agent — both walk you through this and verify each step.

## How routing works

The proxy routes on **request signals**, not the requested model string (which
sidesteps a Claude Code bug where a subagent's model can fall back to the
parent's). The key signals (`src/signals.ts`):

- `x-claude-code-agent-id` — present **only** on subagent requests (`isSubagent`).
- `x-app` — `cli` (foreground) vs `cli-bg` (background work).
- `<<route:alias>>` — an explicit tag in an agent's system prompt.

`route()` walks `routes.jsonc` top-to-bottom, **first match wins**:

| Order | When | Routes to | Upstream |
| ----- | ---- | --------- | -------- |
| 1 | `<<route:flagship\|max\|reasoner\|review\|claude-review>>` | that alias | OpenRouter / Anthropic |
| 2 | `<<route:control>>` | `orchestrator` | Anthropic (passthrough) |
| 3 | `workType: background` (`x-app: cli-bg`) | `cheap` | OpenRouter |
| 4 | any other subagent (`anySubagent`) | `flagship` | OpenRouter |
| 5 | default (the main loop) | `orchestrator` | Anthropic (passthrough) |

The main loop carries no `x-claude-code-agent-id`, so it never matches a subagent
rule — it falls to the default and **stays on Claude**. Want the full mental
model? Run the **`/explain-hetero`** skill.

## The model menu

Models live behind friendly aliases in [`routes.jsonc`](routes.jsonc) — swap one
in a single place:

```text
"models": {
  "orchestrator": "anthropic:passthrough",       // main loop — keep Claude's choice
  "flagship":     "openrouter:z-ai/glm-5.2",
  "max":          "openrouter:qwen/qwen3.7-max",
  "reasoner":     "openrouter:deepseek/deepseek-v4-pro",
  "review":       "openrouter:minimax/minimax-m3",
  "cheap":        "openrouter:deepseek/deepseek-v4-flash",
  "claude-review":"anthropic:claude-sonnet-4.6"
}
```

> The slugs above are illustrative — run `bin/hetero check-latest` to see which
> models actually exist on OpenRouter right now, and `hetero set` to update one.

The proxy **hot-reloads** `routes.jsonc` on save (and keeps the last good config
if an edit is invalid). Full switching guide: the **`/switch-models`** skill.

## The `hetero` CLI

```bash
bin/hetero models                              # list aliases → upstream:slug
bin/hetero set flagship openrouter:z-ai/glm-6  # repoint an alias
bin/hetero use glm-researcher reasoner         # retarget an agent's <<route:>> tag
bin/hetero check-latest                        # verify configured slugs exist on OpenRouter
```

Or override an alias for one run without editing files:
`HETERO_MODEL_FLAGSHIP=openrouter:qwen/qwen3.7-max bun run proxy`.

## Project layout

```text
src/            proxy core — signals, route, upstreams, server, config, log, jsonc, types, cli
bin/hetero      the switching CLI
scripts/        check-latest (catalog diff) · live-smoke (real e2e) · record-fixtures
routes.jsonc    the model menu + routing cascade
test/           hermetic bun:test suite (+ recorded request fixtures)
.claude/        agents + onboarding skills that ship with the template
docs/           design spec + implementation plan (see docs/README.md)
```

## Development

Requires [Bun](https://bun.sh). Two setups:

- **DevBox** (Nix-backed, reproducible): `devbox shell` provisions Bun, jq, and
  lefthook, loads `.env`, and installs git hooks.
- **Bun-direct**: `bun install`, then `lefthook install`.

The gates — all three must pass, and a `pre-commit` hook auto-fixes lint while
`pre-push` runs the tests:

```bash
bun run lint        # ESLint (Antfu config — also formats; no Prettier)
bun run typecheck   # tsc --noEmit
bun test test/      # hermetic (no network)
```

Real end-to-end check (opt-in; needs `OPENROUTER_API_KEY`, makes a billable call):

```bash
bun run test:live
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and conventions.

## Onboarding skills & agents

These ship in `.claude/` so a fresh clone can use them immediately:

- **`/getting-started`** — clone → install → key → run → verify.
- **`/explain-hetero`** — the mental model: why a proxy, the signals, the cascade.
- **`/switch-models`** — swap models, retarget agents, override at runtime.
- **`setup-assistant`** (agent) — checks Bun, your key, config, and the proxy,
  and reports what's left. Pinned to Claude via `<<route:control>>`.

Example subagents `glm-researcher` (`<<route:flagship>>`) and `minimax-reviewer`
(`<<route:review>>`) show how tagging routes work.

## Security & scope — what this is (and isn't)

This template authenticates the **sanctioned** way: your own **OpenRouter API
key** for non-Claude routes, and **passthrough of Claude Code's own auth** for
Anthropic. It impersonates nothing.

It is **not** a tool for using a Claude/ChatGPT *subscription* outside its
official client, nor for pooling multiple subscriptions — those rely on
reverse-engineered first-party impersonation that violates provider terms and
risks account bans. Keep your keys in the environment; never commit them. See
[SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE) © Armen Rostamian
