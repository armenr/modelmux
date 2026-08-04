---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-04
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-08-04) · ✅ fix batch DEPLOYED + accepted live · 🎯 next: two operator calls

## Project in one paragraph

modelmux is a local proxy between Claude Code and model providers that routes **per-subagent**: the
orchestrator stays on Claude while named subagents divert elsewhere, driven by a `routes.toml`
cascade. It ships as a **single self-contained binary**. On **`main`** at `abfc6fa`, clean, **0
ahead**. The 07-30 fix batch is now **deployed and accepted on the live service** — the proxy is
running HEAD for the first time since 07-29.

## Current state summary

| Thing | State |
|---|---|
| Fix batch (`38cd513` `bf45c30` `e29f344` `f9f466e` `d989d29`) | ✅ **DEPLOYED**, running exe `eae8ed25` == fresh HEAD build |
| `ADR-0004` — `<<route:>>` must be alone on its own line | ✅ accepted + LIVE. **BREAKING** |
| `OQ-021` reasoning-summary carry-back | ✅ **WIRED** — was IMPL-only at the last handoff |
| `OQ-015` usage logging | ✅ live on BOTH wire paths |
| `OQ-020` config hot-reload | ✅ verified **in production**, incl. case 3 |
| `docs/glm-direct-vs-proxied.md` | ✅ shipped — *when NOT to use this proxy* |
| PR **#20** `chore(main): release 1.0.0` | 🔴 **CONTESTED** — recommendation is `0.6.0`, unapplied |
| Independent review of the batch | 🔴 **NEVER RUN** — the largest risk in the tree |
| `LP-007` `LP-008` `LP-009` `LP-010` | ✅ **all four ACCEPTED** 2026-08-04 → `lessons/` (one evergreen, three budding) |

Gates 2026-08-04: `lint` ✅ · `build` ✅ · `bun test test/` ✅ **248 pass** · `reachability` ✅ ·
doc-lint ✅ 54 files.

## Important context

- Decisions: `ADR-0001` (tag verb), `ADR-0002` (**superseded**), `ADR-0003` (wire formats + Codex),
  **`ADR-0004`** (the own-line `<<route:>>` rule — read it before touching `signals.ts`/`cli.ts`).
- Lessons **`LP-001..010`** filed. `LP-007`-`LP-010` adjudicated 2026-08-04: all accepted, `LP-008`
  evergreen (+ MOC row), the other three budding. **Nothing staged in `now/lessons/proposals.md`.**
- **`CLAUDE.md` carries a DATED dispatch-authorization block** (`bf8a05e`) — a record of what the
  operator said and when. It covers scoped work up to ~3 concurrent agents; the review fan-out is
  bigger and therefore needs its own ask.
- Room: the cross-tree model-version thread is **CLOSED** by operator direction. Nothing owed either
  way, no live thread — hence no Room-threads section here.

## ⚠️ Anti-assumptions / traps

1. **INLINE `<<route:tag>>` NO LONGER ROUTES.** `ADR-0004` is live: a directive must be **alone on
   its own line**. A def whose only match is prose now falls to `default` — silently, in the same
   direction as the defect it fixed. Any probe, fixture or agent def written before 08-04 may carry
   the old shape.
2. **`decisions.jsonl` now contains `kind: "usage"` rows.** A query that reads *"the last row for
   agent X"* may land on a usage row, which has **no `matchedRule`**. That exact `KeyError` was the
   first evidence `OQ-015` worked.
3. **A trivial prompt makes a reasoning-feature probe return a false negative.** `OQ-021`'s first
   acceptance asked for an echo, got no thinking block, and looked like a broken carry-back. The
   feature was fine; the prompt never asked for reasoning. Now `LP-010`, accepted.
4. **The proxy IS running and IS on HEAD** (`eae8ed25`, verified by hashing `/proc/<pid>/exe`, not
   the installed copy). Rollback binary at `$CLAUDE_JOB_DIR/tmp/modelmux.rollback` — **ephemeral**.
5. **`reasoning_effort` is SILENTLY DROPPED on Z.ai's `/api/anthropic`** — 200 on a deliberately
   invalid value, twice. The graduated levels exist only on `/api/coding/paas/v4` (OpenAI wire).
6. **Claude Code's think/ultrathink keywords are INERT against Z.ai.** Captured 35 requests across
   plain/think/ultrathink: two payloads only, `{"type":"adaptive"}` or null. No `budget_tokens`.
7. **`adaptive` is the DEEPEST thinking setting, not a compromise** — 39,613 thinking chars vs
   23,233 (budget 4000) and 19,589 (budget 24000). Setting it by hand makes it WORSE, and
   `budget_tokens` is **not a bound**.
8. **A `200K` context reading is Claude Code failing to recognise `glm-5.2`, not a GLM limit.** Fixed
   with `CLAUDE_CODE_MAX_CONTEXT_TOKENS=1000000`; the endpoint really serves it (883,733 input
   tokens accepted). **`CLAUDE_CODE_MAX_OUTPUT_TOKENS` does NOT work** — it clamps at 32000.
9. **`claude -p` inherits the cwd's `CLAUDE.md` and hooks** — headless is not context-free. Run
   probes from a `mktemp -d`. Bitten twice; see the `claude-p-…-second-voice` memory.
10. **fish `string trim -c` does NOT interpret a `\x27` escape** — it takes the literal set
    `{" \ x 2 7}`. The Z.ai key starts with `7`, so it silently ate two characters. Use a regex
    replace instead (`\x27` IS valid inside a regex).
11. **`ls` is aliased here** (eza) and rejects `ls -1t`. Use `find -printf` for time-sorted listings.

## Detour-chain

**MAIN:** deploy the 07-30 fix batch and run the four owed acceptances. → **DONE, all four passed.**
→ *side-quest:* the review probe fell to `default` on the first post-deploy request → **not a defect**
  — my probe used an inline tag, exactly what `ADR-0004` invalidated. Fixed the probe. **Resolved.**
→ *side-quest:* `OQ-021`'s acceptance returned no thinking block → **not a defect** — the prompt was
  an echo. Re-ran with a reasoning-demanding prompt. **Resolved → `LP-010`.**
→ *side-quest (operator):* "how do I run Claude Code on Z.ai directly?" → measured the whole path;
  shipped `docs/glm-direct-vs-proxied.md`, installed `claude-glm.fish`, sent a forwardable guide.
  **Resolved.**
→ *side-quest:* "why 200K not 1M?" → Claude Code's model-table miss; `CLAUDE_CODE_MAX_CONTEXT_TOKENS`
  fixes it, endpoint verified to 883K. **Resolved.**
→ *side-quest (earlier):* cross-tree model-version-rot thread → found MY defect (a fixed defect's
  citation propagated as present tense), corrected in 3 places, staged `LP-009`. Thread **CLOSED**
  by the operator; my reply was filed, never sent.
→ *open:* the release version · the review fan-out · `OQ-008` `OQ-009` `OQ-010` `OQ-012` `OQ-018`.

## Immediate next steps

**1. Rule on the RELEASE VERSION.** PR #20 is `1.0.0`; recommendation is `0.6.0` — the repo's own
rule is that a version must match user-facing reality, and this tree fixed three confirmed defects
last week with five OQs open. To take the recommendation, add one line under `with:` in
`.github/workflows/release.yml`:
```yaml
          bump-minor-pre-major: true
```

**2. Authorise (or decline) the INDEPENDENT REVIEW fan-out** over the five code commits. Zero
independent review exists on any of them; every non-vacuity proof was run by the author, which is
exactly the separation the standing rules forbid collapsing.

**3. Then, in order:** `OQ-010` (safety-gate fragment — `pkill -f` has now fired three times),
`OQ-008` (the Codex half is cheap: `~/.codex/models_cache.json` is on-disk, no network, no key),
PR #19 / `OQ-009`, `OQ-012`.

**RECIPE — verify the running proxy matches HEAD (verbatim, reusable):**
```bash
cd /home/v3ct0r/Development/Personal/modelmux && bun run build
NEWPID=$(systemctl --user show modelmux.service -p MainPID --value)
# hash the RUNNING image, not the installed copy — they can differ
diff <(sha256sum /proc/$NEWPID/exe | cut -d' ' -f1) <(sha256sum dist/modelmux | cut -d' ' -f1) \
  && echo "running == HEAD"
```

**RECIPE — assert a leg, post-`ADR-0004` (note the OWN-LINE directive, and skip usage rows):**
```bash
python3 - <<'EOF'
import json, os, urllib.request
body={"model":"m","max_tokens":32,"stream":False,
      "system":"<<route:review>>\nYou are a reviewer.",      # OWN LINE or it will not route
      "messages":[{"role":"user","content":"OK"}]}
req=urllib.request.Request("http://localhost:8787/v1/messages",
    data=json.dumps(body).encode(),
    headers={"content-type":"application/json","x-claude-code-agent-id":"leg-probe"})
try: urllib.request.urlopen(req, timeout=120).read()
except Exception as e: print("(upstream said:", type(e).__name__, ")")
rows=[json.loads(l) for l in open(os.path.expanduser("~/.config/modelmux/decisions.jsonl")) if l.strip()]
d=[r for r in rows if r.get("agentId")=="leg-probe" and r.get("kind")!="usage"][-1]
print(d["matchedRule"], "->", d["upstream"]+":"+d["resolvedModel"])
EOF
```

**RECIPE — Claude Code on Z.ai GLM directly (installed as the `claude-glm` fish function):**
```bash
env -u ANTHROPIC_API_KEY \
    ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic \
    ANTHROPIC_AUTH_TOKEN="$ZAI_KEY" \
    ANTHROPIC_MODEL=glm-5.2 ANTHROPIC_SMALL_FAST_MODEL=glm-5.2 \
    CLAUDE_CODE_MAX_CONTEXT_TOKENS=1000000 \
    claude
# verify:  claude-glm -p --output-format json "hi" | jq '.modelUsage'
#   expect glm-5.2 with contextWindow 1000000; a claude-* id or 200000 means it did not take
```

## Recent decisions made

| When | Decision | Ref |
|---|---|---|
| 2026-08-04 | Deploy only into a verified-empty flight deck; hash `/proc/<pid>/exe` to prove what runs | `abfc6fa` |
| 2026-08-04 | The release version is the operator's call; `1.0.0` NOT self-resolved to `0.6.0` | obligations row |
| 2026-07-31 | `<<route:>>` must be alone on its own line; docs-only rejected as the runner-up | `ADR-0004`, `e29f344` |
| 2026-07-31 | Usage recorded OUT OF BAND; never fabricate `input_tokens` into `message_start` | `d989d29` |
| 2026-07-30 | `minMaxTokens` REFUSED on a codexSubscription upstream, not silently ignored | `38cd513` |
| 2026-07-30 | Document the direct GLM path as a legitimate alternative — the proxy buys control, not depth | `7c2a529` |

## Breadcrumbs / artifacts

- **Live services:** `modelmux.service` + `~/.config/modelmux/{routes.toml,env,decisions.jsonl}`.
  The env file holds the Z.ai key at `0600` — **never commit it, never print it**.
- **Installed outside the repo:** `~/.config/fish/functions/claude-glm.fish` — verified end to end
  (`contextWindow=1000000`, `modelUsage: ['glm-5.2']`). Carries its own rationale in comments.
- **Ephemeral** (`$CLAUDE_JOB_DIR/tmp/`, clears): `modelmux.rollback` (the pre-deploy binary),
  `claude-code-on-glm.md` (the forwardable guide — its content is preserved in
  `docs/glm-direct-vs-proxied.md`), `msg-sixth-shape.txt` (filed-not-sent; its content is `LP-009`),
  and the probe scripts. **Nothing here is the only copy of anything durable.**
- **Credentials:** the Z.ai key transited only as a file read, never printed. The Codex
  `access_token` **expires 2026-08-08** — `codex login` renews it; no restart needed.

## Reading order

1. This file · 2. `now/status.md` · 3. `now/work-plan.md` §Immediate next · 4.
`now/open-questions.md` (`OQ-008` `OQ-009` `OQ-010` `OQ-012` `OQ-018`) · 5. `now/obligations.md`
(**three operator rows**) · 6. `lessons/index.md` (`LP-001`-`LP-010`) · 7.
`decisions/0004-…` · 8. `docs/glm-direct-vs-proxied.md` · 9. `CLAUDE.md`. No `checkpoints/` sitrep
exists.

## Recent commits

```
abfc6fa docs: deploy the 30 July fixes; all four acceptances pass live
4594231 docs(glm): the 200K context window is Claude Code guessing, not a GLM limit
7c2a529 docs: when NOT to use this proxy — GLM direct vs proxied, measured
dc27c53 docs: amend a cited verdict, and name the convention-shields-itself class
46b773c docs: record the room halt, and the aggregate-blindness it exposed
```

---
*How to refresh this file: `/handoff`.*
