# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2](https://github.com/armenr/modelmux/compare/v0.1.1...v0.1.2) (2026-07-06)


### Bug Fixes

* bug-hunt batch — credential leak, request-path hardening, config validation, papercuts ([#4](https://github.com/armenr/modelmux/issues/4)) ([e25fd5e](https://github.com/armenr/modelmux/commit/e25fd5edb0ce4e6721477942b700ab948c735970))

## [0.1.1](https://github.com/armenr/modelmux/compare/v0.1.0...v0.1.1) (2026-07-06)


### Bug Fixes

* print clean errors instead of stack traces and stop a false success on use ([#2](https://github.com/armenr/modelmux/issues/2)) ([bf0fc7c](https://github.com/armenr/modelmux/commit/bf0fc7c5323cfc062f0309687098467cd1746daf))

## [Unreleased]

## [0.1.0] - 2026-07-07

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
- **Vended single binary**: `bun run build` compiles a self-contained
  `dist/modelmux` (Bun runtime and `routes.toml` embedded at compile time) that
  runs the proxy with no Bun, Node, DevBox, or Docker. `modelmux` (no args) or
  `modelmux serve` starts it; on first run it writes a default `routes.toml` if
  none exists.
- **Release workflow** (`.github/workflows/release.yml`): a `v*` tag
  cross-compiles the linux and darwin (x64 + arm64) and windows binaries and
  publishes them to the GitHub release.
- **Tooling scripts**: `scripts/check-latest.ts` (compare configured OpenRouter
  slugs against the live catalog) and `scripts/live-smoke.ts` (opt-in real
  end-to-end routing check).
- **Onboarding skills/agents** (`.claude/`): `getting-started`, `explain-modelmux`,
  `switch-models` skills, and an interactive `setup-assistant` agent.
- **Docs**: [`docs/using-the-binary.md`](docs/using-the-binary.md) (binary
  users) and [`docs/development.md`](docs/development.md) (from-source workflow).
- **Reproducible toolchain**: DevBox + Bun, ESLint (Antfu config, no Prettier),
  lefthook git hooks, and a hermetic `bun test` suite.
- **CI**: lint · typecheck · test gate on every push/PR, plus an opt-in live
  smoke job on manual dispatch.

[Unreleased]: https://github.com/armenr/modelmux/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/armenr/modelmux/releases/tag/v0.1.0
