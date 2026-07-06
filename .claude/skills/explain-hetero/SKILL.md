---
name: explain-hetero
description: Use when someone wants to understand how hetero-agents works — why a proxy is needed, what signals it routes on, and how the cascade keeps the orchestrator on Claude while diverting chosen subagents.
---

# How hetero-agents works

Explain the mental model, adapting depth to the audience. The whole system is
small and readable — point people at the actual files.

## The constraint

Claude Code picks its upstream from **one global** environment variable,
`ANTHROPIC_BASE_URL`. There's no per-subagent model setting on the client side.
So if you want *some* agents on Claude and *others* on a different model, the
decision has to happen **outside** the client — in a proxy that every request
flows through.

## The proxy

`src/server.ts` is a `Bun.serve` reverse proxy. For each request it:

1. Extracts routing **signals** (`src/signals.ts`).
2. Picks a target via a first-match **cascade** (`src/route.ts` + `routes.jsonc`).
3. Rewrites auth for the chosen upstream (`src/upstreams.ts`) and forwards it.
   SSE streams pass straight through.

Two upstreams: **Anthropic** (`api.anthropic.com`, "passthrough" = keep the
model Claude Code asked for) and **OpenRouter** (its Anthropic-compatible
endpoint, so no request translation is needed).

## The signals (why it routes by header, not model name)

From each request (`src/signals.ts`):

- **`x-claude-code-agent-id`** — present *only* on subagent requests, so it marks
  `isSubagent`. This is the key signal, and routing on it sidesteps a Claude Code
  bug where a subagent's requested model can silently fall back to the parent's.
- **`x-app`** — `cli` for foreground, `cli-bg` for background work.
- **`<<route:alias>>`** — an explicit tag placed in an agent's system prompt.
- Plus `thinking`, a token estimate, and web-search tool detection.

## The cascade

`route()` walks `routes.jsonc`'s `routes` top-to-bottom, first match wins:

1. **Tag rules** — `<<route:flagship|max|reasoner|review|claude-review>>` →
   that model. `<<route:control>>` → `orchestrator` (stays on Claude).
2. **`workType: background`** → the `cheap` model.
3. **`anySubagent`** → the `flagship` model (any *untagged* subagent).
4. **Default** → `orchestrator` (Anthropic passthrough).

The **main loop has no `x-claude-code-agent-id`**, so it never matches a subagent
rule — it falls to the default and **stays on Claude**. That's the core promise:
smart orchestrator on Claude, chosen subagents on cheaper/other models.

## The menu

`routes.jsonc` maps friendly **aliases** (`flagship`, `cheap`, …) to
`<upstream>:<slug>`. Swap a model in one place, or override at runtime with
`HETERO_MODEL_<ALIAS>`. See the `switch-models` skill for day-to-day changes.

## Verifying it

Every decision is appended to `decisions.jsonl` with `isSubagent`, `matchedRule`,
`upstream`, and `resolvedModel` — the ground truth for "did this actually route
where I think?"
