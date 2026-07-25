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

- **OQ-002** (🟠 robustness; surfaced 2026-07-25 while reading the token claims) — **modelmux reads the
  Codex credential but never refreshes it.** `access_token` is valid only until **2026-07-28**.
  **Codex is the ONLY upstream with this exposure** (verified 2026-07-25 against `BUILTIN_UPSTREAMS`):
  `anthropic` is `passthrough` so modelmux never holds the credential, and `openrouter`/`zai`/`kimi`
  are console-issued API keys with no clock. Console key vs OAuth grant is the whole distinction.

  > **CORRECTION 2026-07-25 — the original wording ("no recovery path from inside modelmux") was too
  > strong.** Verified in code: `rewriteHeaders` runs *inside* the request handler (`src/server.ts:50`)
  > and `readCodexAuth` does an **uncached** `readFileSync` per call — so modelmux re-reads
  > `~/.codex/auth.json` on **every request** and picks up a token refreshed by any other process on the
  > very next call, no restart. The `codex` CLI refreshes it when it runs. The real gap is therefore
  > narrower: it bites only a modelmux-only user whose CLI never runs again.

  **Resolve:** (a) redeem the stored `refresh_token` ourselves, or (b) detect 401 and fail loud with
  "re-run `codex login`". (a) carries a hazard that must not be discovered the hard way: if OpenAI issues **rotating** refresh tokens, redeeming ours *consumes* it and invalidates the
  copy still in `auth.json` — **breaking the user's own `codex` CLI**, the very tool we depend on for
  credentials. That also kills the otherwise-clean in-memory-only variant. Writing the new token back
  avoids the invalidation but breaks the never-writes promise and races the CLI on the same file.
  > **UPDATE 2026-07-25 — the gate moved, it did not lift.** This previously said (a) was blocked
  > "while the endpoint is circuit-broken (`OQ-001`)". OQ-001 is now RESOLVED and the endpoint works,
  > so that reason is void — but **(a) is still not safe to try**, for a different and better reason:
  > *the test IS the dangerous act.* Finding out whether the refresh token rotates requires redeeming
  > it, and if it does rotate, that single redemption invalidates the copy in `auth.json` and breaks
  > the operator's `codex` CLI. There is no read-only probe. So (a) needs either vendor documentation
  > or a throwaway account — not an experiment on a working login.

  **Leaning (b)** — it is safe today, correct regardless, and needs no such experiment.
  Relates: WU-0003, OQ-001.


- **OQ-003** (🟠 leak/ergonomics; surfaced 2026-07-25 by the operator asking whether anything was
  machine-specific) — **`CLAUDE.md` is committed to the PUBLIC repo carrying machine-specific partyline
  paths** (`/home/v3ct0r/rooms/crates`, an absolute local binary path) plus instructions telling a
  *contributor's* Claude that it is "agent modelmux" and should arm a monitor on a room that does not
  exist for them. Not secret, but useless-to-wrong for everyone else. **Resolve:** operator's call —
  gitignore `CLAUDE.md` (loses the useful kit constitution too), commit it without the partyline block
  (which `partyline wire` will re-add locally), or accept it. Left untouched deliberately: that marker
  block is managed by `partyline wire` and editing it risks desyncing the fleet wiring.

- **OQ-005** (🟢 minor robustness; surfaced 2026-07-25 while verifying OQ-002) — **`readCodexAuth` does a
  synchronous `readFileSync` on the request path**, once per Codex-routed request. `node-ts-rules.md`
  says don't do sync I/O on a request path where the async API exists. It is small and it buys the
  free-refresh-pickup behaviour described in `OQ-002`, so it is a real trade rather than a plain defect. **Resolve:**
  either accept and document the trade, or move to an async read with a short TTL cache — noting a
  cache would *weaken* the pick-up-a-refreshed-token-immediately property. Relates: WU-0003, OQ-002.

- **OQ-006** (🟡 fidelity; surfaced 2026-07-25 during the live Codex field test) — **The streamed
  `message_start` reports `input_tokens: 0`.** Responses only reveals usage at `response.completed`, but
  Anthropic puts input usage in `message_start`, which we must emit first. The **non-streaming** path is
  correct (measured 19/16). Streaming `output_tokens` is correct (measured 38); only streamed
  `input_tokens` is wrong, and it is wrong as **0**, which reads as free rather than unknown.
  **Resolve:** carry `input_tokens` in the final `message_delta.usage`, or accept and document.
  Relates: WU-0003.


## Recently resolved

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
