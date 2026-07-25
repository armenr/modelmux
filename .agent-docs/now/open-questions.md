---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-25
tags: [current, open-questions]
related: [status, work-plan, obligations]
---

# Open questions — modelmux

> `OQ-NNN` is the single source. Reference by number. Resolve → move the item to "Recently resolved"
> with a closure reference (a commit / `ADR-NNNN` / log entry). Surface gaps loudly — an honest
> open-question beats a polished plan with a hidden assumption.

## Open

- **OQ-008** (🟡 doc-drift/carrier; surfaced 2026-07-25 by a peer's *quoted-is-still-typed* argument) —
  **Four of our five providers' model tables are FROZEN transcriptions; only OpenRouter's is derived.**
  `mux check-latest` re-derives the OpenRouter slugs against the live catalog at run time, so they
  cannot rot silently. The **Anthropic, Z.ai, Kimi and Codex** tables in `README.md` were verified by
  hand on 2026-07-25 and then frozen — and `check-latest` says so in its own output:
  *"(2 non-openrouter model(s) not checked — check-latest only verifies OpenRouter.)"*
  The gap is self-reported and nothing acts on it.
  > **Why this is a carrier problem, not a diligence one.** A hand-verified table is correct at
  > authoring time and rots the day a vendor changes a slug — which is exactly how the README came to
  > ship `gpt-5.3-codex`, a model that does not exist. Being more careful was not what fixed that;
  > probing the live endpoint was. *"A quoted doc string is still a typed literal — derived once, then
  > frozen."*
  > **PARTIALLY ADDRESSED 2026-07-25 — the date column, not the probes.** The frozen tables are not
  > wrong to be frozen: probing five providers per README build is real cost. What was missing is that
  > they did not **admit** they were frozen. All four now carry their **referent and derivation date**
  > (2 of 4 already did; GLM and Kimi were the gap), and `check-latest` now discloses **when** as well
  > as **which** — "not checked" says a claim is frozen but not how stale, and staleness is the half
  > that decides whether to trust it today. A frozen literal is not the problem; one that does not
  > admit it is frozen is. What remains open is the run-time probing below.

  **Resolve:** extend `check-latest` to verify what it can derive per provider — Anthropic via the
  Models API (needs a key), Codex via `~/.codex/models_cache.json` (on disk, no network), Z.ai/Kimi
  likely not derivable without credentials — and have it **say which providers it could not check**
  rather than implying full coverage. Deliberately NOT done on a branch that is ready to merge; adding
  provider probes is feature scope. Relates: WU-0003, `LP-001`.

## Recently resolved

- **OQ-007** — *the cited IMPL→WIRED oracle had never run.* → **RESOLVED 2026-07-25.** `knip@6.29.0`
  added as a devDependency (currency-checked against the npm registry: published 2026-01-22, actively
  maintained, first-class Bun plugin; `ts-prune` rejected as stalled since 2021). `knip.json` declares
  the **production** entrypoints — `src/main.ts`, `bin/mux`, `scripts/record-fixtures.ts` — and
  deliberately **excludes tests**. Wired as `bun run reachability` (~169 ms), into the `check` script
  and into CI.
  > **The vacuity trap, and why the config looks the way it does.** Every `src/*.ts` here has a test
  > that imports it. Admitting tests as entrypoints makes the whole tree look reachable and the oracle
  > reports clean *forever* — coverage-shaped output that checks nothing. **Derived, not assumed:** a
  > module imported only by a test is flagged (`rc=1`) with tests excluded, and goes **silent**
  > (`rc=0`) the moment tests are added to `entry`. `test/reachability-config.test.ts` is the standing
  > guard on that, and is itself non-vacuous (widen `entry` → it goes red).
  > **Non-vacuity proven twice**, before and after the config was edited — a config change is exactly
  > how an oracle silently disarms.
  >
  > **And knip alone was not enough.** Measured: it exits **0 over a population of ZERO** — point
  > `project` at a glob matching no files and it emits a hint and still returns success, which is
  > byte-identical to a clean tree. The config guard could not see it either (the config was
  > well-formed). `scripts/reachability.ts` wraps knip to supply the term it cannot: it **prints the
  > population** rather than implying it, **verifies every entrypoint exists** on disk, and **floors
  > the population** at 10 files — exiting **2** (distinct from knip's 1) when the check itself cannot
  > be trusted. Three controls, three distinct codes: planted orphan → **1**, empty population → **2**,
  > renamed-away entrypoint → **2**, healthy → **0**.

  **It found a real defect on its first run.** `forwardUrl` was exported, unit-tested, and **never
  called** — `src/server.ts` duplicated its logic inline, so the one tested URL-builder was not the one
  production ran. Now wired: breaking `forwardUrl` fails **6 tests including integration tests**, where
  before it would have failed only the unit test of dead code. Per the standing rule, the dead export
  was a *symptom* (duplication) and the fix was the missing call, not a deletion.

- **OQ-003** — *machine-specific partyline paths in the public `CLAUDE.md`.* → **RESOLVED 2026-07-25,
  operator's call from four options: strip-and-skip-worktree.** The committed `CLAUDE.md` now carries
  ONLY the portable Fieldbook constitution (`kit:start`/`kit:end`); the machine-specific
  `partyline:begin`/`end` block is gone from git. The local file keeps its block unchanged and is held
  out of git with `git update-index --skip-worktree CLAUDE.md`, because `partyline wire` writes only to
  `CLAUDE.md` and has no alternate-target flag. Verified: `git status` clean · local file has the block
  and 4 machine paths · committed version has **0** of either and still carries the kit block.
  > **⚠️ The gotcha this creates, recorded so it is not rediscovered the hard way.** `skip-worktree` is
  > **per-clone local state**, not committed. Two consequences: (a) a fresh clone does NOT have it, so
  > re-running `partyline wire` there makes `CLAUDE.md` show as modified until the bit is set again;
  > (b) a **kit upgrade that edits `CLAUDE.md` will fail or behave confusingly** while the bit is set —
  > `git update-index --no-skip-worktree CLAUDE.md`, take the upgrade, re-strip, re-set. That is the
  > accepted cost of the chosen option, not a defect.

- **OQ-002** — *Codex credential is read but never refreshed.* → **RESOLVED 2026-07-25 by option (b).**
  modelmux now detects a `401`/`403` **from a `codex`-auth upstream specifically** and fails loud with
  the actual remedy — "the token in `~/.codex/auth.json` has most likely expired; re-run `codex login`,
  no restart needed" — instead of forwarding an opaque provider 401. Scoped to the codex auth kind on
  purpose: any other upstream's 401 means a wrong API key, which is a different fix. Option (a)
  (redeeming the refresh token ourselves) is **deliberately NOT done**, and the reason is sharper than
  the original one: *the test IS the dangerous act.* Establishing whether the refresh token rotates
  requires redeeming it, and if it does, that one redemption invalidates the copy in `auth.json` and
  breaks the operator's own `codex` CLI. There is no read-only probe, so (a) needs vendor documentation
  or a throwaway account — never an experiment on a working login.
- **OQ-005** — *sync `readFileSync` on the request path.* → **RESOLVED 2026-07-25: ACCEPTED, measured.**
  **0.002 ms/call** over 2,000 warm reads — **0.0001%** of a ~1.4 s Codex round trip. Going async would
  make `applyAuth`/`rewriteHeaders` async and ripple through the whole call chain for ~2 µs, and adding
  a cache would *weaken* the per-request pickup of a CLI-refreshed token that `OQ-002`'s answer depends
  on. Recorded as a measured trade, not an assumed-fine.
- **OQ-006** — *streamed `message_start` reports `input_tokens: 0`.* → **RESOLVED 2026-07-25.** Both
  stream translators now capture input usage when it arrives (at the END of the stream, long after
  `message_start` had to claim a number) and report it in the final `message_delta`. Live-verified
  against the real Codex backend: `{"input_tokens":15,"output_tokens":5}` where it previously read 0.
  The `message_start` placeholder stays `0/0` — that value genuinely is not known yet.

- **OQ-001** — *Is the Codex auth pair actually ACCEPTED?* → **RESOLVED 2026-07-25: YES.** The endpoint
  recovered and a direct probe returned **HTTP 400 `The 'gpt-5.3-codex' model is not supported`** — a
  *model* complaint, which means the request got **past authentication**. Confirmed end-to-end at 200
  through modelmux. Two bonus measurements that contradict prior belief: **neither `ChatGPT-Account-ID`
  nor `OpenAI-Beta` is required** — both omitted still return 200 on a single-account login (the code
  comment claiming the account header was load-bearing was FALSE and is corrected in place).
- **OQ-004** — *The Responses adapter has never run against a real Responses backend.* → **RESOLVED
  2026-07-25.** Field-tested live end-to-end: non-streaming, streaming, tool call, tool-result round
  trip, and streaming tool-call JSON-fragment reassembly, all 200. Leg proven via `decisions.jsonl`:
  **6/6 requests `upstream=codex`, zero anthropic.** It found **five** real defects the unit tests could
  not — see `log.md` and ADR-0003 §Consequences.

- **(unnumbered)** — *Does modelmux need a second process (LiteLLM) in front of OpenAI-format
  backends?* → RESOLVED 2026-07-25 by `03bcc2e`: no. The Chat Completions adapter is native, and the
  README's "run LiteLLM" advice for local runners is superseded. The operator's challenge — "modelmux
  is fully self-contained… are we not expecting users to have a second tool?" — is what surfaced it.
- **(unnumbered)** — *Was the Kimi `k3-256k` slug the large-context option?* → RESOLVED 2026-07-25,
  **no, backwards**: K3 is a 1,048,576-token model and `k3-256k` is the CAPPED variant; on Kimi Code
  the usable window is tiered by plan. Corrected in README + `routes.toml` before merge, after the
  operator questioned it.
- **(unnumbered)** — *Is the Codex token expired, explaining the failures?* → RESOLVED 2026-07-25, no:
  `access_token` valid until 2026-07-28; only the `id_token` (identity claims, not used for API auth)
  had expired. Hypothesis eliminated; `OQ-001` later confirmed the auth pair is accepted outright.
