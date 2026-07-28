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

## Dispatch authorization (operator-granted · DATED · re-confirm when stale)

**A recorded fact, not a self-grant.** On **2026-07-28** the operator instructed, in-session, in their
own words: *"Fix both those OQs via some sub-agent or workflow or whatever. Unless they're really
simple fixes, in which case you can do it yourself if you think it best."* — and, asked whether to
record a standing line here, *"CLAUDE.md go for it."* This paragraph **reports** that instruction; it
is not itself the instruction (see `standing-rules-core.md` §Interrupt triage — a rule you are carrying
is not a request the operator made).

**Pre-authorized:** sub-agent dispatch for **scoped, single-purpose** work under the full dispatch
contract — recon, review, independent verification, and fenced single-track builds. Prefer inline for
genuinely small things; the operator said so explicitly.

**Still ASK first for:** wide fan-outs (more than ~3 concurrent agents), anything long-running or
costly, and any dispatch that would mutate the tree outside one named track. One line with the
classification already done; default-if-silent is **inline**.

**This grant is dated and goes stale on purpose** — an instruction given in July is not consent in
November. Re-confirm if it is more than ~90 days old. **The harness still outranks it:** where a
session's harness forbids the Agent/Workflow tools, that wins and this degrades to an ask.
