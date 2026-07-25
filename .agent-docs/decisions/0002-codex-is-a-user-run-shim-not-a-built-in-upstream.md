---
provenance: llm-reviewed
status: superseded
template-version: 1.0.0
created: 2026-07-25
last-modified: 2026-07-25
work-unit: WU-0002
supersedes: []
superseded-by: ADR-0003
related: [ADR-0003]
tags: [upstreams, subscriptions, codex, scope]
---

# ADR-0002 — Codex is supported as a user-run shim, not a built-in upstream

> **SUPERSEDED 2026-07-25 by `ADR-0003` — do not act on this record.** modelmux now speaks the OpenAI
> Chat Completions and Responses wire formats natively and ships a `codex` built-in. Read this ADR for
> the reasoning that *held*, not for current behaviour. The short version of what moved: this record
> cited the README's existing "front LM Studio/llama.cpp with LiteLLM" advice as *precedent* for a Codex
> shim, when it was better read as evidence that the single-binary promise was already broken for local
> runners. Fixing that pays for the Responses adapter on its own, after which Codex costs an auth mode
> rather than the subsystem this ADR rightly refused to build. The deciding axis below was not refuted —
> it was outranked.

## Context

A request came in for subscription-backed support for three things: GLM 5.2, GPT/Codex, and Kimi K3.
Verified against vendor primary docs rather than memory, they are three different problems:

- **GLM 5.2** — already worked. The `zai` built-in points at Z.ai's documented Anthropic endpoint and
  `glm-5.2` is current. Nothing to build; it was under-documented, not missing.
- **Kimi K3** — real work, and a clean fit. Kimi Code is a flat-rate plan at `api.kimi.com/coding`
  speaking Anthropic Messages, so it becomes a built-in with a bearer key like any other. (Note the trap
  it introduced: Moonshot *also* sells a metered API at a different host with different model ids —
  `k3` vs `kimi-k3` — and the keys are not interchangeable.)
- **GPT/Codex** — does not fit, and this ADR is about that.

Codex subscription access targets an **undocumented ChatGPT backend** speaking OpenAI's **Responses**
schema, authenticated by a ChatGPT session rather than an API key. Every upstream modelmux has is an
Anthropic **Messages** endpoint: the proxy swaps a header and a model id and forwards the body
unchanged. It performs no protocol translation anywhere, by design.

There is also a licensing question. OpenAI treats ChatGPT subscriptions and the API as separate
products; programmatic use of a subscription ranges from "endorsed for your own personal use" to
"against the terms" depending on the reading and the use, with pooling clearly out. Anthropic enforced
against the same shape on their own plans in January 2026, so this is a live area, not a theoretical one.

## Alternatives Considered

- **Option A — build a bidirectional Anthropic↔Responses translator in modelmux.** Rejected: it is the
  largest and most fragile subsystem in the repo (streaming SSE, tool calls, thinking blocks, error
  mapping) built on a foundation the vendor does not document and can change without notice. Every other
  upstream is ~6 lines of config; this one would be a permanent maintenance surface whose breakage
  arrives on someone else's schedule and lands on users of a released binary.
- **Option B (the runner-up) — ship a built-in `codex` upstream pointed at a community shim's default
  port.** Genuinely strong: zero-config for the user, matches the ergonomics of `zai` and `kimi`, and
  keeps the translator out of our tree — so it dodges the maintenance objection that killed Option A
  entirely. Rejected on the deciding axis: a built-in is an implicit assertion that the path is
  sanctioned and stable, and this one is neither. It would also hard-code a dependency on a third-party
  shim we do not control, version, or audit.
- **Option C — refuse to document Codex at all.** Rejected: the capability is real, the user asked for
  it, and staying silent doesn't stop anyone — it just means they wire it without the trade-offs in
  front of them. Declining to inform is not a safety measure.
- **Chosen — document the user-run shim pattern, ship no built-in.** Defended in Decision.

**Deciding axis:** *does shipping this assert something we cannot stand behind?* A built-in upstream is
a claim that the endpoint is stable and the usage is legitimate. That is what killed Option A (it asserts
stability on an undocumented backend) and Option B (it asserts sanction on a terms question that belongs
to the account holder).

**Axis check:** the chosen option is selected by that same criterion. Documenting the shim asserts only
what is true — that the pattern works, that the endpoint is undocumented, and that the terms question is
the reader's to resolve. It makes no claim we would have to retract. Option C fails the axis from the
other side: saying nothing implies there is nothing to know.

**Flip-condition:** OpenAI publishing a documented, terms-clear Anthropic-Messages-compatible endpoint
for subscription users. That single change moves Codex into exactly the same box as `zai` and `kimi` and
this ADR should be superseded, not amended. A supported OpenAI-format-to-Anthropic gateway that we did
not have to maintain would also reopen Option B.

## Prior art / reference

The repo already documents this exact shape for LM Studio / llama.cpp / vLLM: those speak the OpenAI
format, so the README tells users to front them with LiteLLM and point an `[upstreams]` entry at it.
Codex is the same pattern with a different shim — which is the argument that it needs no new mechanism,
only a section.

## Decision

Add `kimi` as a built-in upstream (Kimi Code subscription) alongside `zai`, and support Codex as a
documented `[upstreams]` entry pointing at a user-run translating shim. No `codex` built-in, no
translator in this tree. The README states plainly why: the schema mismatch, the undocumented endpoint,
and the terms question — and directs the reader to check the current terms for their own account rather
than inferring from our shipping decision.

Also landed under this WU: `normalizeBase` strips trailing slashes from upstream bases, because Kimi
Code's own docs publish theirs with one and `base + "/v1/messages"` would otherwise double the separator.

## Consequences

**Good.** Two of the three requests are now zero-config. Codex users have a working, documented path
today with no code change. The fragile, fast-moving, terms-ambiguous part lives in the user's local
setup where they control it, and this repo keeps its single forwarding shape.

**Costs, named.** Codex is second-class: more setup than an env var, and it depends on software we
don't ship. Someone skimming the subscription table will read the em-dash next to GPT/Codex as
"unsupported" and may stop there. And this decision is explicitly time-limited: it rests on a vendor's
current API surface and current terms, both of which can move, so it needs re-checking rather than
assuming.

## Amendment 2026-07-25 — the shim is LiteLLM, which weakens one stated cost

Written into the Consequences above was: *"the shim is a dependency we neither vet nor version — if it
breaks or goes unmaintained, users have no recourse from us."* That was drafted against the assumption
of a bespoke community proxy, and the operator's follow-up question ("is there something we can bolt
on?") turned up a better answer that I should have looked for before writing the cost.

**LiteLLM does both halves natively**: OAuth device-code authentication against a ChatGPT subscription,
and an Anthropic-compatible `/v1/messages` endpoint with streaming and tool calls. It is a mature,
actively maintained gateway — and it is *already* the shim this repo's README recommends for LM Studio
and llama.cpp, so for a chunk of users it is not a new dependency at all. It also strips the fields the
subscription backend rejects (`max_tokens`, metadata) on its own.

So the unmaintained-dependency cost is materially weaker than stated, and the README now gives a
concrete recipe rather than pointing vaguely at "community shims".

**The decision does not change, and it is worth being explicit about why**, since a weakened cost is
exactly the kind of thing that should be re-examined rather than waved through: the deciding axis was
never dependency quality. It was that a built-in asserts stability and sanction we cannot stand behind.
LiteLLM being excellent does not make OpenAI's endpoint documented, and does not resolve the terms
question for anyone's account. Option B (a built-in pointed at a shim's default port) is now *more*
tempting and still fails the same axis for the same reason.

## Related

- `ADR-0001` — the other routing decision from the same session.
