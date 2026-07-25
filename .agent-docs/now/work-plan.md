---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-25
tags: [current, work-plan, decisions]
related: [status, open-questions, obligations]
---

# Work plan — modelmux

## Immediate next

> **🎯 CURRENT — PR #15 is ready to merge. That is the next real decision, and it is the operator's.**
>
> 21 commits ahead of `main`, CI green, mergeable, working tree clean. Contents: **3 `feat` + 2 `fix`**,
> so release-please would cut **v0.5.0** on merge and build the 5 cross-compiled binaries.
>
> Everything that was open is closed: WU-0003 shipped and field-tested, **all six OQs resolved**, the
> model lists verified against primary sources, and the pre-commit gate armed and proven by a
> deliberate failure. No operator gate remains in `obligations.md`.
>
> **Two cheap things that do NOT block the merge:**
> 1. Adjudicate the three staged lessons in `now/lessons/proposals.md` (`LP-001..003`) — accept / defer /
>    reject. All three were reinforced hard by this session; `LP-001` also needs an amendment (see below).
> 2. `LP-001` says "implement from the primary spec, not memory". Today proved that is **necessary but
>    not sufficient**: the Responses adapter WAS spec-derived and still shipped five defects, because
>    the ChatGPT-subscription backend is undocumented and diverges from the published Responses spec.
>    The stronger claim is *spec first, then a live probe before you believe it*.
>
> **Do NOT:** redeem the Codex refresh token to find out whether it rotates (the test IS the dangerous
> act — it would break the operator's `codex` CLI); reopen the kit safety-gate enumeration; or patch
> kit-owned files to clear the doc-lint suppression (fieldbook owns that fix, it arrives on upgrade).

## The plan (phases / milestones)

| Phase | State |
|---|---|
| Fieldbook install + project memory | ✅ done, `fed34cb` |
| Untagged-agent routing gap (tag verb + startup notice) | ✅ shipped in `v0.4.0` |
| Flat-rate subscriptions (GLM, Kimi Code) | ✅ committed `764d0be` |
| Wire format: OpenAI Chat Completions | ✅ committed `03bcc2e`, field-tested |
| Wire format: OpenAI Responses + Codex auth | ✅ committed `7ef2d4c` |
| README / security-claim correction | ✅ committed `fd08a9a` |
| Codex acceptance verification | ✅ RESOLVED — auth accepted, field-tested live (`OQ-001`/`OQ-004`) |
| Codex refresh-token handling | ✅ fail-loud-on-401 shipped (`OQ-002`); renewal deliberately not done |

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
| WU-0003 | Speak OpenAI wire formats natively (Chat Completions + Responses) and authenticate Codex from its own credential store, so no second process is needed | WU-0002 | ✅ **WIRED** — both adapters committed and field-tested end-to-end against live backends; leg proven from `decisions.jsonl` |
