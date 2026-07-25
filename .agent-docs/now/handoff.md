---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-25
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-07-25) · 🎯 WU-0003: speak OpenAI wire formats natively

## Project in one paragraph

modelmux is a local proxy that sits between Claude Code and model providers and routes **per-subagent**:
the orchestrator stays on Claude while named subagents divert elsewhere, driven by a `routes.toml`
cascade. It ships as a **single self-contained binary** — that self-containment is the product promise,
and it is what drove this session's work. Branch `feat/subscription-upstreams`, PR **#15 open**, CI
green, 3 commits ahead of `main` (which sits at `cd4ac71`, release **v0.4.0**).

## Current state summary

modelmux now speaks **three wire formats**. `format = "anthropic"` is the default and the untouched
fast path; `"openai"` (Chat Completions) is committed and field-tested; `"responses"` plus a `codex`
auth mode are **built, green, and UNCOMMITTED**.

| Increment | State |
|---|---|
| GLM / Kimi Code subscriptions | ✅ committed `764d0be` |
| 1 — Chat Completions adapter | ✅ committed `03bcc2e`, field-tested against Ollama |
| 2 — Responses adapter | 🟡 built + unit-tested, **uncommitted** |
| 3 — Codex auth (reads `~/.codex/auth.json`) | 🟡 built + unit-tested, **uncommitted**, acceptance UNVERIFIED (`OQ-001`) |
| Cleanup (ADR-0003 · README · PR title) | 🔴 **the next action** |

Gates: `lint` ✅ · `typecheck` ✅ · `bun test test/` ✅ **137 pass** · `build` ✅ · doc-lint ✅ 36 files ·
index-lint ✅.

## Important context

- **The uncommitted work is coherent** — commit `src/responses.ts`, `test/codexauth.test.ts` and the
  six modified `src/*.ts` as ONE work commit; commit the `.agent-docs/` doc edits SEPARATELY.
- Decisions and their reasoning live in `ADR-0001` (tag verb), `ADR-0002` (**now contradicted — see
  traps**), `memories/installed-safety-gate-does-not-protect-this-repo.md`, and
  `memories/the-proxy-is-not-running-on-the-development-machine.md`. Reference by ID; don't re-derive.
- `reference/fieldbook-install-reconstitution.md` says what regenerates vs what is irreplaceable.
- Room protocol: fieldbook **closed** the kit safety-gate enumeration — file findings, do not reopen.

## ⚠️ Anti-assumptions / traps

1. **`routes = []` does NOT mean "no routing" — it falls through to the default and can hit the REAL
   Anthropic API.** The first field test did exactly this and "passed" while proving nothing (and spent
   money). Detected only via Anthropic-only reply fields (`cache_creation_input_tokens`, `service_tier`,
   `inference_geo`). **Always** field-test with a `routes.toml` containing **no anthropic alias at all**.
2. **A green `bun test` does not mean the gates ran.** Without `node_modules`, `bun run lint` and
   `bun run typecheck` exit **127** while `bun test` still passes. Run `bun install --frozen-lockfile`
   first; a partial green looks identical to a full one.
3. **ADR-0002 (`status: accepted`) is contradicted by shipped code.** It decided Codex must NOT be a
   built-in; the operator reversed that and a `codex` built-in now exists. `src/upstreams.ts:49` also
   cites **ADR-0003, which does not exist**. Do not trust ADR-0002 as current until superseded.
4. **`pkill -f <pattern>` kills your own shell here** (exit 144) because the harness wrapper embeds the
   command string. Kill by PID: `ss -ltnp | grep :<port> | grep -oP 'pid=\K[0-9]+'`.
5. **zsh does NOT word-split unquoted parameters.** `git reset -- $PATHS` silently no-ops and the files
   stay staged. Pass paths as explicit arguments; verify staging afterwards.
6. **The Codex 503s are NOT our bug and NOT an expired token.** `access_token` is valid to 2026-07-28;
   only the `id_token` (identity claims, unused for API auth) expired. OpenAI's own `codex` CLI fails
   identically on the same endpoint. Their status page claims 99.98% and no incident — **the dashboard
   is wrong; trust the four measurements.**
7. **Do NOT re-login to Codex.** `codex login status` reports still logged in; their auth page throws
   `primaryapi_server_error`. Re-authing risks a valid token against a broken auth service for no gain.
8. **This repo's own agents are all tagged.** The `anySubagent` diversion exposure is *third-party*
   agents only — do not "fix" the local ones.
9. **The kit's PreToolUse safety gate does not protect this repo** — see the memory. Treat destructive
   safety here as discipline plus git history.
10. **The proxy is not running on this machine.** Routing config is specification, not observation —
    see `memories/the-proxy-is-not-running-on-the-development-machine.md`.

## Detour-chain

**MAIN:** add subscription support for GLM 5.2, GPT/Codex, Kimi K3.
→ *side-quest:* GLM already worked; Kimi needed a built-in; **Codex didn't fit the architecture** →
  ADR-0002 ruled it a user-run LiteLLM shim. **Resolved.**
→ *side-quest:* operator challenged the shim as contradicting the single-binary promise → reframed as
  "which wire formats must modelmux speak?" → three increments. **Resolved, and it reversed ADR-0002.**
→ *side-quest:* operator asked "confirmed spec or memory?" → primary-spec check found **three real
  defects**. **Resolved**, each with a falsifying test.
→ *side-quest:* operator asked about cross-platform safety → audit found 3 hardcoded `/` joins (fixed)
  **and** machine paths committed to the PUBLIC repo. **Open — `OQ-003`.**
→ *side-quest:* Codex field test → 503 circuit-open → control test via OpenAI's own CLI proves it is
  theirs. **Blocked externally — `OQ-001`.**
→ *parallel thread:* partyline/fieldbook room work (kit safety-gate defects, lint rule-21). **Closed
  upstream; filing only.**

## Immediate next steps

**Step 0 — cleanup, before any new feature work.** Three inconsistencies are *currently shipping*:

1. Write **ADR-0003** superseding ADR-0002: record that the operator reversed the call on explicit
   request, and what the built-in still does NOT promise (undocumented endpoint; terms belong to the
   account holder). Set ADR-0002 `status: superseded` + `superseded-by`, and add the
   `decisions/index.md` row **in the same change** (rule 13).
2. Fix `README.md` ~260–295 — it still tells users to run LiteLLM for Codex; a native `codex` upstream
   now ships. Demote the LiteLLM recipe to the fallback it now is.
3. `gh pr edit 15 --title ...` — retitle to reflect wire formats. **Decision taken: retitle, do not
   split.**

**Step 1 —** commit WU-0003 (work) and the doc edits (docs) as **separate** commits; push; CI.
**Step 2 —** `OQ-002` refresh-token handling.
**Step 3 —** retry `OQ-001` when OpenAI recovers.

**RECIPE — field-testing an OpenAI-format upstream (verbatim, reusable):**

```bash
# Ollama must be up on 127.0.0.1:11434. gemma4:31b is the ONLY local model here
# that emits tool calls; the small ones do not.
mkdir -p /tmp/mux-ft && cd /tmp/mux-ft
cat > routes.toml <<'TOML'
default = "local"          # NO anthropic alias: a mis-wire cannot fall through to the real API
longContextThreshold = 200000
routes = []
[models]
local = "ollama:gemma4:31b"
[upstreams]
ollama = { base = "http://127.0.0.1:11434", auth = "none", format = "openai" }
TOML
MUX_ROUTES=$PWD/routes.toml MUX_LOG=$PWD/decisions.jsonl PORT=8793 \
  nohup bun <repo>/src/server.ts > server.log 2>&1 &
# Verify the LEG, not just the reply: the response `model` must be the ROUTED slug,
# and decisions.jsonl must show ollama — not anthropic.
```

**VERIFY-AFTER for the Codex path:** a 503 `circuit_open` proves nothing about auth (the breaker can
fire before auth is evaluated). Only a **200 or a 401** settles `OQ-001`.

## Recent decisions made

| When | Decision | Ref |
|---|---|---|
| 2026-07-25 | Speak OpenAI formats natively rather than document a second process | `03bcc2e`, operator challenge |
| 2026-07-25 | Ship a `codex` built-in — **reverses ADR-0002** | operator: "I want increment 2+3 as well" |
| 2026-07-25 | modelmux READS Codex credentials; never logs in, never writes `auth.json` | `src/upstreams.ts` |
| 2026-07-25 | No safe default for the token-cap field → explicit `maxTokensField` | spec check |
| 2026-07-25 | Retitle PR #15 rather than split it | operator agreement |
| 2026-07-25 | `.claude/settings.json` becomes tracked so hooks travel with a clone | `fed34cb` |

## Room-threads

**Thread — Fieldbook kit defects (safety gate + lint rule 21).** Participants: `fieldbook` (coordinator,
operator-appointed; owns all fixes), `partyline`, `aegis`, `h00-sh`, `h00-dini`, `filemage-gen2`,
`fastcontext-probe`, `tfa`. **My role:** contributor, **delivered** — findings filed, nothing owed.
**Anchors:** my last post `8c12e014` (the typed-example workaround: a code-span example whose home is a
REGISTERED id passes rule 21 today, so the "cannot be documented" claim is conditional on the example
being non-resolving — offered to unblock h00-dini's pre-commit without an extractor fix); last inbound
processed `1d6cf3ad` (aegis retracting their own "empty the skip-set and count the fails = the debt"
rule after h00-dini refuted it — with a defective extractor that count is an UPPER BOUND, ~100% false
positive on both trees measured; the debt number only exists after per-fail triage). **Standing hooks:** (a)
fieldbook comes to me at kit cut-time to use this tree as the settings deep-merge test case — nothing of
ours is blocked; (b) when the rule-21 extractor fix ships, re-run doc-lint here to confirm the
latent-on-Standard case clears. **Durable base:** ours —
`memories/installed-safety-gate-does-not-protect-this-repo.md`; theirs — partyline
`.agent-docs/now/open-questions.md` OQ-055. **Do NOT relitigate:** fieldbook **closed the enumeration**
— reopening requires evidence that changes the conclusion, not another instance; and the operator
directed the fleet that modelmux's existence must not change anyone's model-selection rules.

> **RE-READ RULE (load-bearing):** post-compaction or cold-start, BEFORE posting anything into the
> thread, re-read the comms log since this handoff's timestamp PLUS your own last post and all replies
> to it. A post made from a stale frame is the confident-wrong failure mode; the re-read is cheap, the
> wrong post is not.

## Breadcrumbs / artifacts

- **Ephemeral, dies with this job** (`$CLAUDE_JOB_DIR/tmp/`): the Fieldbook kit clone at `v0.8.2`, the
  Ollama/Codex field-test rigs, and the four gate-probe scripts. **The probes were rescued** to a dated
  backup dir outside the repo; the field-test rig is preserved as the recipe above. Nothing else there
  has residual value.
- **Backup** of all untracked repo files + probe evidence: a dated directory outside the repo,
  `cmp`-verified. Honest limit: same machine, same disk.
- **Running locally:** Ollama on `127.0.0.1:11434` (the field-test rig). All modelmux test servers were
  stopped; `node_modules` is now populated.

## Reading order

1. This file · 2. `now/status.md` · 3. `now/work-plan.md` §Immediate next · 4. `now/open-questions.md`
(OQ-001..004) · 5. `now/obligations.md` · 6. `memories/` (both) · 7. `CLAUDE.md`. No `checkpoints/`
sitrep exists for this session.

## Recent commits

```
03bcc2e feat(upstreams): speak OpenAI Chat Completions natively via format = "openai"
880988b docs(codex): name LiteLLM as the concrete bolt-on for Codex subscriptions
764d0be feat(upstreams): add Kimi Code as a built-in flat-rate subscription
cd4ac71 chore(main): release 0.4.0 (#14)
c7cb694 feat: surface and fix untagged agents silently diverted by anySubagent (#13)
```

---
*How to refresh this file: `/handoff`.*
