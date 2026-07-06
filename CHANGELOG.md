# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-28

Initial release — a batteries-included template for heterogeneous agent
routing in Claude Code.

### Added

- **Proxy core** (`src/`): a `Bun.serve` reverse proxy that keeps the Claude
  Code orchestrator on Anthropic while routing chosen subagents to non-Claude
  models via OpenRouter's Anthropic-compatible endpoint. SSE streams pass
  through untouched.
- **Config-driven routing** (`routes.toml`): a friendly alias → model menu and
  a first-match cascade over request signals (route tags, work-type, subagent).
  Hot-reloads on edit; keeps the last good config if an edit is invalid.
- **`mux` CLI** (`bin/mux`): `models`, `set`, `use`, and `check-latest`
  for swapping models and rebinding agents without hand-editing JSON.
- **Tooling scripts**: `scripts/check-latest.ts` (compare configured OpenRouter
  slugs against the live catalog) and `scripts/live-smoke.ts` (opt-in real
  end-to-end routing check).
- **Onboarding skills/agents** (`.claude/`): `getting-started`, `explain-modelmux`,
  `switch-models` skills, and an interactive `setup-assistant` agent.
- **Reproducible toolchain**: DevBox + Bun, ESLint (Antfu config, no Prettier),
  lefthook git hooks, and a hermetic `bun test` suite.
- **CI**: lint · typecheck · test gate on every push/PR, plus an opt-in live
  smoke job on manual dispatch.

[Unreleased]: https://github.com/armenr/modelmux/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/armenr/modelmux/releases/tag/v0.1.0
