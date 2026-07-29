// An upstream name. "anthropic", "openrouter", and "zai" are built in; more can
// be defined in the [upstreams] table of routes.toml (e.g. a local model server).
export type Upstream = string;

// How modelmux authenticates the outbound leg to an upstream.
export type AuthMode
  = | { kind: "passthrough"; envKey?: string } // forward Claude Code's own inbound auth; if envKey is set and present, send it as x-api-key instead
    | { kind: "bearer"; envKey: string } // Authorization: Bearer <env[envKey]>
    | { kind: "codex"; path?: string } // read the Codex CLI's own OAuth credentials (default ~/.codex/auth.json)
    | { kind: "none" }; // send no auth (e.g. a local model server)

// The wire format an upstream speaks. "anthropic" forwards untouched (the
// default and the fast path); "openai" routes the request and response through
// the Chat Completions adapter in openai.ts; "responses" through the Responses
// adapter in responses.ts (OpenAI's newer schema — different request shape,
// FLAT tools, and named SSE events rather than delta chunks).
export type WireFormat = "anthropic" | "openai" | "responses";

// Which token-cap field the OpenAI-format leg should send. There is no safe
// universal default: OpenAI's newer models REJECT `max_tokens` outright
// ("Unsupported parameter"), while support for `max_completion_tokens` across
// local runners is still uneven. Only meaningful when format is "openai".
export type MaxTokensField = "max_tokens" | "max_completion_tokens";

export interface UpstreamDef {
  base: string; // base URL, e.g. https://api.anthropic.com or http://localhost:11434
  auth: AuthMode;
  stripBeta: boolean; // drop anthropic-beta — non-Anthropic endpoints don't understand Claude Code's betas
  format: WireFormat;
  maxTokensField: MaxTokensField;
  // The ChatGPT-subscription Codex backend is NOT generic Responses. Measured
  // against it 2026-07-25, it rejects three otherwise-legal request shapes:
  //   store: true / absent -> 400 "Store must be set to false"
  //   stream: false        -> 400 (subscription OAuth is SSE-ONLY; there is no
  //                          non-streaming mode at all)
  //   instructions empty   -> 400 (must be a non-empty string)
  // and its terminal `response.completed` event carries an EMPTY `output` array,
  // so a non-streaming reply must be aggregated from the per-item events rather
  // than read off the completed event. Off by default: a self-hosted or Azure
  // Responses endpoint has none of these constraints.
  codexSubscription?: boolean;
  // Vendor-specific request fields modelmux does not model, merged into the
  // OUTBOUND body after wire-format translation. Applied last, so it can impose
  // a value the caller never sent — which is the point: Claude Code has no way
  // to express `reasoning_effort`, and the depth knob is per-upstream policy.
  //
  // Measured 2026-07-29 against Z.ai: `reasoning_effort` is validated on their
  // OpenAI-format endpoints (400 on a bad value, listing the allowed set) and
  // SILENTLY DROPPED on their Anthropic-compatible one. So imposing depth means
  // routing over `format = "openai"` AND injecting the field — neither alone.
  extraBody?: Record<string, unknown>;
  // Absolute path for OpenAI-format requests, replacing the derived
  // `/v1/chat/completions`. OpenAI's convention is `<base>/v1/chat/completions`,
  // but a provider whose base already carries the version needs the `/v1`
  // dropped — Z.ai's Coding Plan endpoint is `<...>/paas/v4/chat/completions`,
  // and the derived path yields `/paas/v4/v1/chat/completions` -> 404 (measured).
  // Explicit override rather than magic-stripping a version segment.
  chatPath?: string;
  // RAISE-ONLY floor for the outbound token cap. Deliberately NOT `extraBody`:
  // that overwrites unconditionally, so a floor built there would CLAMP DOWN a
  // caller who asked for more — the opposite of a floor.
  //
  // Why a floor is needed at all, measured 2026-07-29 against GLM at max effort:
  // `max_tokens` is a CEILING, not a reservation (caps of 32000/64000/98304 on a
  // trivial prompt consumed 2/2/3 tokens), so a generous cap is free. But a cap
  // hit MID-REASONING returns a `thinking` block with NO `text` block — the
  // reasoning is billed and no answer arrives. Measured: 6000 -> truncated, no
  // verdict; 24000 -> 19322 used, stop_reason end_turn. A truncated review does
  // not look truncated; it looks like the reviewer found nothing.
  minMaxTokens?: number;
}

export interface ModelRef {
  upstream: Upstream;
  slug: string; // concrete slug, or "passthrough" to keep what Claude Code sent
}

export type WorkType = "background" | "think" | "longContext" | "webSearch";

export interface RouteRule {
  when: { tag?: string; workType?: WorkType; anySubagent?: boolean };
  use: string; // an alias key into Config.models
}

export interface Config {
  models: Record<string, ModelRef>;
  default: string; // alias used when no route matches (the orchestrator)
  routes: RouteRule[];
  longContextThreshold: number;
  upstreams?: Record<string, UpstreamDef>; // built-ins merged with any [upstreams] overrides; falls back to built-ins when absent
}

export interface Signals {
  agentId: string | null; // x-claude-code-agent-id (subagent marker)
  sessionId: string | null; // x-claude-code-session-id (for log correlation)
  isSubagent: boolean; // agentId !== null
  xApp: string | null; // "cli" | "cli-bg"
  requestedModel: string | null; // body.model (NOT used for per-agent routing)
  systemText: string; // concatenated system-prompt text (for tag matching)
  tag: string | null; // parsed <<route:ALIAS>>
  hasThinking: boolean; // body.thinking present
  tokensIn: number; // rough token estimate of the request
  hasWebSearch: boolean; // a tool whose type starts with "web_search"
}

export interface Decision {
  alias: string;
  upstream: Upstream;
  model: string; // resolved slug or "passthrough"
  matchedRule: string; // "tag:flagship" | "workType:background" | "anySubagent" | "default"
}

// Anthropic's token-usage shape, the target of every adapter's usage mapping.
export interface Usage {
  input_tokens: number;
  output_tokens: number;
}
