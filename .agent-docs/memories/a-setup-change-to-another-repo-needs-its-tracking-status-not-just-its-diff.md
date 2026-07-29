---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-29
last-modified: 2026-07-29
related: []
tags: [gotcha, git, cross-repo, secrets-adjacent, near-miss]
---

# Editing another repo's config needs `git ls-files` on the target, not just a clean diff

**Observed:** 2026-07-29, editing `aegis/.claude/settings.json` to pin
`ANTHROPIC_BASE_URL=http://127.0.0.1:8787` so that session would route through modelmux.

## What almost happened

`.claude/settings.json` is **git-tracked** in aegis, and aegis is a **public Apache-2.0 reference
architecture**. Committed, that line would have pointed every fork's Claude Code at a localhost proxy
that does not exist on their machine — connection-refused on first run, with no obvious cause, shipped
as repo policy.

It nearly went out: the owning agent had a 17-file docs commit queued for operator approval minutes
later, and that file was in the batch. What stopped it was that agent verifying an inbound claim against
its own tree instead of acting on the report.

## Why the report was useless despite being true

I reported *"one insert, hooks byte-identical."* Both halves were true and independently verifiable.
Neither said anything about **whether the file travels**, because I never asked. A diff describes what
changed; it cannot tell you where the change goes.

**The rule:** before editing config in a repo that is not yours, establish the target's tracking status.

```bash
git -C <repo> ls-files --error-unmatch <path>   # rc=0 => TRACKED, it will travel
git -C <repo> check-ignore -v <path>            # names the .gitignore line if ignored
```

Machine-local facts belong in the ignored layer. For Claude Code that is
`.claude/settings.local.json` — and per the current docs it is also the **higher-precedence** layer
(`Managed > CLI args > settings.local.json > settings.json > ~/.claude/settings.json`), so relocating
there strengthens the setting rather than weakening it. `env` carries no layer restriction and applies
"to every session **and to subprocesses Claude Code spawns from it**", so subagents inherit it.

## The part worth generalizing — why the discipline did not transfer

**I already had this scar and had exercised it an hour earlier.** modelmux's own `CLAUDE.md` carries
machine-specific content that must not reach git (`OQ-003`), and I ran the full skip-worktree dance for
it — clear the bit, rebuild from HEAD, commit, restore the local file, re-set the bit — *specifically so
a localhost path would not ship*. Then I walked into the same class one directory sideways.

The reason is not forgetfulness. The discipline was encoded as a **procedure attached to one named
file**, not as a **question asked of every file**. A procedure fires when you recognise its file; a
question fires when you recognise its *situation*. Only the second one is portable — and I was asking
"did I break their hooks?" rather than "will this travel?"

Distinct from `LP-005` (a written-down trap still fires because the doc never reaches the point of use):
here the discipline DID reach me, and I had executed it correctly sixty minutes before. Rule-as-ritual
vs rule-as-question is a different axis from documented-vs-mechanised.

## See also

`OQ-003` (the `CLAUDE.md` skip-worktree procedure this failed to generalize from) ·
`now/lessons/proposals.md` (`LP-007`).
