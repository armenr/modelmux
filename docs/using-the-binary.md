# Using the modelmux binary

The prebuilt binary is one self-contained file. The runtime is baked in, so it
needs no Bun, Node, DevBox, or Docker to run. Download it, mark it executable,
run it.

To build from source, run the test/lint gates, or contribute, see
[development.md](development.md) instead.

## What it is

- A single executable, around 60 MB, with its runtime included.
- `routes.toml` is embedded at compile time. On first run, if the working
  directory has no routes config, the binary writes the embedded default and
  keeps going.
- No toolchain to install and no separate config to fetch.

## Get it

Download the asset for your platform from the Releases page:

| Platform | Asset |
|----------|-------|
| Linux x64 | `modelmux-linux-x64` |
| Linux arm64 | `modelmux-linux-arm64` |
| macOS x64 | `modelmux-darwin-x64` |
| macOS arm64 | `modelmux-darwin-arm64` |
| Windows x64 | `modelmux-windows-x64.exe` |

On Linux and macOS, mark it executable and (optionally) rename it:

```bash
chmod +x modelmux-darwin-arm64
mv modelmux-darwin-arm64 modelmux
```

The rest of this document calls the binary `modelmux`.

## Run it

Start the proxy with no arguments, or with `serve` (identical):

```bash
modelmux
```

```bash
modelmux serve
```

It listens on `$PORT` (default `8787`) and prints the listening line:

```text
modelmux listening on http://localhost:8787
```

The proxy watches `routes.toml` while running. Edits apply live without a
restart. An invalid edit is rejected and the last good config is kept.

## First run: routes.toml

Before running any command, the binary checks for the routes config at
`$MUX_ROUTES` (default `./routes.toml`). If it is missing, the binary writes the
embedded default to that path and prints to stderr:

```text
[modelmux] wrote default routes.toml (edit it to change models)
```

This happens on the first `serve` and on the first `models`, `set`, `use`, or
`check-latest`. A first `serve` in an empty directory prints:

```text
[modelmux] wrote default routes.toml (edit it to change models)
modelmux listening on http://localhost:8787
```

The file lands in the current working directory (or at `$MUX_ROUTES` if set).
Its `[models]` table is what you edit to change which model each alias points at:

```toml
[models]
orchestrator = "anthropic:passthrough" # main chat — keep the model CC picked
flagship = "openrouter:z-ai/glm-5.2"
max = "openrouter:qwen/qwen3.7-max"
reasoner = "openrouter:deepseek/deepseek-v4-pro"
review = "openrouter:minimax/minimax-m3"
cheap = "openrouter:deepseek/deepseek-v4-flash"
claude-review = "anthropic:claude-sonnet-5"
```

Edit the file directly, or use the `set` subcommand below.

## Subcommands

Running with no arguments starts the proxy. The subcommands below manage
`routes.toml`. An unrecognized command prints the command list and exits 0:

```text
commands: serve | models | set <alias> <upstream:slug> | use <agent> <alias> | check-latest
```

### models

Print the alias table read from `routes.toml`:

```bash
modelmux models
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

Rewrite one alias value in `routes.toml`, preserving the rest of the file:

```bash
modelmux set flagship openrouter:z-ai/glm-5.2
```

```text
set flagship -> openrouter:z-ai/glm-5.2
```

Missing arguments print usage and exit 1:

```text
usage: modelmux set <alias> <upstream:slug>
```

### use

Retarget an agent by rewriting the `<<route:...>>` tag inside
`.claude/agents/<agent-name>.md`:

```bash
modelmux use glm-researcher max
```

```text
agent glm-researcher now uses <<route:max>>
```

This requires a project layout with a `.claude/agents/<agent-name>.md` file. A
binary run outside such a project has no agents directory, and `use` will fail.
Use `models` and `set` for config that works in any directory.

### check-latest

Compare the OpenRouter slugs in `routes.toml` against OpenRouter's live catalog
(public endpoint, no key required):

```bash
modelmux check-latest
```

```text
Checked 5 OpenRouter model(s) against 343 live catalog entries:

  ✓ flagship       z-ai/glm-5.2
  ✓ max            qwen/qwen3.7-max
  ✓ reasoner       deepseek/deepseek-v4-pro
  ✓ review         minimax/minimax-m3
  ✓ cheap          deepseek/deepseek-v4-flash

All configured OpenRouter slugs exist in the live catalog.
```

A stale slug is marked with `✗` and, where possible, same-family replacements
are suggested. Exit code is 1 if any slug is stale or the catalog is
unreachable, 0 if all are present or none are configured. The catalog entry
count varies over time.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | Listen port. Reflected in the listening line. |
| `MUX_ROUTES` | `./routes.toml` | Path to the routes config. Also the first-run bootstrap target. |
| `MUX_LOG` | `./decisions.jsonl` | Path to the JSONL decision log. |
| `OPENROUTER_API_KEY` | unset | Required for any `openrouter:` route; if a request routes to OpenRouter while it is unset, that request fails with HTTP 400. |
| `MUX_MODEL_<ALIAS>` | unset | Override one alias for a single run. |

For `MUX_MODEL_<ALIAS>`, uppercase the alias and replace hyphens with
underscores: `flagship` becomes `MUX_MODEL_FLAGSHIP`, `claude-review` becomes
`MUX_MODEL_CLAUDE_REVIEW`. The value is a full `upstream:slug` spec:

```bash
MUX_MODEL_FLAGSHIP=openrouter:qwen/qwen3.7-max modelmux
```

The override applies to that run only and does not change `routes.toml`.

## Point Claude Code at it

Claude Code sends requests to `modelmux` when `ANTHROPIC_BASE_URL` points at the
proxy:

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8787
```

Claude Code reads this value once at startup, so restart Claude Code after
setting it. `modelmux` does not read `ANTHROPIC_BASE_URL`; Claude Code does.

## How routing is logged

Each proxied request appends one JSON line to the decision log at `$MUX_LOG`
(default `./decisions.jsonl`), recording the routing decision. Routing and auth
errors are written to the same file. Point `MUX_LOG` elsewhere to change the
location.

## Upgrading

Download the newer asset for your platform from Releases, mark it executable,
and replace the old file:

```bash
chmod +x modelmux-darwin-arm64
mv modelmux-darwin-arm64 modelmux
```

Your `routes.toml` and `decisions.jsonl` are separate files on disk and are not
touched by replacing the binary.

## Troubleshooting

- **HTTP 400 with body `OPENROUTER_API_KEY is not set but a route needs
  OpenRouter`** — a request routed to OpenRouter but the key is unset in the
  environment where `modelmux` runs. Set `OPENROUTER_API_KEY` and restart the
  binary.
- **Claude Code reports connection refused** — `modelmux` is not running, or it
  is on a different port than `ANTHROPIC_BASE_URL`. Start it and confirm the
  listening line matches the base URL.
- **A subagent is still answered by Claude** — Claude Code was not restarted
  after setting `ANTHROPIC_BASE_URL`. That variable is read once at startup;
  restart Claude Code.
