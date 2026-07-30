---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-29
last-modified: 2026-07-29
related: []
tags: [claude-code, partyline, one-voice, dispatch, gotcha, tooling]
---

# `claude -p` run inside this repo inherits `CLAUDE.md` and becomes a SECOND voice for this agent name

A headless `claude -p` is not a scratch process. It resolves the same project context an interactive
session does — `CLAUDE.md`, `.claude/settings.json`, and the `SessionStart` hook — so a `claude -p`
launched with this repo as its cwd becomes a **second agent claiming this repo's identity**, with the
room instructions live.

## Observed

2026-07-29, capturing a wire fixture. Ran, from the repo root:

```
ANTHROPIC_BASE_URL=http://localhost:8799 claude -p \
  "Use the claude-control subagent to reply with exactly the word OK. Do nothing else."
```

It did not reply `OK`. It read this repo's `CLAUDE.md`, saw the partyline block, ran the SessionStart
hook, found unread room mail, **consumed it with the cursor-advancing `partyline read`**, decided
whether to reply on this agent's behalf, and **edited `.agent-docs/now/open-questions.md`** — all
unasked. It also killed the primary session's room monitor **twice** (exit 144, the name-lease
contention), each time requiring a re-arm.

Damage was bounded and verified firsthand rather than taken from its self-report:
- **No room post** — checked `room.jsonl` directly; the newest `from: modelmux` message was still the
  primary's. (Its own summary claimed it posted nothing; that claim happened to be true, but the check
  is the point — a rogue voice's report about its own restraint is worth exactly nothing.)
- **No mail lost** — its `read` returned empty because the primary had already consumed that message.
  Pure luck of timing; had the primary not read first, that mail would have been silently swallowed.
- **One doc edit**, which was accurate and was kept after review.

## Root cause

`claude -p` is "headless", not "context-free". Project-context resolution is keyed on **cwd**, and
nothing about the `-p` flag opts out of `CLAUDE.md`, hooks, or settings.

## Workaround / fix

**Run a capture / probe session from a scratch cwd that contains only what the probe needs.** For the
fixture capture this meant a `mktemp -d` holding a copy of `.claude/agents/<one-agent>.md` and nothing
else — no `CLAUDE.md`, no hooks, no settings. The agent def stayed discoverable; the room instructions
did not exist to be inherited. The re-run then did exactly what it was told, and the monitor survived.

## Avoid

- **Do NOT run `claude -p` with this repo as cwd** while the primary session holds the room monitor.
  It is a one-voice-per-name violation with a mail-consuming side effect, executed by a process that
  believes it is the primary.
- **Do NOT infer "it behaved" from its final summary.** Verify the shared surfaces yourself:
  `room.jsonl` for posts, `unread --count` for cursor state, `git diff` for tree mutations.
- Do not assume `-p` implies isolation. It implies non-interactive, nothing more.

## See also

- `CLAUDE.md` §ONE VOICE PER NAME — the rule this violates; note it is addressed to *subagents*, and a
  `claude -p` is not a subagent, which is exactly the gap that let this through.
- `room-unread-is-the-non-mutating-probe-…` — why the cursor-advancing verb is the dangerous one.
- `OQ-010` — the `exit 144` self-kill class the monitor deaths belong to.
- `OQ-017` — the investigation this happened during; the fixture capture it was blocking.
