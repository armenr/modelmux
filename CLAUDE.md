
<!-- partyline:begin -->
# partyline — you are agent 'modelmux'

Room: `/home/v3ct0r/rooms/crates` · CLI: `room`

- FIRST THING each session: arm your room monitor with the Monitor tool
  (persistent: true), command EXACTLY:
  `/home/v3ct0r/.local/bin/partyline watch modelmux --room /home/v3ct0r/rooms/crates`
  (watch rings on to-field mentions only — text merely mentioning you cannot
  false-wake you, so write message bodies freely)
- When the monitor fires or a hook reports unread mail: FIRST run
  `room read --for modelmux --room /home/v3ct0r/rooms/crates` (it advances your cursor — skipping
  it means the same mail blocks your next stop), THEN act on it.
- Reply with `room post --room /home/v3ct0r/rooms/crates --as modelmux --to @somename "..."` ONLY
  when you have genuinely new information. Never post bare acknowledgements
  ("ack", "got it"). @mention recipients explicitly; @all is a quiet FYI
  broadcast that wakes nobody.
- Between messages, work in this repo as normal. The room is a doorbell,
  not a lounge.
- **ONE VOICE PER NAME.** Only this repo's PRIMARY interactive session arms
  the room monitor and speaks as `modelmux`. The watch command holds a name
  lease and refuses a second concurrent arm, but the lease is not the whole
  guard: if you are a spawned subagent, a background agent, or a workflow
  leg reading this block, do NOT arm a room monitor, do NOT `room post`, do
  NOT `room read` (it steals the primary's cursor) — surface anything
  room-relevant to your orchestrator instead. A completed background agent
  must never answer mail as this repo: if a monitor you armed wakes you and
  your task is already finished, Stop-Task that monitor and end quietly.
<!-- partyline:end -->

<!-- kit:start (fieldbook 0.8.2) -->
# modelmux

A batteries-included template for heterogeneous agent routing in Claude Code — keep the orchestrator on Claude, route chosen subagents to OpenRouter models via a small owned proxy.

## Orient FIRST

At the start of a session run **`/orient`** — it reads `.agent-docs/now/handoff.md` (the curated bridge
from the last session) and verifies it against git reality. Do not act on stale state; if `/orient` says
the handoff is stale, refresh it before proceeding. The operating context lives in `.agent-docs/`, not in
memory:

- `.agent-docs/now/{status,work-plan,open-questions}.md` — current state, what's next, open questions.
- `.agent-docs/CONVENTIONS.md` — the schema contract (how docs are written, the ID spine, the lint rules).
- `.claude/rules/standing-rules-core.md` — the **canonical operational rules** (safety, quality gates,
  findings-to-disk, adversarial separation). Read them; they are load-bearing, not decorative.

## Progressive disclosure — route, don't browse

`.agent-docs/` is reached through per-directory `index.md` routing and front-matter breadcrumbs, **not**
by bulk-reading the tree. Start at `.agent-docs/index.md`; open a doc via its dir's index. Never load a
whole directory to "get context" — that is exactly the context-bomb the system exists to prevent.

## Quality gates (the acceptance bar)

A change is not done because it compiles. The gates must pass, and never be bypassed:

- Build: `bun run build`
- Test: `bun test test/`
- Lint: `bun run lint`
- Format: ``

A behavior change **owes a test that would fail without it.** And "green tests" ≠ "wired": verify a change
is reachable from a real entrypoint (IMPL→WIRED), proving it with `the TypeScript language server` or the
reachability-prover menu in `.claude/rules/standing-rules-core.md`. Default branch: `main`.

## Session lifecycle

`/orient` at the start · `/flush` mid-session when `now/*` has drifted · `/handoff` at session end or
before compaction · a `/sitrep` checkpoint before anything risky. Findings, decisions, and dead-ends go
to disk as a byproduct of the work — knowledge that lives only in the conversation is gone at compaction.

<!-- Installed by Fieldbook. See FIELD-GUIDE (in the kit) for the daily loop and "which doc type when". -->
<!-- kit:end -->
