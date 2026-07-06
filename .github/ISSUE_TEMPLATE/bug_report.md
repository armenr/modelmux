---
name: Bug report
about: Something routed wrong, the proxy misbehaved, or a test broke
title: "bug: "
labels: bug
---

## What happened

A clear description of the bug.

## Expected

What you expected to happen instead.

## Repro

Steps to reproduce — ideally the request/agent that mis-routed.

```bash
# commands you ran
```

## Routing evidence

If it's a routing issue, paste the relevant line(s) from `decisions.jsonl`
(the JSONL decision log). **Redact any keys or tokens first.**

```jsonl
{ "matchedRule": "...", "upstream": "...", "resolvedModel": "..." }
```

## Environment

- OS:
- `bun --version`:
- Claude Code version:
- Installed via: DevBox / Bun-direct
