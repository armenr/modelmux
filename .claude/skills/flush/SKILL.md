---
name: flush
description: Mid-session housekeeping. The main agent updates .agent-docs/now/{status,work-plan,open-questions}.md + log.md to current reality, then continues working in the same session. Does NOT regenerate handoff.md, does NOT archive, does NOT auto-commit. Use when work has progressed and now/* has drifted but you're NOT ending the session.
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-10
tags: [skill, lifecycle, flush]
---

# /flush — Mid-session checkpoint (foreground)

Stop. File the paperwork. Continue. Stripped-down sibling of `/handoff` for the "we're staying in this session" case.

**Foreground execution.** The agent WITH the session context does the work. See "Why not backgrounded" at the bottom.

## When to invoke

- After completing a meaningful chunk of work (a commit, an ADR write, a design discussion, a deliverable landed)
- When `now/status.md` no longer reflects what's actually true
- Before context-switching to a new sub-task within the same session
- When the user asks for "checkpoint" / "let's update state" / "flush" / "any paperwork?"

## When NOT to invoke

- Before context compaction → use `/handoff` (regenerates `handoff.md` + archives — the cross-session bridge)
- Before session-end / `/clear` → use `/handoff`
- For trivial updates (single-line edit) — just keep working
- Repeatedly with nothing material to flush — skip

## Steps

### 1. Pull current state (cheap)

```bash
git log --oneline -5    # recent commits
git status -s           # working tree
```

If the session touched runtime-facing code, gather minimal verification (a `bun run build` / `bun run lint` / `bun test test/` result you already have; a `the TypeScript language server` reachability output for a wiring claim) — only what's relevant to the chunk. Don't over-fetch.

### 2. Rewrite `.agent-docs/now/status.md` in place

Fleeting doc — overwrite, don't append. Target 80-120 lines. Sections:

- **TL;DR** (2-3 sentences synthesizing what changed)
- **Branch** (latest commits, ahead/behind, push status)
- **Build / runtime state** (workspace/package snapshot + delta-since-prior-status, if relevant)
- **Phase status table** (if mid-procedure)
- **Working tree** (clean or what's dirty + why)
- **Gates** (`bun run build` / `bun run lint` / `bun test test/` status, toolchain delta)
- **Doc/context system** (state)
- **What this means for next steps** (pointer to work-plan + handoff)

Update `last-modified` to today's **local** date (`date +%Y-%m-%d`, NEVER `date -u` — see `CONVENTIONS.md`).

### 3. Update `.agent-docs/now/work-plan.md` if priorities or order changed

- Mark completed items ✅
- Surface the IMMEDIATE NEXT ACTION at the top if it shifted
- Bump `last-modified` (local)

### 4. Update `.agent-docs/now/open-questions.md` if questions resolved or surfaced

- Move resolved questions to "Recently resolved" with a closure reference (commit hash, `ADR-NNNN`, runbook section, log entry) — or a short inline `✅ RESOLVED → ADR-NNNN`
- Add new questions surfaced this session
- Bump `last-modified` (local)

### 5. Append entries to `.agent-docs/log.md`

Newest at top:

```
## [YYYY-MM-DD] flush | <one-line summary of the chunk just flushed>

<2-3 lines describing what happened>
```

Plus discrete-sub-work entries as warranted (`decision | ...`, `memory | ...`, `work | ...`).

### 5.5 Capture anti-assumptions + corrections AS THEY ACCUMULATE (the capture-at-the-moment defense)

`/flush` is the mid-session net for the knowledge classes `/handoff` formalizes — capture them NOW so they survive to the next checkpoint instead of living only in chat:

- **Corrections/reversals** to filed docs decided this chunk → edit the doc IN PLACE (dated; never leave it wrong). The biggest loss class.
- **Anti-assumptions / traps** discovered → a one-liner in `status.md` or `log.md`: "looks like X → actually Y" (a unit that looks dead but is load-bearing; a misleading name; a tooling trap; a cross-layer drift the obvious grep misses).
- **Reusable recipes / gates** that worked → capture **verbatim, as a labeled greppable block** (esp. env/build incantations: env vars, flags, version/toolchain pins, lib paths — the recipe IS the reproducibility).
- **Hands-on artifacts / scratch prototypes built OUTSIDE the repo** (scratch dirs, throwaway packages, spike harnesses) → note location + pass/fail verdict + keep-or-clean in `status.md`/`log.md`, or promote a durable spike to `experiments/` (Full profile). They're in no git tree → silently lost otherwise.
- **Ephemeral workflow / temp-dir outputs** worth keeping → rescue the synthesis to `reference/` (or note the durable transcript path + resume command); temp dirs clear.
- **Operator rulings** this chunk → the `work-plan` decisions area + `log.md` `decision | ...`.
- **Inter-party obligation changes** this chunk (a promise made / received, a receivable settled) → if `now/obligations.md` exists, update it in place (ADR-0012) — the mid-session mutate that keeps the ledger true between handoffs; otherwise the ledger rides the handoff `## Obligations` section, swept at `/handoff`.

Don't wait for `/handoff` — by then the detail has decayed.

### 6. Index lint (OPTIONAL — Standard profile only)

If the doc linter hook is installed (Standard profile), run `python3 .claude/hooks/lint-docs.py --root .agent-docs`. For any drifting dir THIS session touched, fix the drift as a byproduct (entry shape per `CONVENTIONS.md` index template). Untouched dirs: leave for `/handoff`. If fixed, append a `lint | ...` op line to `log.md`. If the hook isn't installed, skip this step.

### 7. Report

- "/flush complete — N files updated"
- One-line summary per file changed
- "Continuing with <next action>" — keep momentum

**DO NOT auto-commit.** The operator stays in control of git.

## What /flush deliberately does NOT do

- Does NOT regenerate `handoff.md` (that's `/handoff`'s job)
- Does NOT archive to `.claude/handoffs/`
- Does NOT auto-commit
- Does NOT do cross-session staleness checks — you're still in-session

## Relationship to /orient, /sitrep, and /handoff

| Skill | When | What it does |
|---|---|---|
| `/orient` | Session start, after time away | Reads `now/handoff.md`, checks staleness + state-file health, surfaces a 12-line brief |
| `/flush` | Mid-session checkpoint | Updates `now/*` + `log.md` (UPDATE-IN-PLACE), keeps going |
| `/sitrep` | Before risky ops, phase gates, pre-compaction | Writes a WRITE-ONCE 10-point zero-loss checkpoint to `checkpoints/` (dead-ends + rejected alternatives) |
| `/handoff` | Session end, pre-compaction, ~80% context | Updates `now/*` + `log.md`, consumes the latest sitrep, regenerates `handoff.md`, archives prior |

All run **in the main agent** (foreground). None delegates to subagents.

**`/flush` vs `/sitrep`.** The lightweight "keep `now/*` current and keep working" role is `/flush` (editable, UPDATE-IN-PLACE); the zero-loss "freeze the investigation rationale" role is `/sitrep` (WRITE-ONCE to `checkpoints/`, never edited, mandated dead-ends + rejected-alternatives). Use `/flush` for routine drift; use `/sitrep` when losing the conversation would lose reasoning you cannot cheaply re-derive.

## Anti-patterns

- Do NOT run `/flush` mid-destructive-operation. Wait for it to finish.
- Do NOT use `/flush` as a substitute for `/handoff` before session-end.
- Do NOT include secret values or regulated / user data. Reference paths.
- **Do NOT delegate `/flush` to a sub-agent.** See below.

## Why not backgrounded (design lesson)

A sub-agent has **zero session context** — the whole point of `/flush` is to capture what the main agent has been doing. Briefing a sub-agent on what to write IS the flush work. Sub-agent permissions are also narrower (Write often denied). The async UX gain is illusory. Foreground is the right shape; the cost is a few-second pause, the benefit is reliability. `/handoff` follows the same principle.

## Design rationale

The session-lifecycle contract lives in `standing-rules-core.md` (§Context lifecycle). `/flush` is the capture-at-the-moment primary defense; the `/handoff` conversation-residue sweep is the net.
