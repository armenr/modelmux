---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-07-25
last-modified: 2026-07-25
work-unit: WU-0001
supersedes: []
superseded-by: null
related: []
tags: [cli, routing, agents, tagging]
---

# ADR-0001 — Untagged third-party agents get a new `tag` verb, not a loosened `use` guard

## Context

The default cascade in `routes.toml` ends with `{ when = { anySubagent = true }, use = "flagship" }`.
Any subagent whose prompt carries no `<<route:alias>>` tag and matches no earlier rule lands there.
modelmux's own four agents are all tagged, so this is invisible in-repo — but **agents installed from
outside are untagged by construction**: a docs kit, a starter pack, a teammate's crew. With the proxy
active they route to whatever `anySubagent` names, and nothing in the tool's output says so.

Surfaced 2026-07-25 by an external reviewer reading the cascade, and confirmed against source. The
reviewer proposed the fix as "one route tag per agent file, which your own `switch-models` CLI already
writes." That premise turned out to be half true, which is what forced this decision: `retargetAgentTag`
is a **replace**, and `cli.ts` throws `no <<route:...>> tag found to retarget` when there is none — so
`mux use` fails on exactly the files that need fixing. There was no way to add a first tag at all.

A second detail decided the shape. The throw is not an oversight: its comment says *"Throws if there is
no tag to retarget, so `use` can't report a false success on a tagless file."* It is a deliberate guard
against silent success, and it is correct.

## Alternatives Considered

- **Option A — loosen `retargetAgentTag` to insert when no tag is found.** Rejected: it deletes a
  working guard to add a feature. `use <agent> <alias>` would then succeed on a typo'd agent name only
  because the file happened to be tagless, and the operator could not tell "retargeted the agent I meant"
  from "created a tag on something else." The guard exists precisely to make that distinguishable.
- **Option B (the runner-up) — a `--create` / `--force` flag on `use`.** Genuinely strong: one verb, one
  mental model, discoverable from the existing command, and the flag makes intent explicit rather than
  implicit, so it does *not* fail the false-success axis the way Option A does. Rejected on the same axis
  one step further out: the flag makes the guard *opt-out at the call site*, and a flag that exists to
  bypass a safety check gets pasted into scripts and muscle memory until it is always on. A separate verb
  cannot be habitually appended.
- **Option C — documentation only: tell people to hand-edit the file.** Rejected: the repo ships a CLI
  that manages exactly this tag, and the interaction is silent. Documenting a manual workaround for a gap
  in your own tool is a note, not a fix.
- **Chosen — a new `tag <agent> <alias>` verb with the inverse guard.** Defended in Decision.

**Deciding axis:** *can the command report a success that does not match what the operator intended?*
That is the criterion that killed Option A (it can, silently) and Option B (it can, once the flag becomes
habitual).

**Axis check:** the chosen option is selected by that same criterion, not a softer one. `tag` refuses a
file that already has a tag, and `use` refuses a file that has none. Each verb fails loudly on the other's
input, so neither can produce a success the operator did not ask for — and unlike Option B there is no
flag that turns the check off. The axis selects the winner by the same test that rejected the runners-up.

**Flip-condition:** if agent files ever gain a canonical machine-writable metadata surface the proxy
actually reads (a front-matter field rather than a body marker), both verbs collapse into a normal config
write and the guard distinction stops mattering — the ambiguity being guarded against is an artifact of
the tag living in free prose. Also reversed if `anySubagent` ever defaults to passthrough instead of a
model alias, since untagged agents would then be safe by default and this would become a convenience.

## Prior art / reference

The split mirrors the common create-vs-update separation in config tooling (`git config --add` vs
plain set; `useradd` vs `usermod`) where the safety property is that neither silently does the other's
job. No novel shape here.

## Decision

Add `tagAgent(text, alias)` and expose it as `modelmux tag <agent> <alias>`. It inserts a first
`<<route:alias>>` into an agent that has none, and throws if one already exists. `retargetAgentTag` and
`use` are unchanged: they retarget an existing tag and throw when there is none. The guards are
deliberately symmetric — one refuses to create, the other refuses to overwrite.

Placement is load-bearing and is covered by a test: the tag is inserted **after** YAML front matter, in
the prompt body. Front matter is harness metadata and never reaches the proxy, so a tag written inside
the fences would be present on disk and route nothing.

For third-party agents the alias to reach for is `control`, whose route rule sits above `anySubagent` and
resolves to `orchestrator` (`anthropic:passthrough`) — the only tag value under which an external model
pin still describes what actually answers.

## Consequences

**Good.** The gap is closable with one command instead of a hand edit. The existing false-success guard
survives intact. The `<<route:control>>` recipe is now documented in the README where someone installing
a third-party crew will meet it.

**Costs, named.** The CLI surface grows a fifth verb, and `tag` vs `use` is a distinction users must
learn — the error messages point at each other to make that cheap, but it is real. The command still
assumes `.claude/agents/<name>.md` relative to cwd, so it is unusable from outside a project root, same
as `use`. And it does **not** fix the underlying silence: an untagged agent still routes to
`anySubagent` with no warning at request time. This ADR gives operators a fix; it does not make the
diversion loud. Making it loud (a startup warning naming untagged agents, or a route-time log line) is
unaddressed and is the obvious follow-on.

## Follow-up (landed 2026-07-25, same session)

The gap this ADR named under Consequences — *"it does not make the diversion loud"* — has since been
closed. `src/agents.ts` computes a startup notice naming every untagged agent, where the `anySubagent`
rule would send it, and the command to pin it; `startProxy` writes it to stderr. It is deliberately
silent in the three cases where there is nothing to act on: no `anySubagent` rule, a rule resolving to
passthrough (still Claude — a diversion in name only), or no untagged agents. That silence-condition is
the load-bearing part and carries its own test, because warning on untagged-agents-alone would fire on
repos that are not actually exposed. Still open: nothing warns at *request* time, so an agent added
after boot is unannounced until the next restart.

## Related

- `memories/installed-safety-gate-does-not-protect-this-repo.md` — the same session's separate finding;
  unrelated defect, same origin.
- `reference/fieldbook-install-reconstitution.md` — records that this repo's own agents are all tagged,
  so the exposure is third-party only.
