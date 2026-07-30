---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-29
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-07-29) · ⚠️ a billing incident we caused · 🎯 next: decide `OQ-011`

## Project in one paragraph

modelmux is a local proxy between Claude Code and model providers that routes **per-subagent**: the
orchestrator stays on Claude while named subagents divert elsewhere, driven by a `routes.toml` cascade.
It ships as a **single self-contained binary**. On **`main`** at `66399b9`, clean, **0 ahead**, release
PR **#20 (`0.6.0`)** open and correctly versioned. **The proxy now RUNS on this machine** as a systemd
user unit — that reverses a long-standing assumption; see trap 1.

## Current state summary

Five commits pushed. One of them fixes a defect **that cost the operator real money**, and the way it
survived every gate is the most important thing in this file.

| Thing | State |
|---|---|
| `39c5adc` — passthrough never substitutes a metered key | ✅ fixed, 6 falsifiers + the inverted test |
| `a3bdbe7` + `66399b9` — GLM max-reasoning chain | ✅ live-verified end to end through the proxy |
| `modelmux.service` (systemd user unit) | ✅ enabled, **survived a real reboot**, verified |
| PR **#20** `chore(main): release 0.6.0` | 🟡 open, correctly versioned — merge when ready |
| PR **#19** dependabot | 🔴 still HELD — CI red, disarms lint AND typecheck (`OQ-009`) |
| `OQ-011` tag-scan design call | 🔴 **operator-gated**, blocks dynamic-agent routing entirely |
| `LP-007`, `LP-008` | 🟡 staged, awaiting accept/defer/reject |

Gates, measured 2026-07-29: `lint` ✅ · `typecheck` ✅ · `reachability` ✅ · `build` ✅ ·
`bun test test/` ✅ **213 pass** · doc-lint ✅ 48 files. Installed binary **sha256-equal** to a fresh
build of HEAD.

## Important context

- Decisions: `ADR-0001` (tag verb), `ADR-0002` (**superseded**), `ADR-0003` (wire formats + Codex).
- Lessons `LP-001..006` promoted; five carry MOC rows. **`LP-006`** (*a correct mechanism with an
  inverted consequence is invisible to every control*) was accepted this session with **4 firsthand
  instances**, one of them inside its own promotion commit.
- **`CLAUDE.md` carries a DATED dispatch-authorization block** (`bf8a05e`) — a record of what the
  operator said and when, never a paragraph that vouches for itself.
- Room protocol: `aegis` is the only live counterparty. Nothing owed to anyone else.

## ⚠️ Anti-assumptions / traps

1. **THE PROXY RUNS HERE NOW.** The `the-proxy-is-not-running-on-the-development-machine` memory is
   **stale as of 2026-07-29**. `modelmux.service` is an enabled systemd user unit serving `:8787`,
   with the Z.ai key from `~/.config/modelmux/env`. Routing config is now *observation*, not
   specification.
2. **A 200 answered to a credential-less request means SOMETHING ELSE PAID.** This is the whole
   incident in one line. The first proxy probe sent no auth and got a real completion; it was logged,
   written up, and filed as trivia while 93 requests billed to a metered account.
3. **A green test can be DEFENDING the bug.** `"anthropic leg PREFERS env ANTHROPIC_API_KEY"` was
   non-vacuous, correct, and specified a billing redirect. Staged as `LP-008`.
4. **`extraBody` OVERWRITES; `minMaxTokens` RAISES.** Two mechanisms on purpose. Using `extraBody`
   for a token floor would CLAMP a caller who asked for more — the opposite of a floor.
5. **`reasoning_effort` is silently dropped on Z.ai's `/api/anthropic`.** 200 on a deliberately
   invalid value. `thinking.type` IS parsed there, so it reads what it knows and discards the rest.
   `/api/paas/v4` validates it but is **METERED** ("Insufficient balance" on a Coding Plan key). Only
   **`/api/coding/paas/v4`** is subscription AND validating.
6. **At max effort, a low `max_tokens` returns THINKING WITH NO ANSWER** — billed, and it does not
   *look* truncated. It looks like the reviewer found nothing. `minMaxTokens = 32000` guards it.
7. **`<<route:>>` tags are read from `body.system` ONLY.** File-based agent defs work (proven);
   dynamic/Workflow inline prompts do NOT (proven both sides). That is `OQ-011`.
8. **Agent defs load at SESSION START — no hot-reload, for names OR bodies.** Proven by marker probe.
   A new def needs a process restart; **a machine reboot is NOT required**. `claude --resume <id>`
   preserves the transcript, but a **live bg session must be stopped first** or resume refuses.
9. **`/proc/<pid>/environ` does NOT show settings-injected env.** It is an exec-time snapshot.
   Reading its 0 as "not proxied" is wrong — verify with `decisions.jsonl` traffic instead.
10. **A `watch` wake's "N new" is NOT the unread count** — it is cursor-independent. Confirm with
    `room unread --for modelmux --count` before treating a wake as work.
11. **Before editing config in ANOTHER repo, check the target's tracking status.** A clean diff says
    nothing about whether the change travels. Nearly shipped a localhost URL to a public repo.

## Detour-chain

**MAIN:** route AEGIS's reviewers to GLM at max reasoning.
→ *side-quest:* operator hit "Credit balance too low" → **a billing redirect we caused**; found the
  9-line preference inversion, and that a test had specified it. **Resolved** (`39c5adc` + `84f6aa4`).
→ *side-quest:* `reasoning_effort` appeared to do nothing → three-endpoint probe found the subscription
  endpoint drops it and the validating one is metered. **Resolved** — `/api/coding/paas/v4`.
→ *side-quest:* GLM's reasoning was arriving and being dropped → `reasoning_content` → `thinking`
  in both paths; streaming needed block indices ALLOCATED not hardcoded. **Resolved.**
→ *side-quest:* max effort truncated into thinking-only → `minMaxTokens` raise-only floor. **Resolved.**
→ *side-quest:* pinned `ANTHROPIC_BASE_URL` into aegis's **tracked, public** `settings.json` → aegis
  caught it and relocated to the gitignored layer. **Resolved**; memory + `LP-007` filed.
→ *side-quest:* dynamic reviewer tags never routed → proven structural (`body.system` only) → `OQ-011`.
→ *side-quest:* `glm-reviewer` not in registry → proven no hot-reload → restart, not reboot. `OQ-012`.
→ *open:* `OQ-011` (operator call) · PR #19 (`OQ-009`) · `OQ-010` gate fragments · `OQ-008`.

## Immediate next steps

**1. `OQ-011` — the tag-scan decision. Operator-gated; do not widen an injection surface unasked.**
Also scanning the FIRST user message would make dynamic agents taggable. Cost: a `<<route:…>>` token in
*reviewed content* redirects routing — bounded to configured aliases, but AEGIS reviews code and those
tokens live in `.claude/agents/*.md`. If widened, scope to the first user message only, and it owes a
falsifier proving a tag in a *later* message is ignored.

**2. PR #19 — close, don't split.** `@antfu/eslint-config` 9.1→9.2 drags `eslint-plugin-unicorn ^68 →
^72` transitively, so the "safe three" are not safe by inspection. Add a `dependabot.yml` ignore for
`typescript` majors.

**3. `OQ-010`** — gate fragment for the `pkill -f` / `pgrep -af` class.

**RECIPE — verify the running proxy matches HEAD (verbatim, reusable):**

```bash
cd /home/v3ct0r/Development/Personal/modelmux && bun run build
diff <(sha256sum dist/modelmux | cut -d' ' -f1) <(sha256sum ~/.local/bin/modelmux | cut -d' ' -f1) \
  && echo "installed == HEAD"
systemctl --user is-active modelmux.service
# the leg is the ONLY evidence — a 200 proves nothing, the fallback IS Claude:
tail -f ~/.config/modelmux/decisions.jsonl | python3 -c 'import sys,json
for l in sys.stdin:
    d=json.loads(l); print(f"{d[\"matchedRule\"]:<14} -> {d[\"upstream\"]}:{d[\"resolvedModel\"]}  {d[\"agentId\"]}")'
```

**RECIPE — tell a GENUINE session decision from your own curl probes:**

```python
# a real Claude Code agent id is a long hex token; every id you type by hand is a slug
import re; REAL = re.compile(r'^[0-9a-f]{16,}$')
# filtering by a hand-maintained list of "my" names WILL miss spellings you forgot — it did.
```

## Recent decisions made

| When | Decision | Ref |
|---|---|---|
| 2026-07-29 | `passthrough` never substitutes a credential — no inbound auth sends none, upstream 401s | `39c5adc` |
| 2026-07-29 | Reviewers route over `format="openai"` to `/api/coding/paas/v4` — the only subscription endpoint that honours `reasoning_effort` | `a3bdbe7` |
| 2026-07-29 | `minMaxTokens` is a separate RAISE-only field, not `extraBody` — a floor must never clamp | `66399b9` |
| 2026-07-29 | Machine-local facts go in the **gitignored** settings layer; check tracking status first | aegis, room `c59423da` |
| 2026-07-29 | systemd user unit for the proxy — persistent config demands a persistent service | operator |
| 2026-07-27 | Dispatch pre-authorized for scoped work, recorded as a DATED fact | `bf8a05e` |

## Room-threads

*(One live counterparty: **`aegis`**. Role: I own the proxy; they own the review cycle and owe me the
leg measurement. My last posts `c59423da` / `136c5bd2`; last inbound processed `6bcec3be`. **Standing
hook:** when they report the leg, `OQ-011` either closes (file-based works → no code change) or
escalates to the operator's widen-or-not decision. **Durable base:** `OQ-011`, `OQ-012`,
`memories/a-setup-change-to-another-repo-…`. **Do NOT relitigate:** dynamic inline tags do not route
(proven both sides); a reboot is not required for a new agent def.)*

> **RE-READ RULE:** before posting anything into the room, re-read the comms log since this handoff's
> timestamp PLUS your own last post and all replies to it. A post from a stale frame is the
> confident-wrong failure mode; the re-read is cheap, the wrong post is not.

## Breadcrumbs / artifacts

- **Live services, not artifacts:** `modelmux.service` (systemd user unit) and its config at
  `~/.config/modelmux/{routes.toml,env,decisions.jsonl}`. The env file holds the Z.ai key at `0600` —
  **never commit it, never print it**.
- **Ephemeral** (`$CLAUDE_JOB_DIR/tmp/`): release-check dirs, probe bodies, room-message drafts, and
  `obligations.pre-sweep.bak`. No residual value — recipes above are the durable form.
- **Credentials:** the Z.ai key transited only as a file path and `set -a; . <file>`; never printed.
  The Codex `access_token` **expired 2026-07-28** — `codex login` before field-testing that upstream.

## Reading order

1. This file · 2. `now/status.md` · 3. `now/work-plan.md` §Immediate next · 4. `now/open-questions.md`
(`OQ-008`…`OQ-012`) · 5. `now/obligations.md` · 6. `now/lessons/proposals.md` (**`LP-007`, `LP-008`
await a ruling**) · 7. `lessons/` + `memories/` · 8. `CLAUDE.md`. No `checkpoints/` sitrep exists.

## Recent commits

```
66399b9 feat(upstreams): minMaxTokens — a RAISE-ONLY floor for the outbound token cap
9995bc6 docs(memories): a setup change to another repo needs its tracking status
a3bdbe7 feat(upstreams): impose reasoning depth per-upstream, and carry reasoning back
84f6aa4 docs: correct two claims the passthrough fix falsified
39c5adc fix(upstreams): passthrough must never substitute a metered key for a subscription
```

---
*How to refresh this file: `/handoff`.*
