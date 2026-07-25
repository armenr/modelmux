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

*(none — all seven resolved 2026-07-25.)*

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
