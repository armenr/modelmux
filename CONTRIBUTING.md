# Contributing to modelmux

Thanks for your interest! This repo is an **exemplar template**, so the bar is
less "ship features fast" and more "keep it clean, small, and verifiable."
Two principles drive everything here:

- **Evidence over assertion** — if you claim it works, show the gates passing.
- **Batteries included, nothing dangling** — every referenced script, alias,
  and command should actually exist and run.

## Development setup

Environment setup — Bun or DevBox, `.env`, and git hooks — lives in
[docs/development.md](docs/development.md). Set up your checkout there, then
follow the loop below.

## The loop

We use test-driven development. For any change:

1. Write (or update) a test in `test/`.
2. Make it pass with the smallest change in `src/` (or `scripts/`, `bin/`).
3. Run the gates — **all three must be green** before you commit:

```bash
bun run lint        # ESLint (Antfu config; also formats — no Prettier)
bun run typecheck   # tsc --noEmit
bun test test/      # hermetic suite (no network)
```

A `pre-commit` hook auto-fixes lint on staged files; `pre-push` runs the tests.
Don't disable hooks or skip tests to get green — fix the root cause.

## Binary build & release

`bun run build` compiles the vended single binary to `dist/modelmux` (Bun
runtime and `routes.toml` embedded) for local use.

Releases are automated by
[release-please](https://github.com/googleapis/release-please). Conventional
commits on `main` let it open a release PR that bumps the version and updates
the changelog; merging that PR tags the release, and
`.github/workflows/release.yml` then cross-compiles the linux/darwin
(x64 + arm64) and windows binaries — plus a `SHA256SUMS` file — and attaches
them to it. Don't tag releases by hand.

## Changing routing or models

- **Swap a model:** edit `routes.toml`, or use the CLI:
  `bin/mux set flagship openrouter:<vendor>/<slug>`.
- **Check your slugs are still live:** `bin/mux check-latest`.
- **Point an agent at a different alias:** `bin/mux use <agent> <alias>`
  (rewrites the agent's `<<route:alias>>` tag).
- **Add a routing signal:** extend `extractSignals` in `src/signals.ts` and the
  cascade in `src/route.ts`, with tests in `test/signals.test.ts` /
  `test/route.test.ts`. Routing is pure and first-match — keep it that way.

If you change behavior or config, update the relevant onboarding skill in
`.claude/skills/` and the README so a fresh clone stays accurate.

## Commit & PR conventions

- **Branches:** work on a feature branch, never on `main`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org) —
  a type prefix (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `ci:`, …) and a
  short imperative subject. A `commit-msg` hook runs commitlint to enforce it,
  and release-please reads these types to drive versioning. Keep commits focused.
- **PRs:** fill in the template (what/why + the gate checklist). CI runs
  lint · typecheck · test on every PR and must pass.

## Never commit secrets

`.env`, `*.env`, and `openrouter-key.env` are gitignored. Keys live in the
environment. Tests and docs use obvious placeholders (`sk-or-test`,
`sk-or-v1-xxxxxxxx`) — never a real key. See [SECURITY.md](.github/SECURITY.md).

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
