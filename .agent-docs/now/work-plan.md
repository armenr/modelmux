---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-26
tags: [current, work-plan, decisions]
related: [status, open-questions, obligations]
---

# Work plan — modelmux

## Immediate next

> **🎯 CURRENT — triage PR #19 (dependabot). DO NOT MERGE AS-IS.**
>
> It groups a **MAJOR TypeScript bump** (`^6.0.3` → `^7.0.2`) into a routine `dev-deps` group, and CI
> fails with an unambiguous incompatibility:
>
> ```
> Error: typescript-eslint does not support TS 7.0.
> ```
>
> Merging it **disarms `lint` AND `typecheck` at once** — exactly the looks-live-but-isn't gate class
> this repo spent 2026-07-25 fixing. The group also carries `eslint-plugin-unicorn ^68 → ^72`,
> another major.
>
> **Do:** split the group — take `@antfu/eslint-config` (9.1→9.2), `@commitlint/cli` (21.2.0→21.2.1)
> and `eslint` (10.6→10.8); **hold `typescript`** until typescript-eslint supports 7.x. Then add a
> `dependabot.yml` `ignore` rule for `typescript` majors so this does not re-open weekly.
> **Verify after:** `bun run check` must pass locally before pushing — CI proved the failure, but the
> split is what needs confirming.
>
> **THEN, pick one — both are small and independent:**
> - **`OQ-010`** (cheap, high leverage) — splice a repo-local fragment into
>   `.claude/hooks/pretooluse-safety-gates.sh` at its documented insertion point so `pkill -f` and
>   `partyline read`-in-a-pipeline are gated rather than merely documented. This is the work item
>   `LP-005`'s acceptance bought; each rule owes a non-vacuous control (`LP-003`).
> - **`OQ-008` remainder** — extend `check-latest` to probe per-provider (Anthropic via the Models
>   API; Codex via the on-disk `~/.codex/models_cache.json`, no network). The date-column half
>   shipped in v0.5.1; run-time probing is genuine feature scope and wants its own branch.
>
> **Do NOT:** merge #19 unsplit · redeem the Codex refresh token to learn whether it rotates (the test
> IS the dangerous act — it would break the operator's `codex` CLI) · patch kit-owned files to clear
> the doc-lint suppression (fieldbook owns that; it arrives on upgrade).

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
