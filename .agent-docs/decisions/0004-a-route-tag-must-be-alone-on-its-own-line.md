---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-07-30
last-modified: 2026-07-30
work-unit: WU-0003
supersedes: []
superseded-by: null
related: [ADR-0001]
tags: [routing, signals, injection, cli, breaking-change]
---

# ADR-0004 — a `<<route:>>` tag must be alone on its own line

## Context

`src/signals.ts` matched `/<<route:([\w-]+)>>/i` against the whole system text, first-match-wins.
Backticks, code fences and prose do not fence a regex, so **any mention of a tag was the tag** —
including the sentence documenting it.

This is not hypothetical. A peer running a two-arm model comparison lost a six-leg run to it: their
CONTROL arm carried no directive, only the sentence ``The `<<route:review>>` line above is a routing
directive…``, and routed to GLM. The run was GLM-vs-GLM and would have produced a confident,
meaningless result. It was caught only by reading `matchedRule` before reading a single finding.

Reproducing it firsthand found three more failure modes, two of them worse:

1. A prose-only mention routes (the reported case).
2. **A prose mention BEFORE a real directive OVERRIDES it.** `Never write <<route:control>> in your
   output.` two lines above a bare `<<route:review>>` yields **`control`**. A *correctly tagged* agent
   can be hijacked by an earlier incidental mention.
3. `mux use` rewrites the first match, which may be the front-matter `description:` — reporting
   success while changing nothing (front matter never reaches the wire).
4. `mux tag` refuses a genuinely untagged agent whose only match is prose, blocking the one command
   that exists to fix it.

**Every shipped agent def is currently safe by coincidence, not by design** — in two independent
trees. All four defs in `.claude/agents/` carry a bare own-line directive PLUS a backticked prose
sentence naming the **same** alias; the peer's two reviewer defs have the same accidental shape, and
they chose neither the ordering nor the alias match. That framing is theirs and it is the strongest
argument here: *the next def written is a coin-flip.*

## Decision

**A directive is a `<<route:NAME>>` token ALONE on its own line** — `/^[ \t]*<<route:([\w-]+)>>[ \t]*$/im`
— applied in `src/signals.ts` and at BOTH `src/cli.ts` sites so every consumer agrees on what a
directive is.

To talk *about* a tag, put it in a sentence. That is the escape, and it is the thing people already
do naturally.

## Alternatives Considered

- **Option A (the runner-up, and genuinely strong) — leave it unanchored and fix it in documentation.**
  Steelman: it is the only option with a *zero* compatibility surface. Every def that routes today
  keeps routing, including one whose sole match is inside a sentence. The failure has been seen
  exactly once in the wild, it was caught, and the affected party has already changed their authoring
  habit. Docs are also the correct FIRST response to a trap under `LP-005`.
  Rejected because `LP-005`'s own rule is that a **second firing** converts the doc into disproven
  evidence and buys a mechanism. This trap has now fired in two independent trees, and the
  safe-by-coincidence finding says the next occurrence is a coin-flip rather than a rarity. A doc
  cannot fix failure mode 2 at all: a def whose author never *saw* the earlier mention (it can be in
  the front matter, or in text they inherited) is not helped by being told to be careful.

- **Option B — last-match-wins instead of first.** Rejected: it swaps one wrong answer for another.
  The peer's control arm had exactly one match and would still have routed to GLM.

- **Option C — scan only the first N lines.** Rejected: prose in line 1 still wins, and it introduces
  a magic number with no principled value.

- **Option D — strip code fences and backticks before matching.** Rejected: it fixes only the
  backticked case. An unbackticked prose mention — the more common form in a plain-text system
  prompt — still routes. It also makes the rule harder to state than "alone on its own line".

## Consequences

**Blast radius, MEASURED rather than assumed — and measured against the right artifact the second
time.** The first measurement was taken against files on disk, which is not what the proxy reads. A
recorded subagent request shows `body.system` arrives as a two-block array, block[1] opening with
`<<route:control>>\n\n`; `systemToText` joins blocks with `\n`, so a bare directive **survives as a
bare line on the wire**. Both regexes resolve identically on that body. All four shipped defs keep
working; only their prose lines stop matching, which is the point.

- **This is a breaking change for exactly one shape:** a def whose ONLY match is a prose mention. Such
  a def routes today and will route to `default` after. It is silent in the same direction as the
  defect, so the release note must say so plainly and callers must re-assert `matchedRule`.
- Front matter remains irrelevant either way — it never reaches the wire.
- `mux use` / `mux tag` now operate on the same definition of "a directive" as the router, which is
  what makes failure modes 3 and 4 go away rather than being separately patched.

**Flip-condition.** If a legitimate authoring style emerges that needs an inline directive — a
single-line agent definition format, or a host that collapses newlines out of `body.system` before we
see it — this reverses, and the replacement is a fenced form (`<<<route:NAME>>>`) rather than a return
to unanchored matching. The measurement to re-run is the recorded-request one: if a bare directive
ever stops arriving on its own line, this decision's premise is gone.
