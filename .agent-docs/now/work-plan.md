---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-29
tags: [current, work-plan, decisions]
related: [status, open-questions, obligations]
---

# Work plan — modelmux

## Immediate next

> **🎯 CURRENT — rule on `OQ-017`: anchor `TAG_RE` to its own line. A CONFIRMED defect in shipped
> routing semantics, reproduced firsthand, awaiting the operator because it is user-visible.**
>
> `src/signals.ts:3` is unanchored (`/<<route:([\w-]+)>>/i`, first-match-wins over the whole system
> text), so **any mention of a tag IS the tag** — including the sentence documenting it, and including
> a front-matter `description:`. Four failure modes reproduced against the live tree; the worst two:
> a prose mention placed *before* a real directive **overrides** it, and `mux use` rewrites the wrong
> occurrence while **printing success**, leaving a file that says one alias to a human and routes as
> another.
>
> **Recommended:** `/^[ \t]*<<route:([\w-]+)>>[ \t]*$/im` in `signals.ts` + both `cli.ts` sites.
> **Measured blast radius: zero** — all four shipped defs keep working; only the prose lines stop
> matching. Owes an ADR before implementation, then a falsifier per failure mode.
>
> **THEN, in order:**
> 1. **PR #19** — close it, don't split it. `@antfu/eslint-config` 9.1→9.2 drags
>    `eslint-plugin-unicorn ^68 → ^72` transitively, so the "safe three" aren't safe by inspection.
>    Add a `dependabot.yml` ignore for `typescript` majors. (`OQ-009`)
> 2. **`OQ-010`** — the gate fragment for `pkill -f` / `pgrep -af`, now known to be ONE defect class
>    (this harness embeds the whole command text in the wrapper's cmdline, so the bracket workaround
>    fails too). Liveness = read the lease PID, never grep ps.
> 3. **`OQ-008`** — per-provider `check-latest` probing. Still genuine feature scope.
>
> **Do NOT:** merge #19 unsplit · widen the tag scan without an explicit decision · re-point reviewers
> at `/api/paas/v4` (METERED — "Insufficient balance" on the Coding Plan key) · patch kit-owned files.

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
| Release `v0.6.0` | 🟡 PR #20 open and correctly versioned — merge when ready |

## Locked decisions (this cycle)

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
