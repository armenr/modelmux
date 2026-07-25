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

## 2026-07-25 | OQ sweep — pre-commit gate finally armed, three OQs closed

**The pre-commit gate now actually gates.** Root cause of 16 silent skips: `.git/hooks/pre-commit` was
a pre-commit.com shim run with `--skip-on-missing-config` against a config this repo never had, so it
fired and exited 0 every time. `lefthook.yml` exists but lefthook was never installed; Fieldbook's real
dispatcher sat tracked-but-unwired because `core.hooksPath` was unset. Ran `install-hooks.sh`, which
pointed git at `.githooks/` and RENAMED the stale shim so an `--unset` cannot resurrect it.

Then the acceptance test that matters — **made it fail on purpose.** Staged a deliberate lint
violation: `git commit` exited **1**, HEAD did not move, and the log named the right gate
(`pre-commit: x lint gate FAILED (exit 1) -> commit blocked`). Probe removed, tree clean. A hook nobody
has watched block a commit is a hypothesis, not a gate. Undo: `git config --unset core.hooksPath`.

**OQ-002 closed via option (b).** A 401/403 from a `codex`-auth upstream now fails loud with the real
remedy rather than an opaque provider body. Option (a) stays undone for a reason worth keeping: *the
test IS the dangerous act* — finding out whether the refresh token rotates requires redeeming it, and
if it rotates, that one redemption breaks the operator's own `codex` CLI. No read-only probe exists.

**OQ-005 closed as accepted, MEASURED not assumed:** the sync `readFileSync` costs **0.002 ms/call**,
0.0001% of a Codex round trip. Async would ripple through the whole call chain for ~2 µs; a cache would
weaken the per-request refresh pickup OQ-002's answer relies on.

**OQ-006 closed and live-verified.** Both stream translators now report real input usage in the final
`message_delta` — `{"input_tokens":15,"output_tokens":5}` against the live backend, where it had been a
flat 0 that reads as "free" rather than "not yet known". The existing empty-choices usage test was
STRENGTHENED rather than loosened: it now asserts both figures survive that chunk.

OQ-003 (machine-specific paths in the public `CLAUDE.md`) stays open — `partyline wire` writes only to
`CLAUDE.md` and offers no alternate target, so every option is a real trade and it is the operator's.

## 2026-07-25 | model lists refreshed against PRIMARY sources — Claude Opus 5 landed yesterday

Operator flagged new Claude models. Verified every provider against a primary source rather than a
search summary, and the search summary was in fact wrong — it reported "Opus 4.8 and Sonnet 4.6" as
current. The **Anthropic Models API** (queried live) settles it: `claude-opus-5`, **created
2026-07-24**, is the new one. Full current set: `claude-opus-5` · `claude-sonnet-5` ·
`claude-fable-5` · `claude-haiku-4-5-20251001`. `claude-opus-4-1-20250805` is deprecated, retires
2026-08-05. README gains the Claude model table it never had.

**OpenRouter: all 5 shipped slugs valid** — verified with our own `mux check-latest` against 345 live
catalog entries. **Z.ai:** `glm-5.2` still newest, `glm-4.7` still available, and `glm-5-turbo` exists
and is promoted for coding — we had never mentioned it. **Kimi:** all four ids exact.

**One substantive correction, from the vendor's own docs:** we told users to "reach for plain `k3`
unless you specifically want the cap." Moonshot recommends the opposite — `k3-256k` delivers the same
results in a smaller window at **half the quota**, so it is the sensible default and `k3` is for when
you genuinely need >256K. Flipped in README and routes.toml.

`routes.toml` was also carrying three stale blocks from before today: a whole "GPT/CODEX works via
LiteLLM — just not a built-in" recipe (codex has been a built-in for hours), a built-ins list missing
`codex`, and a note telling OpenAI-format runners to put LiteLLM in front. All replaced.

Method note: `bun run src/cli.ts check-latest` printed NOTHING and exited 0 — `src/cli.ts` has no
`import.meta.main` guard, so the module loaded and exited. I nearly filed that as a silent-success
defect in our own CLI. It is `bin/mux check-latest`. Exit 0 with no output is not evidence the tool
found nothing; it can mean the tool never ran.

## 2026-07-25 | Codex FIELD-TESTED live — auth accepted, and the built-in was broken in five ways

Operator said the endpoint was back. It was, and that settled `OQ-001` immediately: the very first
direct probe returned `400 The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT
account` — a **model** complaint, which is only reachable **past authentication**. Auth accepted.

Then the useful part. The `codex` built-in, committed hours earlier with every gate green and 137 tests
passing, **would have 400'd on every single request.** Five defects, none visible to a unit test:
missing `store:false`; `stream` forwarded from the caller when the backend is **SSE-ONLY**;
`instructions` omitted when there is no system prompt; `max_output_tokens`/`temperature`/`top_p`
forwarded when each is a hard `400 Unsupported parameter` (and Anthropic *requires* `max_tokens`, so
that was the common path); and reasoning items opening an empty Anthropic content block on 100% of
streamed replies. All five fixed, each with a falsifier, all seven negative controls watched go red
with the blob hash confirming a clean restore. 137 → 145 tests.

**The trap worth keeping:** the terminal `response.completed` carries `output: []` — always empty.
Aggregating a non-streaming reply from it is the obvious implementation and silently returns a
structurally-valid EMPTY message. Content lives only in the per-item events.

Two beliefs measured FALSE: `ChatGPT-Account-ID` is not required (our own code comment called it
load-bearing — corrected in place, kept because a multi-account login is exactly what a single-account
test cannot observe), and neither is `OpenAI-Beta`. And the README shipped `gpt-5.3-codex`, which does
not exist; 8 slugs verified working, 3 rejected. `models_cache.json`'s `supported_in_api` flag refers
to the *platform* API, not this endpoint — `gpt-5.3-codex-spark` is `false` there and works fine here,
so a table-based inference would have been wrong too.

Method note, since the operator had to say it twice: I started probing model slugs one at a time
instead of reading the CLI's own cache and searching for the documented constraints. Checking the web
gave the whole constraint set at once. Guessing serially where a source exists is the expensive path.

## 2026-07-25 | WU-0003 committed — cleanup closed, and the README was wronger than the plan said

Shipped the three-item cleanup, then committed WU-0003 as `7ef2d4c` (work) and `fd08a9a` (README).
ADR-0003 supersedes ADR-0002 and records that the operator reversed the no-built-in call on explicit
request — with an honest provenance banner noting the ADR was reconstructed *after* the code, which is
the lapse that let ADR-0002 sit contradicted by shipped code for a whole cycle.

**The plan said "fix the stale README Codex section (~lines 260–295)". Reading found five stale spots,
not one** — and recon-before-build is why. The one that mattered was not on the list: the **Security &
scope** section asserted modelmux "is not a tool for using a Claude/ChatGPT *subscription* outside its
official client", which the `codex` built-in makes flatly false. That is the section a cautious reader
uses to decide whether to trust the tool. Rewritten to state the real bright line (no pooling, no
reselling, no harvesting or forging) and to name the grey area plainly rather than soften it: the codex
path sends a token the official CLI obtained, from a process that is not that CLI, to an endpoint
OpenAI does not document. Also stale and fixed: the "OpenAI-format runners need LiteLLM in front"
advice — falsified by the *already-committed* `03bcc2e`, not by this session's work.

Also noted: the pre-commit hook **skipped** both commits (`.pre-commit-config.yaml` not found), so the
manual gate runs were the only verification, not a backstop. Worth knowing before trusting it.

## 2026-07-25 | decision | Codex is the ONLY upstream with an expiring credential — and OQ-002 overstated the gap

Operator asked whether token refresh affects anything besides Codex. Verified against
`BUILTIN_UPSTREAMS`: no. `anthropic` is passthrough (modelmux never holds it), and
`openrouter`/`zai`/`kimi` are console-issued API keys with no clock. Console key vs OAuth grant is the
whole distinction.

Verifying it corrected a filed doc: OQ-002 said there was "no recovery path from inside modelmux". Too
strong. `rewriteHeaders` runs inside the request handler and `readCodexAuth` does an **uncached**
`readFileSync` per call, so modelmux re-reads `auth.json` on every request and picks up a
CLI-refreshed token on the next call with no restart. The gap only bites a modelmux-only user.

The fork is now sharp, and option (a) carries a hazard worth recording before anyone implements it: if
OpenAI issues **rotating** refresh tokens, redeeming ours consumes it and invalidates the copy in
`auth.json` — breaking the user's own `codex` CLI, the tool we depend on for credentials. That also
kills the otherwise-clean in-memory-only variant, and it cannot be tested while the endpoint is
circuit-broken. So (a) is gated on OQ-001; (b) fail-loud-on-401 is safe now. Opened OQ-005 for the
sync `readFileSync` on the request path, which is the price of the free-refresh-pickup behaviour.

## 2026-07-25 | memory | "doc-lint clean — N files" is a partial claim on this tree

Measured after a fieldbook finding: `lint-docs.py` skips rules 8/15/21/12 on any doc whose
`provenance:` is `kit-template`, path-independently — **17 of our 37 files**, permanently, because that
provenance is *correct* for verbatim kit copies and will never be bumped. Armed-vs-control found 2 real
hidden findings, both kit-owned (do not patch; the fix arrives on upgrade).

Two things worth keeping. **Hit count is not debt**: 17 hits → 2 findings here, versus another tree's
4 → 6. And a near-miss of my own — the first control flipped *one* of the 17 (`log.md`, whose refs are
all live ids, making it the file least able to produce a finding), found zero, and nearly went out as
"latent on this tree". A negative control on a subset is only evidence if you can say why the subset is
representative; "it was the first one I tried" is not that.

## 2026-07-25 | handoff | WU-0003 — modelmux speaks OpenAI wire formats natively; Responses+Codex uncommitted

Session turned on one operator challenge: *"modelmux is fully self-contained… are we not expecting users
to have a second tool running to daisy-chain with it?"* That was right, and the inconsistency was already
shipped — the README told users to front LM Studio/llama.cpp/vLLM with LiteLLM. Fixed by making the proxy
speak the formats itself. Chat Completions adapter committed (`03bcc2e`) and field-tested end-to-end
against local Ollama (gemma4:31b): non-streaming tool call, streaming tool call whose `input_json_delta`
fragments reassemble to valid JSON, and the `tool_result` round trip. Responses adapter + `codex` auth
built and green but UNCOMMITTED.

Method note worth keeping: the operator asked whether the adapter was written from confirmed spec or from
memory. It was memory plus one secondary source. Checking the primary specs then caught THREE real
defects — missing `stream_options.include_usage` (token counts structurally always zero), reading usage
after a `choices[0]` guard when the usage chunk carries an EMPTY choices array, and `max_tokens` being
rejected by newer OpenAI models. Each now has a test that fails against the memory version.

## 2026-07-25 | decision | PR #15 gets retitled, not split

The branch outgrew its title (subscription work + the whole Chat Completions adapter). Splitting costs
another rebase for no real gain — the commits are coherent as "modelmux speaks more wire formats".

## 2026-07-25 | ingest | obligations swept; two debts settled

Settled and journaled: the fieldbook install report card (accepted; its finding 1 booked upstream as a
kit defect) and partyline's audit of this repo's install (ruled SOUND). New receivable: operator ruling
on `OQ-003`. New debt: the three-item cleanup before any new feature work.

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
