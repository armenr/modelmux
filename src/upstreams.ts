import type { Decision, Upstream } from "./types.ts";

const BASE: Record<Upstream, string> = {
  anthropic: "https://api.anthropic.com",
  openrouter: "https://openrouter.ai/api",
};

const HOP_BY_HOP = new Set(["host", "content-length", "connection", "accept-encoding"]);

export class MissingKeyError extends Error {}

export function forwardUrl(upstream: Upstream, inboundPath: string, inboundSearch: string): string {
  return BASE[upstream] + inboundPath + inboundSearch;
}

export function rewriteHeaders(
  decision: Decision,
  inbound: Headers,
  env: Record<string, string | undefined>,
): Headers {
  const out = new Headers();
  // Copy inbound headers except hop-by-hop and auth (auth handled per-leg).
  for (const [k, v] of inbound) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key))
      continue;
    if (key === "authorization" || key === "x-api-key")
      continue;
    out.set(k, v);
  }

  if (decision.upstream === "openrouter") {
    const key = env.OPENROUTER_API_KEY;
    if (!key)
      throw new MissingKeyError("OPENROUTER_API_KEY is not set but a route needs OpenRouter");
    out.set("authorization", `Bearer ${key}`);
    out.delete("anthropic-beta"); // OpenRouter's Anthropic endpoint may reject CC betas
    return out;
  }

  // anthropic leg: prefer an explicit env key, else pass Claude Code's own auth through.
  if (env.ANTHROPIC_API_KEY) {
    out.set("x-api-key", env.ANTHROPIC_API_KEY);
  }
  else {
    const inboundAuth = inbound.get("authorization");
    const inboundKey = inbound.get("x-api-key");
    if (inboundAuth)
      out.set("authorization", inboundAuth);
    if (inboundKey)
      out.set("x-api-key", inboundKey);
  }
  return out;
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
