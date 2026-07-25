---
entry_type: lesson
provenance: llm-reviewed
maturity: budding
status: active
severity: high
module: routing/testing
type: engineering
created: 2026-07-25
last-modified: 2026-07-25
last-applied: 2026-07-25
related: []
tags: [lesson, testing, routing, false-confidence]
---

# LP-002 — An end-to-end test must prove WHICH backend answered, not just that a reply arrived

**Question.** What does a green end-to-end test through a router actually establish?

**Claim.** Assert the **routing leg**, not the response shape. Anything with a fall-through default can
serve a perfectly-shaped, entirely green result that exercises none of the code under test — and can
spend real money doing it. A test that cannot distinguish "my new upstream worked" from "the default
caught it" has verified nothing.

**Evidence.**
- *The failure.* The first Ollama field test used `routes = []`, which is **not** "no routing" — it
  falls through to `anthropic:passthrough`. It hit the **real Anthropic API** and "passed". Caught only
  by noticing Anthropic-only fields (`cache_creation_input_tokens`, `service_tier`, `inference_geo`) in
  a reply that was supposed to have come from a local model.
- *The mitigation, applied.* Every later field test used a `routes.toml` with **no `anthropic` alias at
  all**, so a mis-wire cannot silently succeed, and asserted the leg from `decisions.jsonl` afterwards.
  The live Codex verification reports **6/6 `upstream=codex`, zero anthropic** — that count, not the
  200s, is what makes it evidence.

**Trigger.** Any end-to-end test through a proxy, router, gateway, or feature flag — anything with a
fall-through, a default, or a fallback.

**Failure mode.** False confidence plus unintended billing, and the "passing" test actively conceals
the fact that the new path was never exercised.

**Mitigation.** Two moves, both cheap: (1) build the test config so the fall-through target **does not
exist** — a mis-wire must fail loudly rather than succeed quietly; (2) assert the leg from the router's
own decision log, not from the response body.

**Recurrence count:** 1 failure (2026-07-25) + 1 successful application the same day.
