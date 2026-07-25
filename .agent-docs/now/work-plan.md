---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-25
tags: [current, work-plan, decisions]
related: [status, open-questions, obligations]
---

# Work plan — modelmux

## Immediate next

> **✅ DONE — the three shipping inconsistencies are closed, and WU-0003 is committed.**
>
> 1. ✅ `ADR-0003` written and accepted; `ADR-0002` set `status: superseded` + `superseded-by`, with a
>    SUPERSEDED banner at its head; `decisions/index.md` row added in the same change (rule 13).
> 2. ✅ README fixed — and the scope was **larger than this plan recorded**. It listed one stale
>    section; reading found **five**: the Codex section, the local-runners "needs LiteLLM in front"
>    advice (falsified by the already-committed `03bcc2e`), the subscription table, missing
>    `KIMI_API_KEY`/`CODEX_HOME` config rows, and — the serious one — a **Security & scope claim that
>    the shipped code makes false** (it asserted modelmux "is not a tool for using a Claude/ChatGPT
>    *subscription* outside its official client"). Rewritten to state the real bright line and name the
>    grey area rather than soften it away.
> 3. ✅ PR #15 retitled: *"speak OpenAI wire formats natively — Chat Completions, Responses, and
>    flat-rate subscriptions"*.
>
> Commits: `7ef2d4c` (work) · `fd08a9a` (README) · docs commit pending. Gates green on true exit codes.

> **🎯 CURRENT — decide the Codex token-refresh fork (`OQ-002`), then push.**
>
> Verified this cycle: **Codex is the only upstream with an expiring credential** — the other four are
> passthrough or console-issued API keys. And modelmux re-reads `~/.codex/auth.json` **per request with
> no cache**, so a token refreshed by the `codex` CLI is picked up on the next call with no restart;
> the gap only bites a modelmux-only user. **Option (b)** — detect 401, fail loud with "re-run
> `codex login`" — is safe and correct regardless of how the rest resolves. **Option (a)** (redeem
> `refresh_token` ourselves) is **gated on `OQ-001`**: if OpenAI rotates refresh tokens, redeeming ours
> invalidates the copy in `auth.json` and **breaks the user's own `codex` CLI**, and that cannot be
> tested while the endpoint is circuit-broken.
>
> **Do NOT:** re-login to Codex (a valid token would be risked against a broken auth service); reopen
> the kit safety-gate enumeration (fieldbook closed it — file findings only); or patch kit-owned files
> to clear the doc-lint suppression (fieldbook owns that fix; it arrives on upgrade).

## The plan (phases / milestones)

| Phase | State |
|---|---|
| Fieldbook install + project memory | ✅ done, `fed34cb` |
| Untagged-agent routing gap (tag verb + startup notice) | ✅ shipped in `v0.4.0` |
| Flat-rate subscriptions (GLM, Kimi Code) | ✅ committed `764d0be` |
| Wire format: OpenAI Chat Completions | ✅ committed `03bcc2e`, field-tested |
| Wire format: OpenAI Responses + Codex auth | ✅ committed `7ef2d4c` |
| README / security-claim correction | ✅ committed `fd08a9a` |
| Codex acceptance verification | ⛔ blocked on OpenAI (not on us) — `OQ-001` |
| Codex refresh-token handling | ⬜ fork identified, (b) safe now / (a) gated on `OQ-001` — `OQ-002` |

## Locked decisions (this cycle)

- `format` is a per-upstream declaration; `"anthropic"` stays the default and the untouched fast path.
- No safe default for the token-cap field → explicit per-upstream `maxTokensField` (ADR pending in the
  Consequences of ADR-0003; newer OpenAI models reject `max_tokens`, local runners' support for
  `max_completion_tokens` is uneven).
- modelmux **reads** Codex credentials, never performs the login and never writes `auth.json`.
- Adapters are written **against published specs, not memory** — this caught three real defects
  (ADR-0003 §Consequences; see also `log.md` 2026-07-25).
- PR #15: retitle rather than split.

## Work-unit spine

| WU | Objective | Depends | Status |
|---|---|---|---|
| WU-0001 | Give the CLI a way to add a FIRST `<<route:>>` tag, so untagged third-party agents can be pinned instead of silently diverted by the `anySubagent` catch-all | — | ✅ WIRED (shipped v0.4.0) |
| WU-0002 | Support flat-rate coding subscriptions as first-class upstreams (GLM via Z.ai, Kimi K3 via Kimi Code); rule on GPT/Codex | — | ✅ WIRED |
| WU-0003 | Speak OpenAI wire formats natively (Chat Completions + Responses) and authenticate Codex from its own credential store, so no second process is needed | WU-0002 | 🟡 IMPL — Chat Completions WIRED + field-tested; Responses/Codex built, uncommitted, acceptance unverified |
