---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-07-25
last-modified: 2026-07-25
work-unit: WU-0003
supersedes: [ADR-0002]
superseded-by: null
related: [ADR-0002]
tags: [upstreams, wire-formats, subscriptions, codex, scope, self-containment]
---

# ADR-0003 — modelmux speaks OpenAI wire formats natively, and Codex ships as a built-in

> **Provenance note, stated up front because it matters for how much to trust this record.** The
> standing rule is that an ADR's alternatives are authored *before* the work. This one was not: the
> decision was made in conversation, the code was written, and this record was reconstructed
> afterwards. The Context and the operator's reversal are verbatim; the Alternatives are honestly
> reconstructed and Option B in particular was weighed live, but a reader should treat this as a
> *record of* a decision rather than the artifact that *made* it. The lapse is the reason ADR-0002 sat
> contradicted by shipped code for a full work cycle.

## Context

`ADR-0002` decided that GPT/Codex would be supported as a **documented user-run shim** (LiteLLM in
front, no built-in, no translator in this tree). That decision is superseded here.

Two things changed, and only one of them is "the operator said so".

**First, the premise was challenged and the challenge was correct.** The operator asked:

> *"modelmux is fully self-contained — a single binary that takes care of everything for you. So are
> we not expecting users to have a second tool up and running to daisy-chain with our modelmux?"*

We were. And not only for Codex — the README already told users to front **LM Studio, llama.cpp and
vLLM** with LiteLLM, because those speak the OpenAI format and every modelmux upstream spoke Anthropic
Messages. ADR-0002 cited that existing advice as *precedent* for the Codex shim ("it needs no new
mechanism, only a section"). It was better read as evidence that the single-binary promise was already
broken in the most common case, and that ADR-0002 had generalized a defect into a pattern.

**Second, that reframed the question.** ADR-0002 asked *"should we build a Codex translator?"* — for
which the honest answer was no. The real question is *"which wire formats must a self-contained proxy
speak?"* Answering it for local runners (Chat Completions) and for Codex (Responses) is the same body
of work, and the local-runner half is justified with no reference to Codex at all. Once that adapter
exists, Codex costs an **auth mode**, not a subsystem. The cost that dominated ADR-0002's reasoning
was already being paid for other reasons.

**Third, the operator reversed the call explicitly**, having seen the increments laid out with their
costs: *"I want increment 2+3 as well."* That is the authority for the built-in; the paragraphs above
are the reasoning that made it a coherent thing to ask for rather than an override of a live objection.

## Alternatives Considered

- **Option A — hold ADR-0002; ship the Chat Completions adapter for local runners only, leave Codex to
  LiteLLM.** Genuinely defensible, and it is the option that changes least: it fixes the actual
  single-binary defect (local runners) while leaving the terms-ambiguous, undocumented-endpoint case
  outside our tree, exactly where ADR-0002 wanted it. Its axis — *don't assert stability or sanction we
  can't stand behind* — is untouched by anything above; OpenAI's endpoint is no more documented today
  than it was yesterday. Rejected because the operator reversed the call on explicit request, and
  because the marginal artifact is small and honest: a Responses adapter written from OpenAI's own
  published spec, plus an auth mode that reads a file another tool wrote.

- **Option B (the runner-up) — ship the Responses adapter and the `codex` auth kind, but NO built-in
  entry.** Users would declare it themselves:
  `codex = { base = "…", auth = "codex", format = "responses" }`. Strong, and it very nearly won: it
  removes the second process (the actual complaint) while keeping ADR-0002's axis fully intact, because
  the user types the endpoint themselves and thereby *makes the assertion themselves*. Nothing in our
  defaults table would claim the path is sanctioned. Rejected on the deciding axis below: the base URL
  is precisely the part a user cannot discover — it is undocumented, so they would copy it from a blog
  post or from us anyway. Withholding five lines of config does not transfer a judgment to the user; it
  just makes the feature undiscoverable while shipping every line of code that carries the risk. The
  assertion is carried by what the README *says*, not by whether a default exists.

- **Option C — spawn or proxy the user's local `codex` CLI.** Rejected immediately: it reintroduces the
  second running process that this entire increment exists to remove, and adds process-lifecycle
  management to a proxy that currently has none.

- **Chosen — speak Chat Completions and Responses natively, and ship `codex` as a built-in whose
  non-promises are stated in prose.** Defended in Decision.

**Deciding axis:** *when we cannot vouch for something, is the honest instrument omission or plain
words?* ADR-0002 answered **omission** — don't ship it, and the absence carries the caveat. That works
only when the absence is legible; here it is not, because the endpoint is undiscoverable and the
capability is real, so omission reads as "unsupported" (a cost ADR-0002 named itself) while doing
nothing to stop a determined user. This ADR answers **plain words**: ship it, and say in the code
comment and the README exactly what it does not promise — the endpoint is undocumented and can change
without notice, and whether subscription use suits your account is a terms question only the account
holder can answer.

**Axis check.** Option B fails the same axis from the other direction: it is omission wearing
config's clothes — the risk ships, the caveat does not. Option A passes the axis cleanly and loses on a
different one (the operator's call, plus the already-paid cost). Worth being explicit that ADR-0002's
axis was *not* refuted; it was outranked once the translator stopped being a Codex-specific expense.

**Flip-condition — pull the built-in back to a documented `[upstreams]` recipe if ANY of:**
1. OpenAI signals that subscription credentials through a third-party client are out of bounds — a
   terms change, an enforcement action, or a technical block that fingerprints non-CLI clients.
   Anthropic enforced against this exact shape on their own plans in **January 2026**, so this is a
   live risk, not a theoretical one.
2. The Responses adapter's maintenance cost materializes as recurring breakage arriving on OpenAI's
   schedule and landing on users of a released binary. That is ADR-0002's Option-A objection, and it
   would be **evidence**, not a prediction — which is what it would take to reverse this.
3. The credential shape changes such that reading `~/.codex/auth.json` stops being a read-only,
   non-invasive act (see `OQ-002` — we already do not refresh).

Conversely, OpenAI publishing a documented, terms-clear endpoint would make all of this moot and move
Codex into the same box as `zai` and `kimi`. That was ADR-0002's flip-condition and it remains the
happy path.

## Decision

1. **`format` becomes a per-upstream declaration** — `"anthropic"` (default, and the untouched
   zero-cost forwarding path), `"openai"` (Chat Completions, `src/openai.ts`), `"responses"`
   (`src/responses.ts`). Existing upstreams are unaffected; no request that worked before takes a
   different code path.
2. **`codex` ships as a built-in upstream**: `https://chatgpt.com/backend-api/codex`,
   `format = "responses"`, `auth = { kind: "codex" }`.
3. **The `codex` auth kind READS the credentials `codex login` already wrote** — `access_token` and
   `account_id` from `~/.codex/auth.json` (honoring `CODEX_HOME`), sent as `Authorization: Bearer …`
   plus the load-bearing `ChatGPT-Account-ID` header. modelmux **never performs the login and never
   writes that file**: one subscription, one credential store, owned by the tool that obtained it.
   A missing or malformed store throws a typed `CodexAuthError` naming the path and the fix, rather
   than sending an unauthenticated request and surfacing the provider's 401.
4. **The README's "run LiteLLM in front" advice is demoted to a fallback** for the OpenAI-format
   runners it was written for, since they are now natively supported.
5. **`maxTokensField` is an explicit per-upstream declaration with no default-by-inference.** Newer
   OpenAI models reject `max_tokens` in favor of `max_completion_tokens`, while local runners'
   support for the latter is uneven — so there is no safe guess, and guessing wrong fails at request
   time on someone else's machine.

## Consequences

**Good.** The single-binary promise is now true for the common case: local OpenAI-format runners work
with no second process, which is a strictly larger population than Codex users. Codex subscribers get
a zero-config path. The `format` dispatch is additive — `"anthropic"` upstreams keep the untouched fast
path, so the blast radius of this ADR on existing users is zero.

**Method note worth keeping.** The operator asked whether the adapters were written from confirmed spec
or from memory. They were memory plus one secondary source. Checking the **primary** specs then caught
**three real defects**, each of which now has a test that fails against the memory version:
- `stream_options: {include_usage: true}` was missing — Chat Completions omits usage from streams
  unless asked, so Anthropic's `message_delta.output_tokens` would have been *structurally always
  zero*. The stream would look perfect and the numbers would be lies.
- Usage was read *after* the `choices[0]` guard, but the usage-bearing chunk arrives with an **empty**
  `choices` array — so the count was dropped even once requested.
- `max_tokens` is rejected by newer models (hence point 5 above).

**Costs, named.**
- **Acceptance is UNVERIFIED** (`OQ-001`). Every Codex call returns `503 circuit_open`, and a breaker
  can fire *before* auth is evaluated — so a green build proves nothing about whether the header pair
  is accepted. Only a 200 or a 401 settles it. Control established: OpenAI's own `codex` CLI fails
  identically on the same endpoint, so the fault is theirs.
- **No refresh path** (`OQ-002`). We read the token and never renew it; the current one expires
  **2026-07-28**. After that, Codex requests fail with no recovery from inside modelmux.
- **The Responses adapter has never run against a real Responses backend** (`OQ-004`). It is
  spec-derived and unit-tested, where the Chat Completions adapter was field-tested end-to-end against
  local Ollama including the full tool loop. Ollama does not speak Responses, so there is no local rig.
- **We now own a translator on a foundation we don't control** — the exact cost ADR-0002 named. It is
  accepted deliberately, and flip-condition 2 is the pre-written trigger for reversing it.

## Related

- `ADR-0002` — superseded by this record; read it for the reasoning that *held* until the premise moved.
- `ADR-0001` — the other routing decision from this cycle.
- `OQ-001`, `OQ-002`, `OQ-004` — the three named gaps above.
