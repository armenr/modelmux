---
name: getting-started
description: Use when someone has just cloned modelmux and wants to plug in OpenRouter and see heterogeneous routing working. Walks clone → install → key → run → verify, checking each step.
---

# Getting started with modelmux

Walk the user through these steps in order. Run the checks yourself where you
can, and confirm each step before moving on. Never print the value of an API key.

## 1. Prerequisites

Confirm [Bun](https://bun.sh) is installed:

```bash
bun --version
```

If it's missing, either `curl -fsSL https://bun.sh/install | bash` or use DevBox
(`devbox shell`). Then install dev dependencies:

```bash
bun install
```

## 2. Plug in your OpenRouter key

The proxy needs an OpenRouter key for any non-Claude route
(<https://openrouter.ai/keys>).

```bash
cp .env.example .env
# then edit .env and set OPENROUTER_API_KEY=sk-or-v1-...
```

`.env` is gitignored — never commit it.

## 3. Start the proxy

```bash
bun run proxy
```

You should see `modelmux listening on http://localhost:8787`. Leave it
running in its own terminal.

## 4. Opt Claude Code into the proxy

Routing only happens when Claude Code points at the proxy:

```bash
cp .claude/settings.json.example .claude/settings.json
```

This sets `ANTHROPIC_BASE_URL=http://127.0.0.1:8787`. **Restart Claude Code** —
that env var is read once at startup, so an already-running session won't pick
it up.

## 5. See it route

In a fresh Claude Code session (proxy running, settings enabled), dispatch a
subagent — e.g. the bundled `glm-researcher` (tagged `<<route:flagship>>`) — then
inspect the decision log:

```bash
tail -n 5 decisions.jsonl
```

You want to see the subagent land on OpenRouter and the main loop stay on Claude:

```jsonc
{ "isSubagent": true,  "matchedRule": "tag:flagship", "upstream": "openrouter", "resolvedModel": "z-ai/glm-5.2" }
{ "isSubagent": false, "matchedRule": "default",      "upstream": "anthropic",  "resolvedModel": "passthrough" }
```

## 6. (Optional) confirm the model slugs are live

```bash
bin/mux check-latest
```

## Shortcut

You can also dispatch the **`setup-assistant`** agent to auto-check Bun, the key,
config validity, and the proxy, and report what's left.

## Troubleshooting

- **`OPENROUTER_API_KEY is not set`** (HTTP 400) → set the key in `.env` (step 2).
- **Connection refused** → the proxy isn't running (step 3).
- **Subagent still on Claude** → you didn't restart Claude Code after step 4.
