---
name: sitrep
description: Write a WRITE-ONCE, timestamped 10-point zero-loss checkpoint to .agent-docs/checkpoints/YYYY-MM-DD-HHMMSS-<slug>.md, keyed to the active WU. The anti-naive-summarization tier — preserves what a lossy summary silently drops (dead-ends, rejected alternatives, in-flight pause point). Use before risky operations, at phase gates, before compaction, or whenever losing the conversation would lose investigation rationale. Immutable: never edited after write; new information = a NEW checkpoint that references the prior.
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [skill, lifecycle, sitrep, checkpoint]
---

# /sitrep — the 10-point zero-loss checkpoint contract

Write an immutable, timestamped situation report that survives compaction with **zero loss of rationale**. This is the checkpoint contract, keyed to the active work-unit (`WU-NNNN`).

**The ten points are canonical in `CONVENTIONS.md §6` — read §6 once for the WHY, then instantiate `templates/checkpoint-template.md` (which names all ten).** This skill governs the *write contract* (filename, frontmatter, immutability, when to fire), not the point rationale — do not restate §6 here.

A `/sitrep` is NOT a `/flush`. `/flush` keeps `now/*` current and is editable; `/sitrep` is a frozen forensic record. The single defining job: **preserve what a naive summary deletes** — the dead-ends, the rejected alternatives, the exact in-flight pause point. The recurring failure it kills: "findings only in conversation are DEAD at compaction."

**Foreground in the main agent.** Only the agent holding the session context knows the dead-ends and the rejected alternatives. A sub-agent with zero context cannot author this — briefing it on what to write IS the work. (Same reasoning as `/flush`.)

## When to invoke

- **Before a risky / irreversible operation** — a migration, a workspace-wide refactor, a destructive fs op. The sitrep is the restore point for your *reasoning*, not just your code.
- **At a phase gate** — when a multi-phase work-unit completes a phase and you STOP for review.
- **Before context compaction / near ~80% context** — capture the forensic state, THEN `/handoff` consumes it.
- **When a deep investigation has accumulated dead-ends** — paths explored that did not pan out. These are the highest-value, most-summarization-fragile content. Write them down before they evaporate.
- **When the operator asks for a "checkpoint" / "sitrep" / "save the investigation state."**

## When NOT to invoke

- For routine mid-session `now/*` housekeeping → use `/flush` (editable, keeps momentum).
- For session-end / the cross-session bridge → use `/handoff` (which regenerates `handoff.md` and consumes the latest sitrep).
- For a trivial one-line state nudge — overkill; just `/flush` or keep working.
- To AMEND an existing sitrep — you never edit one. Write a NEW sitrep that references the prior by filename (see Immutability below).

## Steps

### 1. Identify the active work-unit and compute the filename

The checkpoint is keyed to a WU. Find the active `WU-NNNN` from `.agent-docs/now/work-plan.md` (the board). If no WU is active, that is itself a finding — note it in point 1 and use the closest tracked unit, or open one in `now/work-plan.md` first.

```bash
pwd && git rev-parse --abbrev-ref HEAD          # cwd + branch (standing-rules cwd-check)
git rev-parse --show-toplevel                    # which repo am I actually in
TS=$(date -u +%Y-%m-%d-%H%M%S)                    # UTC — machine-sortable filename (CONVENTIONS §3)
# slug = short kebab description of THIS checkpoint's moment, e.g. "pre-storage-migration"
echo ".agent-docs/checkpoints/${TS}-<slug>.md"
```

Filename is `checkpoints/YYYY-MM-DD-HHMMSS-<slug>.md`, UTC timestamp (machine-sortable). Frontmatter `created`/`last-modified` use the LOCAL date (`date +%Y-%m-%d`) per CONVENTIONS §2.

### 2. Pull the on-disk ground truth (evidence behind the verdicts)

Every verdict in the sitrep cites on-disk evidence (CONVENTIONS §7.3). Gather what is relevant to THIS segment — don't over-fetch:

```bash
git log --oneline -8
git status -s
```

If the session touched runtime-facing code, capture the relevant gate / reachability evidence you already have (a `bun run build` / `bun run lint` / `bun test test/` result; a `the TypeScript language server` reachability output for a wiring claim). That reachability output is the WIRED proof for point 8 — capture it verbatim if a work-unit is mid-wiring. Do NOT run fresh heavy builds just to populate the sitrep; cite the freshest evidence you legitimately have and say so.

### 3. Write the checkpoint — all TEN points, none optional

Write to `.agent-docs/checkpoints/YYYY-MM-DD-HHMMSS-<slug>.md`. **Instantiate `templates/checkpoint-template.md`; the ten mandated points and their rationale are `CONVENTIONS.md §6` — do not re-derive them.** The doc linter (CONVENTIONS lint rule 14) FAILS a checkpoint missing any of the ten numbered points.

Frontmatter:

```yaml
---
provenance: llm-autonomous          # llm-reviewed only after operator sign-off
created: <local date>
last-modified: <local date>
work-unit: WU-NNNN                   # the active WU — must resolve in now/work-plan.md (lint rule 15)
tags: [checkpoint]
related: []                          # the prior sitrep if this is an addendum; relevant ADRs / OQs
---
```

Body — the ten points named by `CONVENTIONS.md §6` and `templates/checkpoint-template.md` (`# Checkpoint YYYY-MM-DD-HHMMSS — <slug>`). Two points carry the anti-summarization weight and are the ones a summary silently drops — do NOT skimp on them:

- **Point 5 — Decisions made WITH rejected alternatives.** What was rejected and why, not just what was chosen (mirrors the ADR `## Alternatives Considered` field). A decision recorded without its rejected branches has lost its WHY. If ADR-worthy, note `→ should become ADR-NNNN` and the WU.
- **Point 6 — Investigation results INCLUDING dead-ends.** Every path explored that did NOT pan out, with the reason it failed. If the segment had no dead-ends, say so explicitly; "none" is a real answer, not a skip.
- **Point 8 — Files / artifacts touched** carry each path's **wiring / reachability status** (`IMPL` / `WIRED` / `DEFER`). WIRED requires a traced path from a production entrypoint — cite the `the TypeScript language server` output, or the fallback menu (LSP find-references → call-hierarchy → a language call-graph tool → grep-the-callers floor → a manual-trace note). Record the state in `traceability/` (Full profile) or inline. Code that compiles ≠ code that is reachable.
- **Point 10 — Addendum check** is the findings-to-disk net: re-read points 1–9, name anything still living only in the conversation (a verbal operator ruling, a scratch artifact built outside the repo, a recipe, an anti-assumption "looks like X → actually Y"), and ADD it here. Mandatory even when it lands "nothing further."

### 4. Append to the journal

`.agent-docs/log.md` (newest at top):

```
## [YYYY-MM-DD] checkpoint | <slug> — <one-line what-state-was-frozen>

WU-NNNN. Sitrep at checkpoints/<filename>. <1 line: the load-bearing thing it preserved, e.g. dead-end set / phase-gate state>.
```

### 5. Report

- "/sitrep written → `.agent-docs/checkpoints/<filename>` (WU-NNNN)"
- One line naming what it most protects (the dead-ends captured / the in-flight pause point / the phase-gate state).
- If a decision in point 5 is ADR-worthy: "Decision in §5 should be promoted to an ADR — queue at next `/handoff`."

**DO NOT auto-commit.** The operator controls git.

## Immutability + addenda (the WRITE-ONCE rule)

A checkpoint is **never edited after write** (CONVENTIONS §6 · §1 write-discipline WRITE-ONLY). New information after a sitrep ⇒ a **NEW** sitrep with a fresh timestamp whose frontmatter `related:` and point 1 reference the prior by filename. The chain of timestamped sitreps IS the forensic record — editing one would destroy the property that makes it trustworthy under compaction.

## Relationship to /flush and /handoff

| Skill | Surface | Editable? | Job |
|---|---|---|---|
| `/flush` | `now/*` + `log.md` | yes (UPDATE-IN-PLACE) | keep working state current, keep momentum |
| `/sitrep` | `checkpoints/<ts>-<slug>.md` | **no (WRITE-ONCE)** | freeze a zero-loss forensic record — dead-ends + rejected alternatives |
| `/handoff` | `now/handoff.md` (+ archive) | yes (regenerated) | the cross-session bridge; **consumes the latest sitrep** |

`/flush` and `/sitrep` are complementary, not redundant: `/flush` repairs drift in the live state; `/sitrep` snapshots an immutable record of the reasoning at a moment. `/handoff` reads the latest sitrep to reconstruct cold-start state and to fold its dead-ends / decisions into the handoff's anti-assumptions + detour-chain sections.

## Anti-patterns

- Do NOT edit a written sitrep — write a new one referencing it.
- Do NOT drop dead-ends or rejected alternatives to look tidier. They ARE the value (CONVENTIONS §6).
- Do NOT skip the addendum check (point 10) — it is the findings-to-disk net.
- Do NOT include secrets / regulated or user data / sensitive material — reference paths / store keys (CONVENTIONS "What NOT to do").
- Do NOT claim WIRED without a reachability proof — IMPL ≠ WIRED (the #1 recurring trap).
- Do NOT delegate to a sub-agent — it has zero session context.
- Do NOT auto-commit.

## Design rationale

The 10-point zero-loss contract is canonical in `CONVENTIONS.md §6`. Lifecycle design + why dead-ends and rejected alternatives are load-bearing: `standing-rules-core.md` (§Context lifecycle, §Findings-decisions-and-review-feedback-to-disk).
