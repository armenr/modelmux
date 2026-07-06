# Developing modelmux from source

Run the proxy from a git checkout, run the gates, and build the binary. If you
only want to download and run the compiled binary, the [README](../README.md)
covers that. For branching, commits, and PR conventions, see
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Prerequisites

- [Bun](https://bun.sh) — the runtime, package manager, test runner, and
  compiler. Required.
- Optional: [DevBox](https://www.jetify.com/devbox) for a Nix-pinned toolchain
  (`bun@latest`, `jq@latest`, `lefthook@latest`). Bun-direct works without it.

Everything from-source runs on Bun. `bun run proxy` and `bin/mux` are the two
entry points; you do not use the compiled binary during development.

## Setup

```bash
bun install                 # dev deps, from bun.lock
cp .env.example .env        # then edit .env and set OPENROUTER_API_KEY
```

`.env` is gitignored. `OPENROUTER_API_KEY` is required for any `openrouter:`
route; `PORT` and `ANTHROPIC_API_KEY` are optional (see [Environment
variables](#environment-variables)).

Install the git hooks (pre-commit lint + pre-push tests):

```bash
lefthook install
```

Or use DevBox, which loads `.env`, pins the toolchain, and runs `lefthook
install` on shell entry:

```bash
devbox shell
```

DevBox exposes its own `devbox run` scripts (`proxy`, `test`, `test:live`,
`lint`, `lint:fix`, `typecheck`, `mux`, `record`); they mirror the `bun run`
scripts below (its `lint` and `typecheck` go through `bunx`).

## Running from source

```bash
bun run proxy
```

This runs `src/server.ts` (`startProxy`) — the same proxy the compiled binary
serves. It prints:

```text
modelmux listening on http://localhost:8787
```

Unlike the binary, `bun run proxy` does **not** self-bootstrap `routes.toml`. A
checkout already ships `routes.toml`, so it is read directly. If the file
referenced by `MUX_ROUTES` is missing, `loadConfig` throws `ENOENT` rather than
writing a default.

`routes.toml` is watched for hot-reload: edits apply live without a restart. A
malformed edit is rejected and the last good config is kept.

## The dev CLI (bin/mux)

`bin/mux` is a thin wrapper over the same dispatcher (`runCli`) the binary uses.
It has **no `serve` subcommand** and no first-run bootstrap — to serve in dev,
use `bun run proxy`. `bin/mux serve` falls through to the `commands:` help.

`bun run mux` is a package.json alias for `bun run bin/mux`.

### models

Print the alias table read from `MUX_ROUTES` (default `routes.toml`):

```bash
bin/mux models
```

```text
alias            upstream:slug
  orchestrator     anthropic:passthrough
  flagship         openrouter:z-ai/glm-5.2
  max              openrouter:qwen/qwen3.7-max
  reasoner         openrouter:deepseek/deepseek-v4-pro
  review           openrouter:minimax/minimax-m3
  cheap            openrouter:deepseek/deepseek-v4-flash
  claude-review    anthropic:claude-sonnet-5
```

### set

Rewrite one alias's target in `routes.toml` (the rest of the file is preserved):

```bash
bin/mux set flagship openrouter:z-ai/glm-5.2
# set flagship -> openrouter:z-ai/glm-5.2
```

Missing arguments exit 1 with `usage: modelmux set <alias> <upstream:slug>`. An
invalid spec or unknown alias is not handled gracefully — it throws an uncaught
exception (stack trace to stderr, nonzero exit).

### use

Retarget an agent by rewriting the first `<<route:...>>` tag in
`.claude/agents/<agent-name>.md`:

```bash
bin/mux use glm-researcher flagship
# agent glm-researcher now uses <<route:flagship>>
```

Missing arguments exit 1 with `usage: modelmux use <agent-name> <alias>`. The
target `.claude/agents/<name>.md` must exist; a missing file throws an uncaught
`ENOENT`. `use` only makes sense inside a project with a `.claude/agents/`
layout.

### check-latest

Verify configured `openrouter:` slugs still exist in the live catalog:

```bash
bin/mux check-latest
```

Fetches OpenRouter's public catalog (`https://openrouter.ai/api/v1/models`, no
key) and prints a per-model report, with same-family suggestions for stale
slugs. Exit 1 if any slug is stale or the catalog is unreachable; exit 0 if all
present or none configured. The default `routes.toml` ships placeholder slugs,
so run this before your first live call.

## Environment variables

These apply to both `bun run proxy` and the compiled binary.

| Variable | Meaning | Default |
| --- | --- | --- |
| `PORT` | Proxy listen port. Reflected in the `modelmux listening on ...` line. | `8787` |
| `MUX_ROUTES` | Path to the routes TOML config. | `./routes.toml` |
| `MUX_LOG` | Path to the JSONL decision log written per request. | `./decisions.jsonl` |
| `OPENROUTER_API_KEY` | Required for any `openrouter:` route. | unset |
| `MUX_MODEL_<ALIAS>` | Per-run override of one alias's target (uppercase alias, hyphens to underscores; value is a full `upstream:slug`). | unset |
| `ANTHROPIC_API_KEY` | If set, used as `x-api-key` on the anthropic leg; otherwise Claude Code's inbound auth is forwarded. | unset |

If a request routes to OpenRouter and `OPENROUTER_API_KEY` is unset, the request
fails HTTP 400 with the body:

```text
OPENROUTER_API_KEY is not set but a route needs OpenRouter
```

Override one alias for a single run without editing `routes.toml`:

```bash
MUX_MODEL_FLAGSHIP=openrouter:qwen/qwen3.7-max bun run proxy
```

The alias `flagship` becomes `MUX_MODEL_FLAGSHIP`; `claude-review` becomes
`MUX_MODEL_CLAUDE_REVIEW`.

## Gates

```bash
bun run lint        # eslint . — lints and formats (@antfu/eslint-config)
bun run lint:fix    # eslint . --fix
bun run typecheck   # tsc --noEmit
bun test test/      # hermetic test suite, no network
bun run check       # lint && typecheck && bun test test/ in sequence
```

`bun run lint` also formats (ESLint Stylistic; no prettier/dprint) and covers
`ts`, `md`, `yml`, `json`, `jsonc`, and `toml`.

The live smoke test makes a real, billable end-to-end call:

```bash
bun run test:live
```

It boots the proxy in-process, sends a `flagship`-tagged subagent request, and
expects HTTP 200 from OpenRouter. It skips with exit 0 if `OPENROUTER_API_KEY`
is unset.

The `lefthook` hooks run automatically: `commit-msg` runs commitlint
(Conventional Commits); `pre-commit` runs `eslint --fix` on staged files
(staging the fixes back); `pre-push` runs `bun test test/`.

## Building the binary

```bash
bun run build
```

This runs `bun build --compile --minify src/main.ts --outfile dist/modelmux`,
producing a self-contained `dist/modelmux` (~63 MB) with the Bun runtime baked
in and `routes.toml` embedded at compile time. The binary needs no Bun, Node,
DevBox, or Docker to run; see the [README](../README.md) for how to use it.

Releases are automated by
[release-please](https://github.com/googleapis/release-please): conventional
commits on `main` open a release PR, and merging it tags the release. The same
[.github/workflows/release.yml](../.github/workflows/release.yml) run then
cross-compiles `bun-linux-x64`, `bun-linux-arm64`, `bun-darwin-x64`,
`bun-darwin-arm64`, and `bun-windows-x64` into `dist/modelmux-*` (with `.exe`
for Windows), writes `SHA256SUMS`, and uploads them to the release. Releases
are never tagged by hand.

## Pointing Claude Code at the source-run proxy

Claude Code reads `ANTHROPIC_BASE_URL` and sends its requests there. The repo
ships `.claude/settings.json.example`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8787"
  }
}
```

Copy it into place and restart Claude Code (the env var is read once at
startup):

```bash
cp .claude/settings.json.example .claude/settings.json
```

Keep `PORT` and the port in `settings.json` in sync (both default to `8787`).
With `bun run proxy` running, Claude Code's subagent requests are routed
per `routes.toml`.

## Contributing

TDD loop, commit conventions, and PR workflow live in
[CONTRIBUTING.md](../CONTRIBUTING.md).
