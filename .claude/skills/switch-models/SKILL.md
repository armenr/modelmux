---
name: switch-models
description: Use when someone wants to change which OpenRouter (or Claude) models the proxy routes to — swapping a model behind an alias, retargeting an agent, overriding at runtime, or checking that slugs are still live.
---

# Switching models

The model menu lives in `routes.jsonc` under `"models"`: friendly **aliases** →
`"<upstream>:<slug>"`. Everything below is a way to change that mapping or which
alias an agent uses. The proxy **hot-reloads** `routes.jsonc` on save (and keeps
the previous config if an edit is invalid), so most changes need no restart.

## The `mux` CLI

```bash
bin/mux models                              # list aliases → upstream:slug
bin/mux set flagship openrouter:z-ai/glm-6  # point an alias at a new model
bin/mux use glm-researcher reasoner         # retarget an agent's <<route:>> tag
bin/mux check-latest                        # verify configured slugs exist on OpenRouter
```

- **`set <alias> <upstream:slug>`** rewrites just that alias's value in
  `routes.jsonc`, validating the spec first (`anthropic:` or `openrouter:`).
- **`use <agent> <alias>`** rewrites the `<<route:alias>>` tag inside
  `.claude/agents/<agent>.md`, so that agent now routes to a different alias.

## Runtime override (no file edit)

Override any alias for a single proxy run with an env var named
`MUX_MODEL_<ALIAS>` (uppercase; hyphens become underscores):

```bash
MUX_MODEL_FLAGSHIP=openrouter:qwen/qwen3.7-max bun run proxy
MUX_MODEL_CLAUDE_REVIEW=anthropic:claude-opus-4-8 bun run proxy
```

Handy for trying a model without touching tracked files.

## How an agent chooses its model

An agent's model comes from the `<<route:alias>>` tag on the first content line
of its `.claude/agents/<name>.md`. The tag → alias → `upstream:slug`. To change
it, either edit the tag, `bin/mux use`, or repoint the alias with
`bin/mux set`.

## Adding a new model or route

1. Add an alias under `"models"` in `routes.jsonc`
   (`"myalias": "openrouter:vendor/slug"`).
2. Optionally add a `routes` rule (e.g. `{ "when": { "tag": "myalias" },
   "use": "myalias" }`) — remember it's **first-match, most-specific-first**.
3. `bin/mux models` to confirm it loaded; the loader fails loud if an alias
   is unknown.

## After changing anything

Give it a quick real check:

```bash
bin/mux check-latest          # slugs still exist?
bun run test:live                # real end-to-end call (needs OPENROUTER_API_KEY)
```
