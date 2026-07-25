---
name: orient
description: Read .agent-docs/now/handoff.md and surface current session state. Use at session start, after time away, or when reorienting ("where are we?"). Pulls live git state at invocation, verifies the handoff isn't stale against git reality (code ahead of docs → trust the code), runs a quick state-file health sweep (the folded-in /status check), surfaces obligations-ledger deltas — landed / came due / overdue / dangling — from now/obligations.md when it exists, else the handoff's Obligations section, and on multi-party installs runs the Room-threads resume step (read the handoff's continuity block, refresh from the comms log since the handoff timestamp, apply the re-read rule before any post).
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-14
tags: [skill, lifecycle, orient]
---

# /orient — Surface current session state from handoff

Single-entry session orientation: read the curated bridge, verify it against reality, and surface a ~12-line brief. Folds in the `/status` quick-health sweep so there is ONE orientation skill, not two.

---

## Live git state (captured at invocation)

Recent commits:

!`git log --oneline -10 2>/dev/null || echo "(no git history)"`

Working tree:

!`git status --short 2>/dev/null || echo "(not a git repo)"`

---

## 1. Read the handoff

Read `.agent-docs/now/handoff.md`.

If missing:
- Note that the agent context system may not be set up here, or the handoff was never regenerated
- Recommend running `/handoff` to create one

## 2. Check staleness vs reality

- `last-modified` field. If > 24h old, flag prominently.
- The live git state above (captured at invocation) — verify it matches the handoff's claims.
- If the session touched runtime-facing code (the app, a service, a CLI), a quick check that the claimed state holds (e.g. the last `bun run build` / `bun test test/` baseline the handoff cites is still current).
- If any contradiction exists, surface it BEFORE acting on the handoff's "immediate next action."

**Trust the code.** When code and docs disagree — the tree/commits above show work the handoff never mentions, or a step the handoff claims is pending already exists on disk — the docs are STALE, not the code. Trust the code, say so explicitly in the brief, and offer to run `/handoff` to true the docs up BEFORE acting on the handoff's Immediate Next Action.

## 3. Read supporting docs (in this order)

- `.agent-docs/now/status.md`
- `.agent-docs/now/work-plan.md`
- `.agent-docs/now/open-questions.md`
- `.agent-docs/now/obligations.md` *(if it exists; otherwise the handoff's `## Obligations` section carries the ledger)*

## 3.5 Quick state-file health sweep (the folded-in /status check)

A fast, no-deep-analysis health pass over the durable state surfaces — flag drift, don't fix it (fixes are `/flush`/`/handoff`'s job):

- **`now/*` currency** — `last-modified` on `status.md` / `work-plan.md` / `open-questions.md`. CONVENTIONS.md lint rule 12 warns at 7d, fails at 90d (the doc linter reports staleness as a warning where installed); flag anything stale.
- **Latest checkpoint** — newest file in `.agent-docs/checkpoints/`; if a `/sitrep` is more recent than `handoff.md`, the forensic state is ahead of the bridge — read it (it holds the dead-ends + in-flight pause point the handoff may have summarized away).
- **Open work-units / blockers** — count active `WU-NNNN` in `now/work-plan.md` and open `OQ-NNN` in `now/open-questions.md`.
- **Index lint** — if the doc linter hook is installed (Standard profile) and it is cheap, note whether `python3 .claude/hooks/lint-docs.py --root .agent-docs` is clean; do NOT fix here.

## 3.6 Obligations deltas (ADR-0012)

The obligations ledger is the inbound/outbound inter-party debt record; at cold-start what matters is what MOVED while you were away. Read it — **if `now/obligations.md` exists**, that file; **otherwise the handoff's `## Obligations` section** — and compute the deltas against the git/time gap since the handoff was written.

**Where to look — SAME sweep, same "what moved?" question, different surface:**
- **If `now/obligations.md` exists:** **scan the repo's agent-comms log** (tool-generic — whatever coordination log the layer writes) for traffic since the last handoff; a row's `Source` message-id is your lookup key.
- **Otherwise (the handoff `## Obligations` section):** **ask the operator** ("anything land while I was away?") and check each row's **named sources** — a commit now on disk, a PR / issue state, a dated conversation note. No comms log to scan; the row's `Source` cell is the pointer.
- Safety is identical either way — surfacing an overdue still fires only the row's recorded `default-if-silent`, and a gate row (operator / authorization) never carries `apply-default` by construction.

Then compute:

- **Landed** — an *owed-to-me* receivable whose deliverable arrived (a cited commit/doc now exists on disk, a settled-strikethrough was added, or — file form — a settling message appears in the comms log) → you may be unblocked; say which HARD row cleared.
- **Came due** — an *owed-by-me* debt whose Due/trigger has passed → you owe delivery now.
- **Overdue** — an *owed-to-me* receivable past its `Trigger/by-when` with no settlement → apply its **default-if-silent**: `chase-once` → send the one ping; `apply-default` → proceed on the recorded fallback; `never-chase-never-peek` → record the disposition and move on. Name which default fired. (A gate row — operator / authorization — never carries `apply-default` by construction, so surfacing an overdue never auto-crosses a gate.)
- **Dangling** — an *owed-to-me* row whose cited `OQ-`/`REV-` has since been resolved or removed by another path → the wait may already be moot; flag it "target closed — reconcile" rather than re-chase a settled thing.
- **Rot risk** — any owed-to-me row with no parseable `Trigger/by-when` → flag it "cannot come due, will not be chased."

Do NOT chase or settle here — `/orient` reads and surfaces; `/flush` and `/handoff` mutate.

## 3.7 Room-thread resume (multi-party installs only)

If the handoff carries a `## Room-threads` section (`/handoff` §8.6 — present only on
multi-party installs with ≥1 live inter-agent thread), it is the amnesia-proofing for
in-flight conversations on the shared comms layer. BEFORE touching that layer:

1. **Read the section first** — thread + subject, participants + locked roles, YOUR role
   and its status, standing hooks, durable-base pointers, do-not-relitigate markers.
2. **Refresh from the comms log SINCE the handoff's timestamp** — the section's
   message-id anchors are the lookup keys. Threads move faster than handoffs regenerate;
   the section orients you, the log is ground truth.
3. **Apply the section's re-read rule before posting ANYTHING into a thread:** re-read
   your own last post and all replies to it first. A post made from the handoff's frame
   alone — without the log refresh — is the confident-wrong failure mode this machinery
   exists to kill.

No Room-threads section → nothing to resume; skip. Do not post from this step — `/orient`
reads and surfaces; responding to what moved is the session's work, not orientation's.

## 4. Surface to user (concise — ~12 lines)

- **TL;DR**: 1-2 sentences pulled from `status.md`
- **Immediate Next Action**: verbatim from `handoff.md`
- **Active open questions** that gate forward motion (typically 1-3 `OQ-NNN` from `open-questions.md`)
- **Active work-unit(s)**: the `WU-NNNN` in flight
- **Obligations deltas** *(from §3.6)*: one line — what **landed** (unblocked), what **came due** (you owe now), what's **overdue** (which default-if-silent fired), any **dangling / rot-risk** row. Omit if the ledger is absent or unchanged.
- **Room-threads** *(multi-party, from §3.7)*: one line per live thread — thread · your role · what moved in the comms log since the handoff · your next deliverable/hook. Omit when the section is absent.
- **Staleness / health flags** if any (from §2 + §3.5) — incl. "a `/sitrep` post-dates the handoff" if so
- **Recent commits**: 3-5 lines from the live git state above

End with: "Ready to proceed with the immediate next action, or refresh state first via `/handoff` or `/flush`?"

## When to invoke

- First action in a new session (manual or via SessionStart hook injection)
- After significant time away from the project
- When the user asks "where are we?"
- After context compaction (if the SessionStart hook didn't auto-orient)

## When NOT to invoke

- Mid-operation. If you're working, you already know where you are.
- Repeatedly within the same session. Read once, work from memory.

## Design rationale

The session-lifecycle contract lives in `standing-rules-core.md` (§Context lifecycle) and `CONVENTIONS.md` (§6 — the checkpoint contract `/sitrep` writes and `/handoff` consumes). Orientation is one skill, not two: the standalone quick-health `/status` check is folded into §3.5 above. Live git state is pulled at invocation via the shell-interpolation blocks at the top, so the §2 staleness check compares the handoff against current reality rather than a snapshot — and the trust-the-code rule gives that comparison a precedence: the working tree is ground truth, the docs are the map.
