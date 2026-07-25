---
entry_type: lesson
provenance: llm-reviewed
maturity: evergreen
status: active
severity: high
module: upstreams/wire-formats
type: engineering
created: 2026-07-25
last-modified: 2026-07-25
last-applied: 2026-07-25
related: []
tags: [lesson, wire-protocol, verification, external-api]
---

# LP-001 — The spec is the FLOOR, not the proof: probe the live endpoint before you believe your implementation

**Question.** When implementing against an external API contract, what counts as having got it right?

**Claim.** Writing against the published spec instead of from memory is **necessary and not
sufficient**. Memory-written protocol code is wrong in exactly the details you would recall
confidently; spec-written protocol code is wrong wherever the *deployment* diverges from the document.
Neither failure is visible to unit tests, because both produce code that is self-consistent. **The
implementation is not proven until a real request has come back from the real endpoint.**

**Evidence — two instances, escalating.**
1. *Memory → 3 defects.* The Chat Completions adapter was drafted from recall plus one secondary
   source and reviewed clean. Checking the **primary spec** (prompted by the operator asking "confirmed
   spec or just memory?") found three real defects: missing `stream_options.include_usage` (token counts
   *structurally* always zero), usage read after a `choices[0]` guard when the usage chunk carries an
   EMPTY `choices` array, and `max_tokens` rejected outright by newer models. `03bcc2e`.
2. *Spec → 5 defects.* The Responses adapter **was** written from OpenAI's published spec, had unit
   tests, and passed every gate — and would have returned `400` on **every single request**. The
   ChatGPT-subscription backend requires `store:false`, is **SSE-only**, requires non-empty
   `instructions`, and *rejects* `max_output_tokens`/`temperature`/`top_p` outright rather than
   ignoring them. It also emits `output: []` on its terminal `response.completed` event, so the
   obvious aggregation returns a structurally-valid **empty** message. None of it is in the spec,
   because the deployment is undocumented. Found only by curling the endpoint. `f49e3b6`.

**Trigger.** Implementing or reviewing code against an external wire format, SSE vocabulary, or auth
header set — *especially* one whose deployment is undocumented, vendor-specific, or subscription-gated.

**Failure mode.** Silent wrongness that ships. Every local signal is green: it compiles, it type-checks,
the tests pass, the review reads clean. The defect surfaces on someone else's machine, in production,
against the only system that could have revealed it.

**Mitigation.** Spec first — then **probe the live endpoint before you believe it**. One `curl` with the
real credential answers what no amount of local testing can. Where the constraint set is unknown, probe
the whole optional-field surface in **one batch** rather than discovering it one `400` at a time.

**Recurrence count:** 2 (2026-07-25, both on the same work-unit, the second *after* the first was fixed).
