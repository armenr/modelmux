# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0](https://github.com/armenr/modelmux/compare/v0.5.1...v1.0.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **signals:** a `<<route:NAME>>` directive is now recognised only when it is alone on its own line. A def whose ONLY match is a prose mention routed before and falls to `default` now. Re-assert `matchedRule` after upgrading.

### Features

* **log:** record per-request usage, so a translated leg stops reading as zero ([d989d29](https://github.com/armenr/modelmux/commit/d989d298509771bcfeb7fcb9e6c12921394768b5))
* **responses:** carry a Codex reasoning summary back as a thinking block ([f9f466e](https://github.com/armenr/modelmux/commit/f9f466ef6b6a4329adc4dd287ffa7f29735d12ca))
* **upstreams:** impose reasoning depth per-upstream, and carry reasoning back ([a3bdbe7](https://github.com/armenr/modelmux/commit/a3bdbe7495c79735eb10e75176cc51ee74d6f2ec))
* **upstreams:** minMaxTokens — a RAISE-ONLY floor for the outbound token cap ([66399b9](https://github.com/armenr/modelmux/commit/66399b986cd53dd49a7e3d724276ab8a9c1cea20))


### Bug Fixes

* **cli:** report the version and fail on an unrecognised command ([46fa645](https://github.com/armenr/modelmux/commit/46fa645dc1e19bd46ab53914c65c022ed3e8e630))
* **config:** watch the directory, so one safe save cannot kill hot-reload ([bf45c30](https://github.com/armenr/modelmux/commit/bf45c30b571a74c3b970eb692f508beb3b4a493f))
* **rules:** an authorization fact is repo-local and dated — it never travels ([36854ce](https://github.com/armenr/modelmux/commit/36854ce06c0c38a995c501854e1d8ff404ce0309))
* **rules:** the harness outranks this kit on whether to dispatch at all ([0554372](https://github.com/armenr/modelmux/commit/0554372dee05e7b9f6ec381bd17b6b5cfedb99e6))
* **signals:** a &lt;&lt;route:&gt;&gt; tag must be alone on its own line ([e29f344](https://github.com/armenr/modelmux/commit/e29f34429e6f1ed5d027ab5c747cdd8c56400136))
* **upstreams:** passthrough must never substitute a metered key for a subscription ([39c5adc](https://github.com/armenr/modelmux/commit/39c5adc29f96bc66224084790aaea79bb616d11b))
* **upstreams:** the token floor must know which wire it is writing to ([38cd513](https://github.com/armenr/modelmux/commit/38cd5135a98526a39077109515632e4911adaf22))

## [0.5.1](https://github.com/armenr/modelmux/compare/v0.5.0...v0.5.1) (2026-07-25)


### Bug Fixes

* **server:** call forwardUrl instead of duplicating it, and gate reachability in CI ([#17](https://github.com/armenr/modelmux/issues/17)) ([8b989bb](https://github.com/armenr/modelmux/commit/8b989bb23f2511df9ad4a73c84d25b14171d329b))

## [0.5.0](https://github.com/armenr/modelmux/compare/v0.4.0...v0.5.0) (2026-07-25)


### Features

* **upstreams:** speak OpenAI wire formats natively — Chat Completions, Responses, and flat-rate subscriptions ([#15](https://github.com/armenr/modelmux/issues/15)) ([5e862d8](https://github.com/armenr/modelmux/commit/5e862d87dd986f4055420ea62ca012c6fad84c2e))

## [0.4.0](https://github.com/armenr/modelmux/compare/v0.3.0...v0.4.0) (2026-07-25)


### Features

* surface and fix untagged agents silently diverted by anySubagent ([#13](https://github.com/armenr/modelmux/issues/13)) ([c7cb694](https://github.com/armenr/modelmux/commit/c7cb694a1f22758368fc1a72dbe781818a93c17c))

## [0.3.0](https://github.com/armenr/modelmux/compare/v0.2.0...v0.3.0) (2026-07-07)


### Features

* built-in zai upstream for Z.ai GLM Coding Plan subscriptions ([#8](https://github.com/armenr/modelmux/issues/8)) ([7bd0277](https://github.com/armenr/modelmux/commit/7bd0277b0e31c8be879f3001b8304b5984397948))

## [0.2.0](https://github.com/armenr/modelmux/compare/v0.1.2...v0.2.0) (2026-07-07)


### Features

* configurable upstreams for local and self-hosted models ([#6](https://github.com/armenr/modelmux/issues/6)) ([47a2aa0](https://github.com/armenr/modelmux/commit/47a2aa02ca58de2ce272189668c2607653cd9728))

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
- **Docs**: the [README](README.md) (binary users) and
  [`docs/development.md`](docs/development.md) (from-source workflow).
- **Reproducible toolchain**: DevBox + Bun, ESLint (Antfu config, no Prettier),
  lefthook git hooks, and a hermetic `bun test` suite.
- **CI**: lint · typecheck · test gate on every push/PR, plus an opt-in live
  smoke job on manual dispatch.

[Unreleased]: https://github.com/armenr/modelmux/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/armenr/modelmux/releases/tag/v0.1.0
