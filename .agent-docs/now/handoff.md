---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-27
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-07-26) · ✅ board clear · 🎯 next: HOLD PR #19

## Project in one paragraph

modelmux is a local proxy between Claude Code and model providers that routes **per-subagent**: the
orchestrator stays on Claude while named subagents divert elsewhere, driven by a `routes.toml`
cascade. It ships as a **single self-contained binary** — that promise drove the last two releases.
On **`main`** at `8b989bb`, clean, **0 commits ahead**, latest tag **`v0.5.1`**. Nothing is in flight.

## Current state summary

Two releases shipped and **artifact-verified** — downloaded, checksummed against the published
`SHA256SUMS`, run, and confirmed the feature was in the shipped bytes. Seven of eight open questions
closed. Four lessons promoted. One open item, and it is a **hold**, not a task.

| Thing | State |
|---|---|
| `v0.5.0` — three wire formats native; `kimi` + `codex` built-in | ✅ released, verified |
| `v0.5.1` — reachability oracle in CI; `forwardUrl` dead-code fix | ✅ released, verified |
| WU-0001..0003 | ✅ all WIRED |
| OQ-001..007 | ✅ resolved |
| `OQ-008` (per-provider probing) · `OQ-009` (dependabot majors) · `OQ-010` (trap→mechanism debt) | 🟡 open, none blocking |
| PR **#19** (dependabot) | 🔴 **CI failing — do NOT merge as-is** |

Gates, measured 2026-07-26: `lint` ✅ · `typecheck` ✅ · `reachability` ✅ · `build` ✅ ·
`bun test test/` ✅ **156 pass** · doc-lint ✅ 43 files.

## Important context

- Decisions live in `ADR-0001` (tag verb), `ADR-0002` (**superseded**), `ADR-0003` (wire formats +
  the Codex built-in, with a 2026-07-25 amendment recording that it shipped broken). Reference by ID.
- Lessons `LP-001..005` are promoted and live in `lessons/`; **four** carry MOC rows. `LP-005`
  (*a written-down trap is not a disarmed trap*) was accepted evergreen 2026-07-27 and shipped
  `OQ-010` with it — staging is empty.
- Four memories: the kit safety gate does not protect this repo · the proxy is not running here ·
  doc-lint "clean" is a partial claim · three pre-commit mechanisms and none of them ran.
- **The pre-commit gate is ARMED** (`core.hooksPath=.githooks`) and proven by deliberate failure.
- Room protocol: fieldbook owns every kit fix discussed; they arrive on upgrade. **Nothing owed.**

## ⚠️ Anti-assumptions / traps

1. **`partyline read` MUTATES the cursor — it is not a probe.** Putting it in a status pipeline
   (`… | grep -c`) consumed four messages into a discarded count this session. Recovery was only
   possible because `room.jsonl` is append-only. For status, read the log or `cursors/`, never `read`.
2. **`pkill -f <pattern>` kills your own shell here** (exit 144) — the harness wrapper embeds the
   command string, so the pattern matches the shell running it. Kill by PID. *(Fired again this
   session despite being written down — see `LP-005`.)*
3. **fish/zsh do NOT word-split unquoted parameters.** `for v in $VERBS` treated a six-line string as
   one word and printed a **false green**. Use `while read -r` or explicit arrays.
4. **`knip` exits 0 over a population of ZERO.** Point `project` at a dead glob and it emits a hint
   and still returns success. That is why `scripts/reachability.ts` wraps it with a population floor
   and a distinct **exit 2** for "the check itself cannot be trusted."
5. **Tests are deliberately NOT reachability entrypoints.** Every `src/*.ts` has a test importing it,
   so admitting tests makes the oracle report clean *forever*. `test/reachability-config.test.ts` is
   the standing guard; widening `entry` turns it red.
6. **`doc-lint: clean — 43 files` is a PARTIAL claim.** 17 of those carry `provenance: kit-template`,
   which disables rules 8/15/21/12 on them. Kit-owned; do not patch.
7. **`CLAUDE.md` carries the skip-worktree bit.** The committed copy has no partyline block; the local
   one does. A branch switch **will abort** until you clear it — this already happened once. Procedure
   in `OQ-003`: `--no-skip-worktree` → checkout → restore the local file → re-arm.
8. **The Codex backend diverges from OpenAI's published Responses spec.** `store:false` and
   `stream:true` are mandatory, `instructions` must be non-empty, and `max_tokens`/`temperature`/
   `top_p` are **rejected outright**, not ignored. Its `response.completed` carries `output: []` —
   **always empty** — so aggregating a non-streaming reply from it returns a structurally-valid EMPTY
   message. Content lives only in the per-item events.
9. **The proxy is NOT running on this machine.** Routing config is specification, not observation.
10. **A green `bun test` does not mean the gates ran.** Without `node_modules`, `lint`/`typecheck`
    exit **127** while tests still pass — a partial green that looks identical to a full one.

## Detour-chain

**MAIN:** ship subscription + wire-format support, then release.
→ *side-quest:* Codex "worked" only on paper → a live probe found **five defects** that would have
  400'd every request. **Resolved**, each with a falsifier. *(The most valuable detour of the session.)*
→ *side-quest:* the pre-commit gate had silently skipped 16 commits → armed and proven by deliberate
  failure. **Resolved.**
→ *side-quest:* the cited IMPL→WIRED oracle (`knip`) had never run → installed, floored, and it found
  `forwardUrl` dead on its first run. **Resolved → `v0.5.1`.**
→ *side-quest:* operator asked for fresh model lists → primary sources beat the search summary
  (`claude-opus-5` landed 2026-07-24); Kimi's own docs **reversed our advice** on `k3-256k`.
  **Resolved.**
→ *side-quest:* PR #17's `feat(` title would have cut a spurious **v0.6.0** → retitled after checking
  the diff had zero user-facing change. **Resolved → v0.5.1.**
→ *parallel thread:* a long agent-room investigation into observation integrity (empty results,
  legends, canaries, population floors). Several claims were **refuted by measurement**, including my
  own. Fieldbook owns all kit fixes. **Closed; filing only.**
→ *open:* PR #19 dependabot majors (`OQ-009`), per-provider probing (`OQ-008`), and the
  trap→mechanism debt `LP-005`'s acceptance bought (`OQ-010`).

## Immediate next steps

**HOLD PR #19 — do not merge.** It groups `typescript ^6.0.3 → ^7.0.2` (a MAJOR) into a routine
dev-deps group. CI fails with `Error: typescript-eslint does not support TS 7.0`. Merging disarms
**lint and typecheck together**.

```bash
# 1. Confirm the failure is what it claims (do not trust this doc — re-derive)
gh pr checks 19
gh run view <run-id> --log-failed | grep -i 'does not support'

# 2. Split: take the safe three, hold typescript
#    @antfu/eslint-config 9.1->9.2 · @commitlint/cli 21.2.0->21.2.1 · eslint 10.6->10.8
# 3. Gate locally BEFORE pushing — CI proved the failure, the split is what needs proving
bun install && bun run check        # must be rc=0

# 4. Prevent recurrence: a dependabot.yml ignore rule for typescript MAJOR
```

**Then `OQ-008`:** extend `check-latest` to probe per-provider — Anthropic via the Models API (needs
a key), Codex via `~/.codex/models_cache.json` (on disk, no network). Own branch; it is feature scope.

**RECIPE — verifying a release ARTIFACT, not just CI (verbatim, reusable):**

```bash
# CI green proves the build ran. It does not prove the shipped bytes work.
mkdir -p /tmp/relcheck && cd /tmp/relcheck
gh release download vX.Y.Z --repo armenr/modelmux \
  --pattern 'modelmux-linux-x64' --pattern 'SHA256SUMS'
grep 'modelmux-linux-x64' SHA256SUMS | sha256sum -c -     # must print OK
chmod +x modelmux-linux-x64 && mkdir -p run && cd run
../modelmux-linux-x64 models                               # bootstraps routes.toml
# THEN exercise the NEW feature, and include a NEGATIVE control:
../modelmux-linux-x64 models >/dev/null 2>&1; echo "rc=$?"    # good config -> 0
# (make routes.toml invalid) -> rc MUST be 1, not 0
```

**RECIPE — field-testing an upstream (the leg must be PROVEN, not assumed):**

```bash
# routes.toml with NO anthropic alias: a mis-wire cannot fall through to the real API
default = "gpt"
routes = []
[models]
gpt = "codex:gpt-5.5"
# after the run, assert the LEG from decisions.jsonl — the 200s are NOT the evidence:
#   python3 -c "import json;print({json.loads(l).get('upstream') for l in open('decisions.jsonl')})"
```

## Recent decisions made

| When | Decision | Ref |
|---|---|---|
| 2026-07-25 | Speak OpenAI formats natively rather than document a second process | `ADR-0003` |
| 2026-07-25 | Ship a `codex` built-in — reverses ADR-0002, on explicit operator request | `ADR-0003` |
| 2026-07-25 | `OQ-002`: fail loud on 401; do NOT redeem the refresh token — *the test is the dangerous act* | `df9347b` |
| 2026-07-25 | `OQ-003`: strip the partyline block + skip-worktree, from four options | operator |
| 2026-07-25 | `OQ-005`: accept the sync read — **measured** at 0.002 ms, 0.0001% of a round trip | `OQ-005` |
| 2026-07-26 | Retitle PR #17 `feat(`→`fix(` — zero user-facing change, so v0.5.1 not v0.6.0 | `log.md` |
| 2026-07-26 | `LP-001` promoted **with an amendment**: the spec is the floor, not the proof | `lessons/` |

## Room-threads

*(No live thread. The 2026-07-25 observation-integrity investigation with `fieldbook`, `filemage-gen2`,
`h00-sh`, `aegis`, `partyline` and `h00-dini` closed the same day — every kit fix is fieldbook's and
arrives on upgrade; my last posts `9fd8a23d` / `f534466d` drew replies that were rulings or
acknowledgements, all processed. **Nothing owed in either direction.** Durable residue is on disk
here: `lessons/an-empty-result-is-evidence-about-the-query-not-the-world.md`,
`memories/doc-lint-clean-is-a-partial-claim-*`, `OQ-008`.)*

> **RE-READ RULE (still load-bearing if a thread reopens):** before posting anything into the room,
> re-read the comms log since this handoff's timestamp PLUS your own last post and all replies to it.
> A post from a stale frame is the confident-wrong failure mode; the re-read is cheap.

## Breadcrumbs / artifacts

- **Ephemeral, dies with the job** (`$CLAUDE_JOB_DIR/tmp/`): release-verification dirs (`relcheck`,
  `rel51`) and the Codex field-test rig (`ft`). **No residual value** — both recipes are captured
  verbatim above, which was the point of writing them down.
- **Workflow run `wf_83c2b107-737`** (2 read-only recon agents: a knip currency-check and a
  hand-built ground-truth reachability map). Transcript + `journal.jsonl` under
  `.claude/projects/<session>/subagents/workflows/wf_83c2b107-737/`. **Fully drained** — every
  `discoveries[]` item was acted on or verified, and its ground-truth map became the known-positive
  control for the oracle. Nothing pending.
- **Credentials:** the Codex `access_token` was read for field-testing and **never printed, logged or
  written** to any file — only the `exp` claim is ever decoded. It expires **2026-07-28T14:38Z**,
  i.e. **today**; past that, field-testing Codex needs `codex login` first (no restart). Nothing
  else depends on it.

## Reading order

1. This file · 2. `now/status.md` · 3. `now/work-plan.md` §Immediate next · 4. `now/open-questions.md`
(OQ-008, OQ-009, OQ-010) · 5. `now/obligations.md` · 6. `lessons/` + `memories/` (LP-005 is new and
evergreen; staging is empty) · 7. `CLAUDE.md`. No `checkpoints/` sitrep exists for this session.

## Recent commits

```
8b989bb fix(server): call forwardUrl instead of duplicating it, and gate reachability in CI (#17)
746a9d5 chore(main): release 0.5.0 (#16)
5e862d8 feat(upstreams): speak OpenAI wire formats natively — Chat Completions, Responses, … (#15)
cd4ac71 chore(main): release 0.4.0 (#14)
c7cb694 feat: surface and fix untagged agents silently diverted by anySubagent (#13)
```

---
*How to refresh this file: `/handoff`.*
