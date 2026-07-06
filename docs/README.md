# Design docs

Background on how hetero-agents is designed and how it was built. **The code is
the source of truth** — these documents capture intent and history.

- [`specs/2026-06-27-hetero-agents-design.md`](specs/2026-06-27-hetero-agents-design.md)
  — the design spec: goals, the routing model, and the verified facts about
  Claude Code + OpenRouter it rests on.
- [`plans/2026-06-27-hetero-agents.md`](plans/2026-06-27-hetero-agents.md)
  — the original 15-task, test-driven implementation plan. Historical; the
  shipped code may differ where reality taught us better.
- [`deferred-todos.md`](deferred-todos.md) — deliberately-deferred work and
  ideas (a lightweight roadmap).

This project was built with a subagent-driven TDD workflow — each task written
test-first and reviewed before commit — which is why the git history reads as a
sequence of small, verified steps.
