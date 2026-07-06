# hetero-agents — Design Spec

**Date:** 2026-06-27
**Status:** Approved for planning
**Author:** brainstormed with Claude (Opus 4.8)

## 1. What this is

A SOLID, self-contained, **batteries-included starter-kit / template repo** demonstrating a reusable pattern: in Claude Code, the **main orchestrator stays on Claude (Anthropic)** while **specific spawned subagents — including agents spawned by dynamic Workflows — run on other models (GLM, Qwen, DeepSeek, MiniMax, …) via OpenRouter.**

### Three hard objectives
1. **Exemplar / repeatable template** — someone clones it and has a working heterogeneous setup they can copy the pattern from.
2. **Reproducible across git clones for a broad audience** — achieved with **Jetify DevBox** (Nix-pinned, self-contained workspace).
3. **Verified with tests** — anything we assume is proven by tests, especially "subagents actually hit the alternate model and the orchestrator hits Claude."

## 2. Verified facts & constraints (June 2026)

These were established by live research + adversarial verification + direct binary inspection. They are load-bearing for the design.

- **Claude Code has no native non-Anthropic provider support** (only Anthropic models via Bedrock/Vertex/Foundry).
- **`ANTHROPIC_BASE_URL` is global** — it redirects *all* traffic (orchestrator + every subagent) to one endpoint; per official docs it "changes where requests are sent, not which model answers them." → heterogeneous routing must happen **inside a proxy**, keyed per-request.
- **Routing signals actually available** (binary-verified in installed `claude` v2.1.195):
  - `x-claude-code-agent-id` + `x-claude-code-parent-agent-id` headers are emitted **only on subagent requests** (value is a hashed/opaque per-spawn id — **no readable name/type**). → reliable **orchestrator-vs-subagent** discriminator.
  - `x-app: cli` vs `cli-bg` → background/auxiliary discriminator.
  - Work-type is inferable from the body: `thinking` field present, token count > threshold, a tool whose `type` starts with `web_search`.
  - The `model` string is subject to **bug #43869** (subagent model silently falls back to parent) — **not** a reliable routing signal on its own.
  - The agent's **definition body becomes its system prompt** → matchable; this enables an **explicit sentinel tag** as the robust per-agent mechanism.
- **OpenRouter exposes an Anthropic-Messages-compatible endpoint** (`https://openrouter.ai/api`) → the proxy needs **no format translation**, only routing + auth/model swap + SSE passthrough.
- **GLM 5.2** = `z-ai/glm-5.2` (latest+biggest GLM). Model menu verified — see §6.
- **Claude Code here is authed via subscription/OAuth** (`~/.claude.json`), not an env API key. → the proxy can pass that auth through on the Claude leg; only the OpenRouter leg needs `OPENROUTER_API_KEY`. **Caveat to verify in the live test:** some CC versions refuse to send the OAuth token under a custom `ANTHROPIC_BASE_URL`; if so, the Claude leg needs an `ANTHROPIC_API_KEY`.

## 3. Decision: routing layer = thin owned proxy

Chosen over claude-code-router and LiteLLM because objectives #1 (exemplar/transparency) and #3 (test-verifiability) both favor owning a small, legible, fully-testable routing layer. DevBox neutralizes the reproducibility advantage the third-party tools would otherwise have. Because OpenRouter speaks Anthropic format, "owning a proxy" does **not** mean owning translation — only routing + passthrough.

- **Out of scope (v1):** Z.ai-native endpoint, LiteLLM path, Anthropic↔OpenAI format translation, budgets/observability.

## 4. Architecture

```
                          ┌─────────────────────────────────────┐
  Claude Code  ──────────▶│  hetero-proxy (Bun/TS, ~150 LOC)     │
  ANTHROPIC_BASE_URL      │  signals → route() → rewrite → fwd    │
  → 127.0.0.1:PORT        │                                       │
   orchestrator turn ─────┼──▶ no agent-id header ────────────────┼──▶ api.anthropic.com   (Claude; auth passthrough)
   tagged GLM subagent ───┼──▶ <<route:flagship>> ────────────────┼──▶ openrouter.ai/api   (z-ai/glm-5.2; OpenRouter key)
   work-type / any-sub ───┼──▶ cascade match ────────────────────┼──▶ chosen upstream
                          │  + append structured DECISION LOG     │  ← tests assert against this
                          └─────────────────────────────────────┘
```

## 5. Model assignment (the "mix & match" model)

Two layers in `routes.jsonc`: a **named `models` menu** (alias → `upstream:slug`) and an ordered **`routes` cascade** (first match wins). The operator edits one file; aliases are referenced everywhere so swapping a model is a one-line change.

### Granularity tiers (honest reliability)
| Tier | Match on | Mechanism | Ship |
|---|---|---|---|
| 0 Default | orchestrator | no agent-id header | stable |
| 1 Any-subagent | all workers | `x-claude-code-agent-id` present | stable |
| 2 Work-type | background/think/longContext/webSearch | body + `x-app` inspection | stable |
| 3 Per-agent (tag) | a specific agent | **operator-written `<<route:ALIAS>>` in the agent prompt** | **stable** |
| 4 Per-agent (model sentinel) | by `body.model` | model-string match | experimental (#43869) |
| 5 Per-agent (id/session map) | opaque id/session | out-of-band map | experimental |

Per-agent-type "by name" is **not** auto-detectable (no name signal); Tier 3 (explicit tag) is the robust path and doubles as the selectivity control (untagged agents fall through to the cascade / Claude).

### `routes.jsonc` shape
```jsonc
{
  "models": {
    "orchestrator": "anthropic:passthrough",  // keep whatever model Claude Code picked (opus/sonnet/haiku)
    "flagship":     "openrouter:z-ai/glm-5.2",
    "max":          "openrouter:qwen/qwen3.7-max",
    "reasoner":     "openrouter:deepseek/deepseek-v4-pro",
    "review":       "openrouter:minimax/minimax-m3",
    "cheap":        "openrouter:deepseek/deepseek-v4-flash",
    "claude-review":"anthropic:claude-sonnet-4.6"
  },
  "default": "orchestrator",
  "routes": [
    { "when": { "tag": "flagship" },            "use": "flagship" },
    { "when": { "tag": "review"   },            "use": "review"   },
    { "when": { "workType": "background" },      "use": "cheap"    },
    { "when": { "anySubagent": true },           "use": "flagship" }
  ]
}
```

## 6. Verified model menu (June 2026)

All slugs resolve live on OpenRouter and support tool-calling. Prices = USD/1M (in/out), **cheapest-endpoint** — re-verify per the always-latest rule.

| Alias | Slug | ctx | $/1M | Role |
|---|---|---|---|---|
| orchestrator | `anthropic:passthrough` | — | Claude plan | main chat — keeps the model CC picked (e.g. opus-4.8) |
| flagship | `z-ai/glm-5.2` | 1.05M | 0.95 / 3.00 | heavy coding |
| max | `qwen/qwen3.7-max` | 1M | 1.25 / 3.75 | highest-capability generalist |
| reasoner | `deepseek/deepseek-v4-pro` | 1M | 0.435 / 0.87 | deep reasoning, cheap |
| review | `minimax/minimax-m3` | 1M* | 0.30 / 1.20† | multimodal + web research |
| cheap | `deepseek/deepseek-v4-flash` | 1M | 0.09 / 0.18 | high-volume utility |
| claude-review | `anthropic:claude-sonnet-4.6` | 1M | 3 / 15 | selectivity control |

\* MiniMax context varies by endpoint (512K first-party → 1.05M Parasail). † promo price; standard 0.60/2.40, doubles above 512K ctx.

## 7. Proxy internals

**Runtime: Bun** (chosen 2026-06-27 over Node/Deno — single binary, native TS no build step, `bun:test`, `.env` autoload → near-zero deps). Core is a web-standard `(req: Request) => Response` handler; SSE passthrough is `new Response(upstream.body, …)`. **Critical caveat:** `Bun.serve`'s 10s default idle timeout kills quiet SSE streams → set `idleTimeout: 0` (or `server.timeout(req, 0)` per-request) and test that a quiet stream survives.

| File | Responsibility | Pure? |
|---|---|---|
| `config.ts` | load `routes.jsonc` + env overrides; resolve menu; hot-reload on file change | impure |
| `signals.ts` | extract `{agentId, xApp, requestedModel, systemHead, hasThinking, tokensIn, hasWebSearch, tag}` from a request | **pure** |
| `route.ts` | `route(signals, config) → {alias, upstream, model, matchedRule}` cascade | **pure** |
| `server.ts` | receive → signals → route → rewrite (auth/model/betas) → forward (SSE passthrough) → log | impure |
| `log.ts` | append structured decision record (JSONL + stderr) | impure |

- **Cascade:** first-match-in-array-order (transparent over implicit specificity); shipped default ordered tag → workType → anySubagent → default.
- **Auth swap:** Claude leg = pass through Claude Code's own auth (subscription/OAuth) unchanged; OpenRouter leg = inject `OPENROUTER_API_KEY` as `Authorization: Bearer`.
- **Model swap:** rewrite `body.model` to resolved slug; `"passthrough"` keeps what CC sent (Claude legs).
- **Beta headers:** Claude leg = pass `anthropic-beta` unchanged (preserves caching); non-Anthropic leg = **strip `anthropic-beta` entirely (v1)** to avoid context-management/effort/task-budgets 400s. A configurable allow-list is noted as future hardening, not built in v1.
- **Streaming:** both upstreams emit Anthropic SSE → return `new Response(upstream.body, …)` to pipe the web `ReadableStream` straight through, no parsing. Set `idleTimeout: 0` so quiet streams aren't dropped.
- **Decision log** (the test seam):
  ```jsonc
  { "ts":"…","sessionId":"…","agentId":"0f3a…|null","isSubagent":true,"xApp":"cli",
    "requestedModel":"claude-sonnet-4-6","tokensIn":1234,"matchedRule":"tag:flagship",
    "upstream":"openrouter","resolvedModel":"z-ai/glm-5.2" }
  ```
- **Error handling — fail loud:** upstream 4xx/5xx passed through + logged; matched a GLM route but key missing / alias unknown → 400 with clear message + logged via `logError` (never silently fall back to Claude). v1 strips `anthropic-beta` entirely on the non-Anthropic leg, so no beta-retry is needed.
- **Hot-reload:** `config.ts` watches `routes.jsonc`; swaps in-memory snapshot live → enables `hetero set`.

## 8. Secrets & environment

- **This machine:** `OPENROUTER_API_KEY` is installed **globally** in `~/.zshenv` (user's explicit choice; covers all zsh shells). Proxy reads it from the environment.
- **Template default for cloners:** the proxy reads `OPENROUTER_API_KEY` (and optional `ANTHROPIC_API_KEY`) from the environment. Two documented options in the README: (a) **global env** (as done here) or (b) **repo-local `.env`** (gitignored, loaded by DevBox) for reproducibility. `.env.example` ships as the template.
- `.gitignore` must exclude `.env`, `*.env` (except `.env.example`), `openrouter-key.env`, and the decision-log output.

## 9. Easy switching mechanism

- **Named menu aliases** — change one slug, everything updates.
- **Hot-reload** — edit `routes.jsonc`, save, applied live (no restart).
- **`hetero` CLI:** `hetero models` (list bindings + ping OpenRouter for newer releases = freshness/always-latest), `hetero set <alias> <slug>`, `hetero use <agent> <alias>`.
- **Env overrides** — `HETERO_MODEL_FLAGSHIP=…` beats the file (CI matrices, zero-edit experiments).

## 10. Reproducibility (DevBox) + always-latest

- **DevBox** (`devbox.json` / `devbox.lock`) pins the toolchain (Bun, jq, lefthook, …) at latest-clean; `devbox shell` gives an identical env on any clone. `.env` is loaded via the `env_from: "./.env"` key; a globally-exported `OPENROUTER_API_KEY` also passes through (except under `--pure`).
- **Lint/format: ESLint only, no prettier.** `@antfu/eslint-config` (flat config) lints + formats all file types (`.ts`/`.md`/`.yml`/`.json`/`.jsonc`/`.toml`) via ESLint Stylistic + per-language plugins; the prettier-backed `formatters` option is omitted. **lefthook** runs `eslint --fix` on staged files (`pre-commit`) and `bun test` (`pre-push`); CI runs lint too.
- **Standing rule:** always install the latest dep/tool versions (avoid day-1 rot). A `check-latest` script flags newer model releases and dep updates.

## 11. Testing strategy (objective #3)

Layered — hermetic CI without secrets, full proof opt-in.

1. **Unit:** `route()` + `signals()` pure functions — every tier, matcher, edge case.
2. **Integration (CI, zero secrets):** boot the proxy against two **fake upstreams**; **replay recorded real Claude Code requests** (captured once by `record-fixtures`) → assert the decision log. Fixtures: orchestrator turn, tagged GLM subagent, Claude control agent.
3. **Live smoke (opt-in, real keys):** `claude -p` drives a real session that (a) answers directly, (b) spawns a `<<route:flagship>>` subagent, **(c) spawns agents from a dynamic Workflow** → assert the decision log shows orchestrator→Claude and *both* the static subagent **and the workflow agents**→GLM. Empirically settles the OAuth-passthrough question and bug #43869 for the installed CC version.
4. **Freshness:** `check-latest` as a (non-blocking) test surfacing newer models/deps.

## 12. Repo layout

```
hetero-agents/
├── devbox.json / devbox.lock
├── package.json / tsconfig.json  # Bun, ESM, native TS (no build)
├── eslint.config.mjs             # Antfu flat config — lint+format all, no prettier
├── lefthook.yml                  # pre-commit eslint --fix; pre-push bun test
├── .env.example                  # OPENROUTER_API_KEY, optional ANTHROPIC_API_KEY, PORT
├── .gitignore
├── README.md                     # setup (global env OR repo .env), clone instructions
├── routes.jsonc                  # the model menu + cascade (operator-edited)
├── src/{types,jsonc,config,signals,route,upstreams,log,server}.ts
├── test/{jsonc,config,signals,route,upstreams,log,integration,replay,cli}.test.ts + fixtures/
├── .claude/
│   ├── settings.json             # ANTHROPIC_BASE_URL → proxy
│   └── agents/{glm-researcher,minimax-reviewer,claude-control}.md
├── scripts/{record-fixtures,live-smoke,check-latest}.ts
├── bin/hetero                    # the switching CLI
└── .github/workflows/ci.yml      # gate + hermetic (no secrets) + live (secret-gated)
```

## 13. Risks / to verify during implementation
- **OAuth passthrough** under custom `ANTHROPIC_BASE_URL` (may force an `ANTHROPIC_API_KEY` for the Claude leg) — live test settles it.
- **Bug #43869** affecting any model-string-based tiers — Tier 3 (tag) is the mitigation; tests report what works on the installed CC version.
- **Beta-header allow-list** — exact set that non-Anthropic upstreams reject may need tuning; integration fixtures should include current beta headers.
- **Model-id / price drift** — re-verify slugs before relying on them (always-latest).
- **Bun SSE idle timeout** — `Bun.serve` drops quiet streams after 10s unless `idleTimeout: 0`; covered by a dedicated test asserting a delayed-chunk stream survives.
