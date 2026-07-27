---
entry_type: lesson
provenance: llm-reviewed
maturity: evergreen
status: active
severity: high
module: knowledge-capture
type: process
created: 2026-07-27
last-modified: 2026-07-27
last-applied: 2026-07-27
related: [an-empty-result-is-evidence-about-the-query-not-the-world]
tags: [lesson, knowledge-capture, mechanism, documentation, meta]
---

# LP-005 — A trap you have written down is not a trap you have disarmed

**Question.** A gotcha is recorded — in a handoff's anti-assumptions list, in `CLAUDE.md`, in a
lesson. How much has that reduced the rate at which it fires?

**Claim.** Close to nothing, on its own. Documentation is a **reminder**, and a reminder only works
on someone who is already looking. At the moment of use you are inside a different task, and the
trap's whole shape is that the wrong path *looks* like the right one — which is exactly when nobody
re-reads the warning. **Where the correct path costs more than the lazy path at the point of use,
the doc loses.** A trap that has bitten twice is owed a **mechanism** — a wrapper, a hook, a lint, a
test, a gate — not a better sentence.

**Evidence — three documented traps fired again in one session, on the agent that wrote them down.**

- **`pkill -f <pattern>` killed its own shell** (exit 144); the harness wrapper embeds the command
  string, so the pattern matches the shell running it. This was trap **#4** in this repo's own
  handoff, verbatim, with the remedy ("kill by PID") attached. Walked into anyway.
- **fish/zsh do not word-split unquoted parameters.** `for v in $VERBS` treated a six-line string as
  a single word and the CLI-docs check printed a **false green** — the failure mode that costs most,
  arrived through a trap already recorded as **#5**.
- **`partyline read` mutates the cursor.** `CLAUDE.md` says so in bold. It still went into a status
  pipeline piped to `grep -c`, consuming four messages into a discarded count. Recovery worked only
  because `room.jsonl` happens to be append-only — **luck, not design**.

**The control that makes this a finding rather than an anecdote:** in the same session, the traps
with *mechanisms* behind them fired **zero** times. The armed pre-commit gate, the reachability
population floor (`scripts/reachability.ts`, exit 2), and the `USAGE`→README test each protect a
failure at least as easy to walk into — and none of them needed anyone to remember anything.
Same agent, same session, same fatigue. The variable was the mechanism, not the wording.

**Trigger.** Two moments, and the second is the important one:
1. You are about to *add* a gotcha to a doc, an anti-assumption list, or a handoff.
2. You have just been bitten by one that **was already written down.**

**Failure mode.** A docs-only remediation that *feels* like a fix. It closes the incident, inflates
confidence, and leaves the actual recurrence rate untouched — so the next firing is read as
carelessness rather than as evidence the remedy never worked. It also quietly discounts every other
written lesson, because the ledger's implied promise is that writing something down changes behavior.

**Mitigation.** A decision rule, not an exhortation:

- **First firing** → write it down. A doc is the right first response; the trap may never recur.
- **Second firing of the SAME trap** → the doc is now *disproven evidence*. Stop re-wording it and
  open a work item for a **mechanism at the point of use**. Ask: what would have to be true for the
  lazy path to be *impossible* (or loud) rather than merely discouraged?
- **Grade the mechanism by where it sits**, cheapest-first: a gate/hook that refuses the call · a
  test that goes red · a lint · a wrapper script that owns the correct incantation · a
  known-positive canary. Any of these beats the best-written paragraph.
- **When no mechanism is affordable, say so explicitly** and record it as a measured deferral — an
  accepted recurrence, not a solved problem. Never let "documented" stand in for "handled."

**Corollary for rule-writers.** Put the rule in the **operative** surface — the hook, the nag, the
prompt the agent actually follows at the moment of use — not the broadcast surface it will never
re-read. A rule whose correct path costs more than its lazy path decays under convenience and must
be carried by a net, never by text alone.

**On the self-reference.** This lesson is itself a written sentence about the weakness of written
sentences, and promoting it changes nothing by itself. That is precisely why its acceptance shipped
with `OQ-010` — the three traps above graded for mechanisms — rather than with a note to be more
careful. A lesson of this class that lands with no work item attached has just demonstrated its own
claim.

**Recurrence count:** 3 firsthand in one session (2026-07-25/26), each against a trap already
documented in this repo. Independently corroborated the same day across the agent room — four
separate cases of "doctrine we ship in one instrument turned out absent in another."
