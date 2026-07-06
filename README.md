# modelmux

[![CI](https://github.com/armenr/modelmux/actions/workflows/ci.yml/badge.svg)](https://github.com/armenr/modelmux/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-000000.svg)](https://bun.sh)

> **Stop paying Claude rates for your grep-the-repo subagents.**

**The stupid-simple way to run Claude Code subagents on other models.** Claude Code
picks its model from one global env var, so `modelmux` is a tiny proxy that sits in
front of it and reroutes the subagents *you choose* to cheaper or specialized models
(GLM, Qwen, DeepSeek, MiniMax via OpenRouter) — while your orchestrator stays on Claude.

**One proxy, one config file, no magic:**

- 🧠 **Orchestrator stays Claude** — the main loop never leaves Anthropic.
- 🔀 **Subagents go where you point them** — by a route tag, work-type, or "any subagent."
- 📄 **One file runs it** — [`routes.toml`](routes.toml): friendly aliases → models, hot-reloaded on save.
- 🔑 **Your keys, the sanctioned way** — your OpenRouter key + Claude Code passthrough. No impersonation.
- ✅ **Actually verified** — 53 hermetic tests plus lint + typecheck gates, on every push.

## Architecture

```mermaid
flowchart TD
    CC["Claude Code request"] -->|"ANTHROPIC_BASE_URL to 127.0.0.1:8787"| MUX["modelmux proxy"]
    MUX --> SIG["extract signals<br/>agent-id? · x-app? · route tag?"]
    SIG --> Q{"first-match cascade"}
    Q -->|"main loop · control tag"| CLAUDE["api.anthropic.com<br/>passthrough — stays Claude"]
    Q -->|"tagged · background · any subagent"| OUT["openrouter.ai/api<br/>GLM · Qwen · DeepSeek · MiniMax"]
```

Requests flow through three pure steps — `extractSignals` (`src/signals.ts`) →
`route` (`src/route.ts`) → auth rewrite (`src/upstreams.ts`) — and SSE streams
pass straight through untouched. OpenRouter's Anthropic-compatible endpoint means
no request translation is needed.

## Install

**Option A — prebuilt binary (no toolchain).** A single self-contained executable
(the Bun runtime is baked in) from
[Releases](https://github.com/armenr/modelmux/releases/latest) — no Bun, DevBox,
or Docker required:

```bash
# Swap the suffix for your platform: modelmux-linux-x64 · -linux-arm64 ·
# -darwin-x64 · -darwin-arm64 · -windows-x64.exe
curl -fsSL https://github.com/armenr/modelmux/releases/latest/download/modelmux-darwin-arm64 -o modelmux
chmod +x modelmux
OPENROUTER_API_KEY=sk-or-... ./modelmux           # runs the proxy on :8787
```

On first run the binary writes a default `routes.toml` beside itself (edit it to
swap models — hot-reloaded). `./modelmux models` / `set` / `check-latest` manage
the config; `./modelmux` with no args runs the proxy.

**Option B — from a checkout** (Bun, or DevBox for a pinned toolchain): the
[Quickstart](#quickstart) below.

Either way, point Claude Code at it: copy `.claude/settings.json.example` →
`.claude/settings.json` (`ANTHROPIC_BASE_URL=http://127.0.0.1:8787`) and restart
Claude Code.

## Quickstart

```bash
bun install                                  # dev deps (or: devbox shell)
cp .env.example .env                         # set OPENROUTER_API_KEY (openrouter.ai/keys)
bun run proxy                                # → modelmux listening on http://localhost:8787
cp .claude/settings.json.example .claude/settings.json   # opt Claude Code into the proxy
# ...then RESTART Claude Code (ANTHROPIC_BASE_URL is read at startup)
```

That's the whole setup. Dispatch a subagent and it routes to OpenRouter while your
main loop stays on Claude — the **Worked example** below shows exactly what you'll see.

New here? Run the **`/getting-started`** skill, or dispatch the
**`setup-assistant`** agent — both walk you through this and verify each step.

## How routing works

The proxy routes on **request signals**, not the requested model string (which
sidesteps a Claude Code bug where a subagent's model can fall back to the
parent's). The key signals (`src/signals.ts`):

- `x-claude-code-agent-id` — present **only** on subagent requests (`isSubagent`).
- `x-app` — `cli` (foreground) vs `cli-bg` (background work).
- `<<route:alias>>` — an explicit tag in an agent's system prompt.

`route()` walks `routes.toml` top-to-bottom, **first match wins**:

| Order | When | Routes to | Upstream |
| ----- | ---- | --------- | -------- |
| 1 | `<<route:flagship\|max\|reasoner\|review\|claude-review>>` | that alias | OpenRouter / Anthropic |
| 2 | `<<route:control>>` | `orchestrator` | Anthropic (passthrough) |
| 3 | `workType: background` (`x-app: cli-bg`) | `cheap` | OpenRouter |
| 4 | any other subagent (`anySubagent`) | `flagship` | OpenRouter |
| 5 | default (the main loop) | `orchestrator` | Anthropic (passthrough) |

The main loop carries no `x-claude-code-agent-id`, so it never matches a subagent
rule — it falls to the default and **stays on Claude**. Want the full mental
model? Run the **`/explain-modelmux`** skill.

### Work-type routing (beyond tags)

Row 3 above matches a **work type** — a property of the request itself, so you
don't have to tag every agent. The proxy derives four:

- `background` — `x-app: cli-bg` (a background/side task)
- `longContext` — estimated input tokens exceed `longContextThreshold`
- `think` — the request carries an extended-thinking block
- `webSearch` — the request includes a web-search tool

**Only `background` is wired up by default.** `routes.toml` ships the others as
commented-out examples — uncomment one to route, e.g., big-context requests to a
roomier model. (That's the sole purpose of `longContextThreshold`: it's the
cutoff for the `longContext` type, and it does nothing until a `longContext`
rule exists.)

## Worked example — put your research agent on GLM

The bundled `glm-researcher` agent starts with a route tag, so the proxy sends that
one subagent to OpenRouter while everything else stays on Claude:

```text
.claude/agents/glm-researcher.md  →  <<route:flagship>>  →  openrouter:z-ai/glm-5.2
```

Dispatch it from a Claude Code session, then read the decision log:

```bash
tail -n 2 decisions.jsonl
```

```text
{ "isSubagent": true,  "matchedRule": "tag:flagship", "upstream": "openrouter", "resolvedModel": "z-ai/glm-5.2" }
{ "isSubagent": false, "matchedRule": "default",      "upstream": "anthropic",  "resolvedModel": "passthrough" }
```

The research ran on GLM; your main loop never left Claude. Prefer Qwen for it
instead? No file editing required:

```bash
bin/mux use glm-researcher max     # point that agent at the `max` alias (qwen)
```

## The model menu

Models live behind friendly aliases in [`routes.toml`](routes.toml) — swap one
in a single place:

```toml
[models]
orchestrator = "anthropic:passthrough" # main loop — keep Claude's choice
flagship = "openrouter:z-ai/glm-5.2"
max = "openrouter:qwen/qwen3.7-max"
reasoner = "openrouter:deepseek/deepseek-v4-pro"
review = "openrouter:minimax/minimax-m3"
cheap = "openrouter:deepseek/deepseek-v4-flash"
claude-review = "anthropic:claude-sonnet-5"
```

> The slugs above are illustrative — run `bin/mux check-latest` to see which
> models actually exist on OpenRouter right now, and `mux set` to update one.

The proxy **hot-reloads** `routes.toml` on save (and keeps the last good config
if an edit is invalid). Full switching guide: the **`/switch-models`** skill.

## The `mux` CLI

```bash
bin/mux models                              # list aliases → upstream:slug
bin/mux set flagship openrouter:z-ai/glm-6  # repoint an alias
bin/mux use glm-researcher reasoner         # retarget an agent's <<route:>> tag
bin/mux check-latest                        # verify configured slugs exist on OpenRouter
```

Or override an alias for one run without editing files:
`MUX_MODEL_FLAGSHIP=openrouter:qwen/qwen3.7-max bun run proxy`.

## Project layout

```text
src/            proxy core — signals, route, upstreams, server, config, log, types, cli
bin/mux         the switching CLI
scripts/        check-latest (catalog diff) · live-smoke (real e2e) · record-fixtures
routes.toml     the model menu + routing cascade
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

Build the vended single binary for your platform: `bun run build` → `dist/modelmux`.
CI cross-compiles all platforms on a `v*` tag (see `.github/workflows/release.yml`).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and conventions.

## Onboarding skills & agents

These ship in `.claude/` so a fresh clone can use them immediately:

- **`/getting-started`** — clone → install → key → run → verify.
- **`/explain-modelmux`** — the mental model: why a proxy, the signals, the cascade.
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
