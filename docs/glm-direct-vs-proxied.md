# GLM through Claude Code: direct, or through modelmux?

You do not need modelmux to run Claude Code on a Z.ai GLM subscription. Pointing
`ANTHROPIC_BASE_URL` at Z.ai's Anthropic-compatible endpoint works, and on reasoning depth
it works *better than you would expect*. This page says exactly what each path buys, so the
choice is made on measurements rather than on the assumption that a proxy must be an upgrade.

Everything here was measured against the live endpoints. Z.ai's documentation does not
mention `/api/anthropic` at all, so none of this could be read off a doc page.

> **Verified 2026-07-31 against `glm-5.2`.** Endpoints, defaults and model availability move.
> Re-run the checks below rather than trusting this table's age.

---

## The short answer

| you want | use |
|---|---|
| GLM for a whole Claude Code session, deepest reasoning, zero setup | **direct** |
| a *chosen* reasoning level (`minimal`…`max`) | **modelmux** |
| GLM for *some* subagents while the orchestrator stays on Claude | **modelmux** |
| per-request routing, or a decision log of which model served what | **modelmux** |

**Direct is not the poor cousin.** For a plain "put me on GLM" session it is the better
choice: less machinery, and — measured — the deepest reasoning available on that endpoint.

---

## The three Z.ai endpoints, and why it matters

| endpoint | billing | wire format | `reasoning_effort` |
|---|---|---|---|
| `/api/anthropic` | subscription | **Anthropic** | **silently dropped** |
| `/api/coding/paas/v4` | subscription | OpenAI Chat Completions | validated + honoured |
| `/api/paas/v4` | **metered** | OpenAI Chat Completions | validated + honoured |

Claude Code speaks the Anthropic wire format, so a direct session can only reach the first
row. The named effort levels live on the second — which is the entire reason a translating
proxy exists in this project.

`/api/paas/v4` returns *"Insufficient balance"* on a Coding Plan key: it is the pay-per-token
API, not your subscription. It is also the endpoint Z.ai's docs lead with, which makes it an
easy wrong turn.

---

## Reasoning depth on the direct path

### Claude Code sends one thing, and its keywords do not change it

Captured off the wire across `plain` / `"think hard"` / `"ultrathink"` prompts — 35 requests,
two distinct payloads:

```
thinking={"type":"adaptive","display":"omitted"}    (21 requests)
thinking=null                                       (14 requests)
```

**The think/ultrathink keywords produce no wire difference on this backend.** No
`budget_tokens`, no escalation. You get `adaptive` or nothing.

### `adaptive` is the deepest setting, not a compromise

Measured on a prompt that genuinely requires extended reasoning, so the ceiling is the
model's rather than the task's:

| `thinking` sent | thinking chars | output tokens | wall time |
|---|---|---|---|
| *(none — control)* | 0 | 1,101 | 18s |
| **`{"type":"adaptive"}`** ← Claude Code's default | **39,613** | **13,170** | 194s |
| `{"type":"enabled", "budget_tokens": 4000}` | 23,233 | 8,292 | 104s |
| `{"type":"enabled", "budget_tokens": 24000}` | 19,589 | 7,414 | 100s |

Two findings worth keeping:

1. **`adaptive` produced roughly double the reasoning of either explicit budget.** Setting
   `thinking` by hand made it *worse*. There is nothing to turn up.
2. **`budget_tokens` does not behave as a bound here.** A 4000 budget yielded more thinking
   than a 24000 one. It is accepted and does not do what Anthropic's semantics imply — do
   not use it to reason about cost or length.

`adaptive` also scales with difficulty: the same parameter on a trivial prompt produced
~1,100 thinking chars rather than 39,600. That is the point of it, and it is why a fixed
budget is the wrong tool on this endpoint.

### `reasoning_effort` is silently ignored

The graduated `minimal | low | medium | high | xhigh | max` scale is real, but not here.
Confirmed with the invalid-value discriminator — a `200` on garbage proves the field is being
dropped rather than read:

```
reasoning_effort="max"      -> 200, zero thinking
reasoning_effort="banana"   -> 200, zero thinking     <- the tell
```

On `/api/coding/paas/v4` the same field is validated and honoured (a bad value 400s, and
`minimal` → 0 reasoning chars vs `max` → thousands on an identical prompt). **That
difference is what modelmux translates for.**

### One sharp edge either way

An **unrecognised `thinking.type` is silently treated as OFF**, not rejected:
`{"type":"banana"}` returns `200` with zero thinking. If you ever hand-set this, a typo costs
you all reasoning with no error anywhere.

---

## Running direct

Key in a `0600` file, never inline:

```bash
claude-glm() {
  local key
  key=$(sed -n 's/^ZAI_API_KEY=["'\'']\?\([^"'\'']*\).*/\1/p' ~/.config/zai/env)
  [ -n "$key" ] || { echo "claude-glm: no ZAI_API_KEY" >&2; return 1; }
  env -u ANTHROPIC_API_KEY \
      ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic \
      ANTHROPIC_AUTH_TOKEN="$key" \
      ANTHROPIC_MODEL=glm-5.2 \
      ANTHROPIC_SMALL_FAST_MODEL=glm-5.2 \
      CLAUDE_CODE_MAX_CONTEXT_TOKENS=1000000 \
      claude "$@"
}
```

### Two variables that are load-bearing, and fail silently if omitted

**`env -u ANTHROPIC_API_KEY`.** If that variable is exported anywhere in your environment,
Claude Code **prefers it over your Z.ai config** and quietly bills a metered Anthropic
account. Proven with a same-run control: identical command died on *"Credit balance is too
low"* with it set, and succeeded on the subscription under `env -u`.

**`ANTHROPIC_MODEL`.** The base-URL override alone does *not* put you on GLM:

| | `modelUsage` reports |
|---|---|
| with `ANTHROPIC_MODEL=glm-5.2` | `['glm-5.2']` |
| without it | `['claude-opus-5[1m]']` |

Both returned a friendly, correct answer with `is_error: false`. Nothing indicates which one
you got. Pin `ANTHROPIC_SMALL_FAST_MODEL` too, or Claude Code's background work goes
somewhere you did not choose.

### `CLAUDE_CODE_MAX_CONTEXT_TOKENS` — worth 800K of context

Claude Code looks the context window up **by model name**. `glm-5.2` is not in its table, so
it falls back to a **200K default** and auto-compacts at ~160K — discarding most of the window
on every long session. The status line shows `200K` and looks like a fact about GLM. It is not;
it is Claude Code failing to recognise the model.

Measured both directions:

| | reported `contextWindow` |
|---|---|
| default | `200000` |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS=1000000` | `1000000` |

**And the endpoint genuinely serves it** — this is not just Z.ai's documented figure. A probe
of ~950K tokens returned `200` with `input_tokens=883,733` in 49.8s.

**Output has no equivalent.** Claude Code reports `maxOutputTokens: 32000` and
`CLAUDE_CODE_MAX_OUTPUT_TOKENS=128000` does **not** move it — measured, it clamps — even
though the endpoint accepts `max_tokens=131072` without complaint. Output stays capped at 32K
on this path and no override was found.

### Verify, every time

```bash
claude-glm -p --output-format json "hi" \
  | jq '.modelUsage | to_entries[] | {model: .key, ctx: .value.contextWindow}'
```

Expect `glm-5.2` with `ctx: 1000000`. A `claude-*` id means you are not on GLM; a `200000`
means the context override did not take.

---

## Running through modelmux instead

Take this path when you need something the direct one structurally cannot do:

```toml
routes = [ { when = { tag = "review" }, use = "reviewer" } ]

[models]
orchestrator = "anthropic:passthrough"
reviewer     = "zai-max:glm-5.2"

[upstreams]
zai-max = { base = "https://api.z.ai/api/coding/paas/v4", auth = "bearer:ZAI_API_KEY", \
            format = "openai", chatPath = "/chat/completions", \
            extraBody = { reasoning_effort = "max" }, minMaxTokens = 32000 }
```

What that buys, none of which the direct path can offer:

- **A chosen effort level** — `extraBody` injects `reasoning_effort` after wire translation.
- **Per-subagent routing** — orchestrator stays on Claude, tagged subagents go to GLM.
- **A decision log** — `decisions.jsonl` records which model actually served each request,
  which is the only reliable way to assert a leg rather than assume it.

`minMaxTokens` is a raise-only floor: at high effort, a cap hit mid-reasoning returns a
`thinking` block with **no answer**, billed, and it does not look truncated — it looks like
the model found nothing.

---

## Models

Verified `200` at `/api/anthropic`: **`glm-5.2`**, `glm-5-turbo`, `glm-4.7` (probed
2026-07-28; `glm-5.2` re-confirmed 2026-07-31).

Z.ai's GLM-5.2 docs claim 1M context / 128K max output. **Both partly confirmed here rather
than taken on faith:** an ~950K-token request was accepted (`input_tokens=883,733`), and
`max_tokens=131072` returns `200`. The output figure is academic on this path, since Claude
Code caps its own request at 32K regardless (above).

---

## Method note

Every "is this field honoured?" question here was settled with an **invalid-value
discriminator** rather than a plausible-looking success. A `200` on `reasoning_effort:
"banana"` proves the field is dropped; a `400` proves it is read. Where Z.ai's docs and the
endpoint disagreed, the endpoint won — and where a prediction and a measurement disagreed,
the measurement won, twice.
