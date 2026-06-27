export type Upstream = "anthropic" | "openrouter";

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
