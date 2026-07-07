import type { AuthMode, Decision, Upstream, UpstreamDef } from "./types.ts";

// Built-in upstreams. Users can add more (or override these) via the [upstreams]
// table in routes.toml; these are the defaults when a name isn't configured.
export const BUILTIN_UPSTREAMS: Record<string, UpstreamDef> = {
  anthropic: {
    base: "https://api.anthropic.com",
    auth: { kind: "passthrough", envKey: "ANTHROPIC_API_KEY" },
    stripBeta: false,
  },
  openrouter: {
    base: "https://openrouter.ai/api",
    auth: { kind: "bearer", envKey: "OPENROUTER_API_KEY" },
    stripBeta: true, // OpenRouter's Anthropic endpoint may reject Claude Code's betas
  },
};

const HOP_BY_HOP = new Set(["host", "content-length", "connection", "accept-encoding"]);

export class MissingKeyError extends Error {}

export function resolveUpstream(name: Upstream, upstreams?: Record<string, UpstreamDef>): UpstreamDef {
  const def = upstreams?.[name] ?? BUILTIN_UPSTREAMS[name];
  if (!def)
    throw new Error(`unknown upstream "${name}" (define it in an [upstreams] table in routes.toml)`);
  return def;
}

export function forwardUrl(
  upstream: Upstream,
  inboundPath: string,
  inboundSearch: string,
  upstreams?: Record<string, UpstreamDef>,
): string {
  return resolveUpstream(upstream, upstreams).base + inboundPath + inboundSearch;
}

export function rewriteHeaders(
  decision: Decision,
  inbound: Headers,
  env: Record<string, string | undefined>,
  upstreams?: Record<string, UpstreamDef>,
): Headers {
  const def = resolveUpstream(decision.upstream, upstreams);
  const out = new Headers();
  // Copy inbound headers except hop-by-hop and auth (auth is set per-upstream below).
  for (const [k, v] of inbound) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key))
      continue;
    if (key === "authorization" || key === "x-api-key")
      continue;
    out.set(k, v);
  }
  applyAuth(out, def.auth, inbound, env);
  if (def.stripBeta)
    out.delete("anthropic-beta");
  return out;
}

function applyAuth(
  out: Headers,
  auth: AuthMode,
  inbound: Headers,
  env: Record<string, string | undefined>,
): void {
  if (auth.kind === "bearer") {
    const key = env[auth.envKey];
    if (!key)
      throw new MissingKeyError(`${auth.envKey} is not set but a route needs it`);
    out.set("authorization", `Bearer ${key}`);
    return;
  }
  if (auth.kind === "passthrough") {
    // Prefer an explicit env key; otherwise pass Claude Code's own auth through.
    const envKey = auth.envKey ? env[auth.envKey] : undefined;
    if (envKey) {
      out.set("x-api-key", envKey);
      return;
    }
    const inboundAuth = inbound.get("authorization");
    const inboundKey = inbound.get("x-api-key");
    if (inboundAuth)
      out.set("authorization", inboundAuth);
    if (inboundKey)
      out.set("x-api-key", inboundKey);
  }
  // kind === "none": send no auth (a local model server that doesn't want one).
}

export function rewriteBody(decision: Decision, body: any): any {
  if (decision.model !== "passthrough")
    body.model = decision.model;
  return body;
}

// Framing headers that describe the *upstream* transfer — Bun's fetch already
// decoded the body and will re-frame our streamed Response, so copying these
// would double-decode or mis-length the reply.
const STRIP_RESPONSE = new Set(["content-length", "content-encoding", "transfer-encoding", "connection"]);

// Build downstream response headers from the upstream ones, so rate-limit /
// retry-after / request-id survive (Claude Code honors them for backoff), while
// stale framing headers are dropped and caching is disabled. Multi-value
// set-cookie is preserved.
export function passthroughHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const [k, v] of upstream) {
    const key = k.toLowerCase();
    if (STRIP_RESPONSE.has(key) || key === "set-cookie")
      continue;
    out.set(k, v);
  }
  for (const c of upstream.getSetCookie?.() ?? [])
    out.append("set-cookie", c);
  if (!out.has("content-type"))
    out.set("content-type", "application/json");
  out.set("cache-control", "no-cache");
  return out;
}
