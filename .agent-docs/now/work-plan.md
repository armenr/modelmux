---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-04
tags: [current, work-plan, decisions]
related: [status, open-questions, obligations]
---

# Work plan — modelmux

## Immediate next

> **🎯 CURRENT — two OPERATOR decisions, neither technical, both blocking nothing else.**
>
> **1. The release version.** PR **#20** is `chore(main): release 1.0.0` — release-please bumped to
> MAJOR off the `!` breaking change in `e29f344`. **Recommendation: set `bump-minor-pre-major: true`
> in `.github/workflows/release.yml` and cut `0.6.0` instead.** The repo's own locked decision is
> that *a release's version must match its user-facing reality* (it is why PR #17 was retitled). A
> `1.0.0` announces a stable API; three confirmed defects were fixed in this tree on 07-30 and five
> OQs remain open. **NOT applied unilaterally — a version is a public commitment.**
>
> **2. The independent review fan-out.** ~5 agents, diverse lenses, over the 07-30 code commits
> (`38cd513` `bf45c30` `e29f344` `f9f466e` `d989d29`). **Zero independent review has happened on any
> of it.** Every non-vacuity proof was run by the author, which is exactly the separation the standing
> rules forbid collapsing. This is the largest outstanding risk in the tree — larger than any open OQ.
> It is >3 concurrent agents, so it needs an explicit ask, and this is that ask.
>
> **THEN, in order:**
> 1. **`OQ-010`** — the safety-gate fragment. `pkill -f` self-killed a shell for the **third** time on
>    07-30, mid-cleanup, in the same session that re-read the trap. `LP-005` says a second firing buys
>    a mechanism; this is the third. Additive fragment at the documented insertion point in
>    `.claude/hooks/pretooluse-safety-gates.sh`; owes a non-vacuous control (write the foot-gun, watch
>    the gate fire, restore).
> 2. **`OQ-008` (Codex half is now cheap)** — `~/.codex/models_cache.json` is on disk, needs no
>    network and no key, and carries real slugs + `supported_in_api`. That is a concrete first
>    increment of per-provider `check-latest` probing.
> 3. **PR #19 / `OQ-009`** — close it, don't split. `@antfu/eslint-config` 9.1→9.2 drags
>    `eslint-plugin-unicorn ^68 → ^72` transitively, so the "safe three" are not safe by inspection.
>    Add a `dependabot.yml` ignore for `typescript` majors.
> 4. **`OQ-012`** — confirm a NEW agent type appears after a restart (the pool-spawn-vs-claim
>    question). Cheap, but needs a new agent def + a session restart; it did not get tested in the
>    08-04 deploy because no def was added.
>
> **Do NOT:** merge #19 unsplit · re-point reviewers at `/api/paas/v4` (METERED) · set `minMaxTokens`
> on a codex upstream (config now refuses it, `OQ-019`) · patch kit-owned files · assume an inline
> `<<route:tag>>` still routes — `ADR-0004` made own-line mandatory and it is LIVE.


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
| Reachability oracle in CI (`OQ-007`) | ✅ shipped `v0.5.1` — knip + a population floor; found `forwardUrl` dead on first run |
| Release v0.5.0 · v0.5.1 | ✅ both cut, 5 binaries each, **artifact-verified** (downloaded, checksummed, run) |
| **Billing-redirect fix** (`39c5adc`) | ✅ passthrough never substitutes a metered key; 6 falsifiers + the inverted test |
| **GLM max-reasoning chain** (`a3bdbe7`, `66399b9`) | ✅ `extraBody` · `chatPath` · `minMaxTokens` · `reasoning_content`→`thinking`; live-verified end to end |
| systemd user unit + reboot survival | ✅ `modelmux.service` enabled, verified across a real reboot |
| **Fix batch** (`38cd513` `bf45c30` `e29f344` `f9f466e` `d989d29`) | ✅ shipped **and DEPLOYED** 2026-08-04; all four acceptances passed live |
| **`ADR-0004`** — `<<route:>>` must be alone on its own line | ✅ accepted + live (BREAKING; inline tags no longer route) |
| `docs/glm-direct-vs-proxied.md` — when NOT to use this proxy | ✅ shipped `7c2a529` + `4594231` |
| Release | 🔴 **CONTESTED** — PR #20 says `1.0.0`; recommendation is `0.6.0` via `bump-minor-pre-major`. Operator's call, unapplied |
| Independent review of the fix batch | 🔴 **NEVER RUN** — zero independent review on any of the 07-30 code |

## Locked decisions (this cycle)

- **A `<<route:>>` directive is the tag ALONE on its own line** (`ADR-0004`, `e29f344`). BREAKING for
  one shape: a def whose only match is prose now falls to `default`. Rejected: docs-only (the
  runner-up, zero compatibility surface — lost because `LP-005` says a second firing buys a
  mechanism, and it had fired in two independent trees).
- **Usage is recorded OUT OF BAND, never fabricated into `message_start`** (`OQ-015`, `d989d29`).
  Measured: the upstream sends no usage until stream close and `stream_options.include_usage` does
  not move it earlier, so wire parity is impossible without inventing a number — and the use case is
  cross-upstream comparison, where a plausible wrong number is worse than an obvious zero.
- **`minMaxTokens` is refused outright on a `codexSubscription` upstream** rather than silently
  ignored (`OQ-019`). Accepting a floor that cannot be honoured is the exact failure a floor exists
  to prevent.
- **The direct GLM path is documented as a legitimate ALTERNATIVE to this proxy**
  (`docs/glm-direct-vs-proxied.md`, `7c2a529`). Measured: `adaptive` thinking on `/api/anthropic`
  out-performs every explicit budget, so the proxy buys **control** (named effort levels,
  per-subagent routing, a decision log) — **not depth**. Saying so is more useful than implying the
  proxy is always the upgrade.
- `format` is a per-upstream declaration; `"anthropic"` stays the default and the untouched fast path.
- No safe default for the token-cap field → explicit per-upstream `maxTokensField` (ADR pending in the
  Consequences of ADR-0003; newer OpenAI models reject `max_tokens`, local runners' support for
  `max_completion_tokens` is uneven).
- modelmux **reads** Codex credentials, never performs the login and never writes `auth.json`.
- Adapters are written **against published specs, not memory** — this caught three real defects
  (ADR-0003 §Consequences; see also `log.md` 2026-07-25).
- PR #15: retitle rather than split.
- **A release's version must match its user-facing reality.** PR #17 was retitled `feat(` → `fix(`
  before merge because its diff had **zero** user-visible behaviour change; it cut `v0.5.1`, not
  `v0.6.0`. A minor bump advertises a feature that does not exist.
- Tests are **not** reachability entrypoints — admitting them makes the oracle report clean forever.
- **`passthrough` means passthrough — it never substitutes a credential.** No inbound auth sends NO
  auth, so the upstream 401s loudly rather than billing someone silently. Key auth against Anthropic is
  opt-in (`auth = "bearer:ANTHROPIC_API_KEY"`). Reversal of the prior "prefer env key" behaviour, which
  a test had specified.
- **`extraBody` overwrites; `minMaxTokens` raises.** Two mechanisms on purpose: imposing
  `reasoning_effort` needs an override, imposing a token floor must never clamp a generous caller.
- **A machine-local fact goes in the gitignored settings layer**, never a tracked one — and the
  tracking status of the target file is checked BEFORE editing another repo's config.
- **A trap's SECOND firing buys a mechanism, not a re-wording** (`LP-005`, accepted evergreen
  2026-07-27). Docs are the correct first response; once a documented trap fires again, the doc is
  disproven evidence and the remedy moves to the operative surface — or the recurrence is recorded
  as a measured deferral. Applied to itself: acceptance shipped `OQ-010`, not a note-to-self.

## Work-unit spine

| WU | Objective | Depends | Status |
|---|---|---|---|
| WU-0001 | Give the CLI a way to add a FIRST `<<route:>>` tag, so untagged third-party agents can be pinned instead of silently diverted by the `anySubagent` catch-all | — | ✅ WIRED (shipped v0.4.0) |
| WU-0002 | Support flat-rate coding subscriptions as first-class upstreams (GLM via Z.ai, Kimi K3 via Kimi Code); rule on GPT/Codex | — | ✅ WIRED |
| WU-0003 | Speak OpenAI wire formats natively (Chat Completions + Responses) and authenticate Codex from its own credential store, so no second process is needed | WU-0002 | ✅ **WIRED** — both adapters committed and field-tested end-to-end against live backends; leg proven from `decisions.jsonl` |
