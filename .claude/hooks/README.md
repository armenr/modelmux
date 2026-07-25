---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [hooks, enforcement, portability]
---

# `.claude/hooks/` — what fires when

Small, self-contained shell hooks wired through `.claude/settings.json`. Each degrades to a
**no-op** when a dependency is missing — a hook never bricks a session.

| Hook | Event | Does |
|---|---|---|
| `sessionstart-state-router.sh` | SessionStart (`startup`/`resume`/`clear`/`compact`) | Reads `now/handoff.md` staleness + git drift → routes to fresh / stale-warn (`/orient` first) / stale-block (`/handoff` first). Runs the index-drift lint on `startup`\|`clear` only. Warns when `core.hooksPath` is unset (fresh-clone-inert trap). |
| `precompact-handoff-trigger.sh` | PreCompact | Injects a `systemMessage` prompting `/handoff` before context is summarized, so dead-ends reach disk. |
| `subagentstart-prefix.sh` | SubagentStart | Injects the multi-agent prompt-prefix; for built-in `Explore`/`Plan` agents (which skip `CLAUDE.md`) also cats `standing-rules-core.md`. |
| `pretooluse-safety-gates.sh` | PreToolUse (`Bash`) | Blocks/asks on universal foot-guns (force-push to a protected branch, checks-bypass, recursive `rm`, `git reset --hard`) and injects cwd-safety context on mutative git/fs ops. |
| `dispatch-gate/dispatch-gate.sh` | PreToolUse (`Agent` \| `Workflow` — TWO blocks, distinct commands) | The fail-loud dispatch-conformance gate (`reference/fail-loud-dispatch-contract.md`): blocks unpinned *declared* Agent dispatches (graded — WARN when undeclared), hash-checks the paste-in fail-loud preamble, and enforces the declaration lane in return-locus form on Workflow scripts. **Brownfield-inert** — silent on ungoverned dispatches. Depends on `python3`, not `jq`; when `python3` is missing it degrades LOUD (a did-not-run notice), never a silent pass. |

> **Tier note.** `sessionstart-state-router.sh` and `precompact-handoff-trigger.sh` SHIP in the
> Minimal tier (`base/minimal/claude/hooks/`) — Standard layers over Minimal, so an installed tree
> has all four side by side, but in the KIT SOURCE those two files live one tier down. Listed here
> because this README documents the full installed hook surface.

## Prerequisites

- **`bash`** — hooks use `#!/usr/bin/env bash` (bash 3.2+, i.e. stock macOS bash works).
- **`jq`** — parses the hook-input/emits JSON. **Missing `jq` ⇒ the hook no-ops** (guarded by
  `command -v jq >/dev/null 2>&1 || exit 0`). Install it to get enforcement; nothing breaks without it.
- **`python3`** — the `dispatch-gate/` engine only. Unlike the `jq`-guarded hooks it does **not**
  silently no-op when missing: the shim emits a loud did-not-run notice and allows — a gate that
  didn't run must never look like a gate that passed.
- **`git`**, **`stat`** — the router uses GNU `stat -c %Y` with a BSD `stat -f %m` fallback, so it
  works on Linux, macOS/BSD, and WSL. All regexes use POSIX character classes only (no GNU-only
  `\b`/`\s`), so the safety gate behaves identically under GNU and BSD grep/sed.

## The safety gate is assembled: base + stack fragment

`pretooluse-safety-gates.sh` (the live file) is **built at install** from two pieces:

1. **`pretooluse-safety-gates.base.sh`** — the stack-agnostic base shipped here. Universal foot-guns
   only; correct on its own.
2. **a per-stack fragment** (from the selected stack pack) — spliced at the base's marked
   *STACK-FRAGMENT INSERTION POINT*. It adds stack rules (e.g. package publish, dependency re-lock,
   datastore wipe) and may extend `SAFE_PATHS_EXTRA` (extra directories that make a recursive `rm`
   safe, e.g. the build-output dir).

Editing rules? Change the **base** for universal behavior or the **stack fragment** for
stack-specific behavior, then re-assemble — do not hand-edit the merged live file.

## Wiring (done by the install concierge)

- **Claude Code hooks** (the four above) are wired in `.claude/settings.json` under `hooks.*`,
  keyed by event, pointing at `${CLAUDE_PROJECT_DIR}/.claude/hooks/…`. See
  `settings.json.template`.
- **The git pre-commit gate** (the doc-schema / index lint that runs at commit time) is a *separate*
  mechanism, wired with `git config core.hooksPath .githooks`. It is a **local, per-clone** setting:
  on a fresh clone it is unset, so those gates are silently INERT until wired. The SessionStart
  router surfaces this loudly; the concierge runs `git config core.hooksPath .githooks` and verifies
  the hook fires.

After install, confirm hooks are live: start a session (the router prints a state pointer), and run
a benign `git status` (the PreToolUse gate stays silent) vs a dry `git push --force origin main` on a
throwaway (the gate denies).
