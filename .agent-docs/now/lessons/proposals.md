---
provenance: llm-draft
created: 2026-07-03
last-modified: 2026-07-25
tags: [current, lessons, proposals, staging]
related: [MOC, ../../lessons/index]
---

# Lessons proposals — staging for human-gated promotion

The **staging area** for candidate lessons before they enter the ledger. The distillation pass appends
0–3 qualifying candidates here (`provenance: llm-draft`, `maturity: seedling`); `/handoff` walks each
one with the operator (**accept / defer / reject**). This file is the dedup baseline for the
distillation pass. **Nothing here is a lesson yet** — promotion to `../../lessons/<id>.md` is
human-gated.

> **Why a staging gate.** Same-model self-reflection collapses to confirmation bias without a human
> gate. "0 high-quality proposals" beats "3 weak ones" — a candidate that doesn't meet all four bars
> (concrete trigger · stable claim · evidence link · not-duplicate) is dropped, not padded.

## Staged candidates

<!-- New candidates appended below as fenced lesson stubs (provenance: llm-draft, maturity: seedling). -->

### LP-001 (seedling · llm-draft · 2026-07-25) — Implement wire protocols from the primary spec, never from memory

- **Trigger:** implementing or reviewing code against an EXTERNAL API contract — a wire format, an SSE
  event vocabulary, an auth header set.
- **Claim:** write it against the published spec or the vendor's own SDK types, not from recall. The
  defects concentrate precisely in the details you would recall confidently, so a from-memory version
  looks correct and reviews clean.
- **Evidence:** the Chat Completions adapter was drafted from memory + one secondary source and looked
  right. Checking the primary spec (prompted by the operator asking "confirmed spec or just memory?")
  found three real defects: missing `stream_options.include_usage` (token counts structurally always
  zero), reading usage after a `choices[0]` guard when the usage chunk carries an EMPTY choices array,
  and `max_tokens` being rejected outright by newer models. Each now has a test that fails against the
  memory version. `03bcc2e`.
- **Severity:** high — silent wrongness, shipped.

### LP-002 (seedling · llm-draft · 2026-07-25) — An end-to-end test must prove WHICH backend answered

- **Trigger:** any end-to-end test through a router, proxy, or anything with a fall-through default.
- **Claim:** assert the routing leg, not just that the response looks right. A config that falls through
  to a default produces a perfectly-shaped green result that proves nothing about the code under test —
  and can spend real money doing it.
- **Evidence:** the first Ollama field test used `routes = []`, fell through to `anthropic:passthrough`,
  and hit the REAL Anthropic API. It "passed". Caught only by noticing Anthropic-only fields
  (`cache_creation_input_tokens`, `service_tier`, `inference_geo`) in the reply. Fixed by writing a test
  config with NO anthropic alias at all, so a mis-wiring cannot silently succeed.
- **Severity:** high — false confidence plus unintended billing.

### LP-003 (seedling · llm-draft · 2026-07-25) — Red-test the test, not just the code

- **Trigger:** writing a test whose name asserts a specific property ("...uses the real signal path",
  "...is placed in the body").
- **Claim:** run it against the plausible WRONG implementation before trusting it. A test can pass for
  reasons unrelated to the property it claims to check, and its name then actively misleads.
- **Evidence:** a test named "a tag inserted by tagAgent is the one the router actually extracts" fed
  `extractSignals` the whole file INCLUDING front matter, so it could not detect a tag written into the
  front matter — the exact defect it existed to catch. Only the deliberate red-test exposed it; fixing
  the test took the falsifier count from 1 to 3.
- **Severity:** medium — a test that cannot fail is a decoration.
