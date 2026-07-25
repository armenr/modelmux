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

- **OQ-001** (🔴 correctness, blocked externally; surfaced 2026-07-25 by field-testing the Codex
  upstream) — **Is the Codex auth pair actually ACCEPTED?** modelmux sends `Authorization: Bearer
  <access_token>` + `ChatGPT-Account-ID: <account_id>` read from `~/.codex/auth.json`. Every call
  returns `503 biscuit_baker_service_me_circuit_open`, and a circuit breaker can fire *before* auth is
  evaluated — so acceptance is **unproven, not proven**. Do not let a green build imply otherwise.
  **Resolve:** retry when OpenAI's Codex endpoint recovers; a 200 or a 401 both settle it. Control
  already established: OpenAI's own `codex` CLI fails identically, so the fault is theirs.
  Relates: WU-0003, OQ-002.

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
  "re-run `codex login`". **Leaning (b)**, and (a) carries a hazard that must not be discovered the hard
  way: if OpenAI issues **rotating** refresh tokens, redeeming ours *consumes* it and invalidates the
  copy still in `auth.json` — **breaking the user's own `codex` CLI**, the very tool we depend on for
  credentials. That also kills the otherwise-clean in-memory-only variant. Writing the new token back
  avoids the invalidation but breaks the never-writes promise and races the CLI on the same file.
  Whether those tokens rotate **cannot be safely determined while the endpoint is circuit-broken**
  (`OQ-001`), and guessing wrong breaks a user's CLI — so (a) is gated on OQ-001 clearing.
  Relates: WU-0003, OQ-001.

- **OQ-005** (🟢 minor robustness; surfaced 2026-07-25 while verifying OQ-002) — **`readCodexAuth` does a
  synchronous `readFileSync` on the request path**, once per Codex-routed request. `node-ts-rules.md`
  says don't do sync I/O on a request path where the async API exists. It is small and it buys the
  free-refresh-pickup behaviour above, so it is a real trade rather than a plain defect. **Resolve:**
  either accept and document the trade, or move to an async read with a short TTL cache — noting a
  cache would *weaken* the pick-up-a-refreshed-token-immediately property. Relates: WU-0003, OQ-002.

- **OQ-003** (🟠 leak/ergonomics; surfaced 2026-07-25 by the operator asking whether anything was
  machine-specific) — **`CLAUDE.md` is committed to the PUBLIC repo carrying machine-specific partyline
  paths** (`/home/v3ct0r/rooms/crates`, an absolute local binary path) plus instructions telling a
  *contributor's* Claude that it is "agent modelmux" and should arm a monitor on a room that does not
  exist for them. Not secret, but useless-to-wrong for everyone else. **Resolve:** operator's call —
  gitignore `CLAUDE.md` (loses the useful kit constitution too), commit it without the partyline block
  (which `partyline wire` will re-add locally), or accept it. Left untouched deliberately: that marker
  block is managed by `partyline wire` and editing it risks desyncing the fleet wiring.

- **OQ-004** (🟡 verification depth; surfaced 2026-07-25) — **The Responses adapter has never run
  against a real Responses backend.** It is spec-derived and unit-tested; the Chat Completions adapter
  by contrast was field-tested end-to-end against local Ollama including the full tool loop. Ollama
  does not speak Responses, so there is no local rig. **Resolve:** field-test against Codex once
  OQ-001 clears, or find another Responses-speaking endpoint. Relates: WU-0003.

## Recently resolved

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
  had expired. Hypothesis eliminated; see OQ-001 for what remains unproven.
