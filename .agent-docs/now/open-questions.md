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

- **OQ-003** (🟠 leak/ergonomics; surfaced 2026-07-25 by the operator asking whether anything was
  machine-specific) — **`CLAUDE.md` is committed to the PUBLIC repo carrying machine-specific partyline
  paths** (`/home/v3ct0r/rooms/crates`, an absolute local binary path) plus instructions telling a
  *contributor's* Claude that it is "agent modelmux" and should arm a monitor on a room that does not
  exist for them. Not secret, but useless-to-wrong for everyone else. **Resolve:** operator's call —
  gitignore `CLAUDE.md` (loses the useful kit constitution too), commit it without the partyline block
  (which `partyline wire` will re-add locally), or accept it. Left untouched deliberately: that marker
  block is managed by `partyline wire` and editing it risks desyncing the fleet wiring.

## Recently resolved

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
