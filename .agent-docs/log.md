---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [log, journal]
---

# Operational log — modelmux

<!-- THE one canonical operational journal. It lives HERE, at the `.agent-docs/` root (not under
     `now/`, not per-directory). There is exactly one log; append to it, never fork it.

     Append-only. NEWEST ENTRY AT THE TOP (directly under this note). One entry per session or
     operation. Keep the heading grep-parseable:

         ## YYYY-MM-DD | <op / session label> — <one-line summary>
         <a short paragraph: what happened, the commits, what's next.>

     A rejected lesson proposal logs its one-line reason here (see now/lessons/proposals.md). -->

## 2026-07-25 | WU-0002 — flat-rate subscriptions: Kimi built in, Codex ruled out

Request was "subscription support for GLM 5.2, GPT Codex, Kimi K3". Checked each against vendor primary
docs rather than memory, and they turned out to be three different problems. GLM 5.2 already worked —
the `zai` built-in is current and `glm-5.2` is the right slug; it was under-documented, not missing.
Kimi K3 was real work and a clean fit: Kimi Code is flat-rate at `api.kimi.com/coding` speaking
Anthropic Messages, so it drops in as a built-in with `KIMI_API_KEY`. Codex does not fit at all — see
ADR-0002.

Two traps found while verifying, both now documented. Moonshot sells TWO products with different hosts,
different model ids (`k3` vs `kimi-k3`) and non-interchangeable keys; the built-in is the subscription.
And Kimi Code's own docs publish their base WITH a trailing slash, which `base + "/v1/messages"` would
have doubled — hence `normalizeBase`, which also protects any user-declared `[upstreams]` entry.

Operator caught a real error in review: I had written `k3-256k` as the large-codebase option. Backwards.
K3 is a 1,048,576-token model and on Kimi Code the usable window is TIERED BY PLAN — lower tiers cap near
256K, higher tiers get the full 1M — so `k3-256k` is the CAPPED variant and plain `k3` is the full one,
which Moonshot's docs also say outright. Corrected in README and routes.toml, and the 1M window makes the
commented-out `longContext` route genuinely useful, so that now points at it.

Gates: lint clean · typecheck clean · 107 tests · doc-lint clean 35 files · index-lint rc=0. Both doc
linters caught a missing ADR-0002 index row before commit.

## 2026-07-25 | WU-0001 (cont.) — the diversion is now LOUD, not just fixable

Closed the limitation ADR-0001 named for itself. `src/agents.ts` + a `startProxy` call now print a
startup notice listing every untagged agent, the alias `anySubagent` would send it to, and the command
to pin it. Verified by booting the proxy against a scratch project: two untagged agents named, the
tagged one absent; then `mux tag kit-planner control` and a reboot dropped it to one. Warn → fix →
warning shrinks, end to end.

The load-bearing design choice is where it stays SILENT: no `anySubagent` rule, or one resolving to
passthrough (still Claude, so not a diversion), or nothing untagged. That has its own falsifier — I
removed the passthrough check and two tests went red, because the naive version warns on repos that
carry untagged agents but are not actually exposed. Gates: lint clean · typecheck clean · 101 tests.

Still open: no request-time warning, so an agent added after boot is unannounced until restart.

## 2026-07-25 | WU-0001 — `tag` verb closes the untagged-third-party-agent gap

Added `tagAgent` + `modelmux tag <agent> <alias>` (`src/cli.ts`), the insert counterpart to `use`'s
retarget. Cause: the `anySubagent` catch-all silently diverts any agent without a `<<route:>>` tag, and
third-party agents ship untagged by construction — but `use` throws on a tagless file, so there was no
way to add a first tag. Left that throw intact: it is a deliberate false-success guard, not a defect.
Guards are now symmetric (`use` refuses to create, `tag` refuses to overwrite). Reasoning + the two
rejected alternatives in ADR-0001.

Placement was the risk and carries its own falsifier: the tag goes in the prompt body, after front
matter, because front matter never reaches the proxy. Verified by breaking the implementation on purpose
and watching three tests go red — one of which only caught it after I fixed the test itself, which had
been feeding `extractSignals` the whole file including front matter and so could not detect the very
thing it claimed to check.

Gates: lint clean · `tsc --noEmit` clean · 90 tests pass · build compiles. WIRED proven end-to-end from
`bin/mux` in a scratch cwd, with `extractSignals` reading the tag back. Also ignored `.agent-docs/**` and
`CLAUDE.md` in `eslint.config.mjs` — the Fieldbook install added 22 lint errors in kit-owned markdown
that would have failed CI, and those files are governed by `lint-docs.py`, not eslint.

Next: nothing blocking. The diversion is still SILENT at request time — this gives operators a fix, not a
warning. A startup or route-time notice naming untagged agents is the obvious follow-on (ADR-0001
§Consequences).

<!-- newest entries appended above this line -->
