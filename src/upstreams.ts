import type { AuthMode, Decision, Upstream, UpstreamDef } from "./types.ts";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Built-in upstreams. Users can add more (or override these) via the [upstreams]
// table in routes.toml; these are the defaults when a name isn't configured.
export const BUILTIN_UPSTREAMS: Record<string, UpstreamDef> = {
  anthropic: {
    base: "https://api.anthropic.com",
    auth: { kind: "passthrough", envKey: "ANTHROPIC_API_KEY" },
    stripBeta: false,
    format: "anthropic",
    maxTokensField: "max_tokens",
  },
  openrouter: {
    base: "https://openrouter.ai/api",
    auth: { kind: "bearer", envKey: "OPENROUTER_API_KEY" },
    stripBeta: true, // OpenRouter's Anthropic endpoint may reject Claude Code's betas
    format: "anthropic",
    maxTokensField: "max_tokens",
  },
  // Z.ai GLM Coding Plan — a flat-rate subscription via Z.ai's Anthropic endpoint.
  // Betas stripped by default to avoid 400s; override with stripBeta = false in
  // [upstreams] if you want to keep Claude Code's betas.
  zai: {
    base: "https://api.z.ai/api/anthropic",
    auth: { kind: "bearer", envKey: "ZAI_API_KEY" },
    stripBeta: true,
    format: "anthropic",
    maxTokensField: "max_tokens",
  },
  // Kimi Code — Moonshot's flat-rate coding subscription, quota-based rather than
  // per-token. Its key comes from the Kimi Code console and is NOT the same as a
  // per-token MOONSHOT_API_KEY; the two use different hosts and different model
  // ids (`k3` here vs `kimi-k3` on the metered API), so they are separate
  // upstreams rather than one with a swappable key. For the metered API add:
  //   [upstreams]
  //   moonshot = { base = "https://api.moonshot.ai/anthropic", auth = "bearer:MOONSHOT_API_KEY" }
  kimi: {
    base: "https://api.kimi.com/coding",
    auth: { kind: "bearer", envKey: "KIMI_API_KEY" },
    stripBeta: true,
    format: "anthropic",
    maxTokensField: "max_tokens",
  },
  // GPT / Codex on a ChatGPT subscription. Speaks the Responses wire format and
  // authenticates with the credentials `codex login` already wrote to disk.
  // See ADR-0003 for why this ships built-in and what it does NOT promise: the
  // endpoint is undocumented and can change, and whether subscription use suits
  // your account is a terms question only you can answer.
  codex: {
    base: "https://chatgpt.com/backend-api/codex",
    auth: { kind: "codex" },
    stripBeta: true,
    format: "responses",
    maxTokensField: "max_tokens",
  },
};

// Upstream bases are concatenated with an inbound path that already starts with
// "/", so a trailing slash would produce a doubled separator. Providers publish
// bases both ways (Kimi Code's docs show a trailing slash, Z.ai's does not), and
// a user-declared [upstreams] entry is just as likely to carry one.
export function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

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
  return normalizeBase(resolveUpstream(upstream, upstreams).base) + inboundPath + inboundSearch;
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

// Codex CLI stores its ChatGPT OAuth credentials here after `codex login`.
// modelmux READS them; it never performs the login itself and never writes to
// this file — one subscription, one credential store, owned by the tool that
// obtained it.
// Path SEGMENTS, joined with node:path so this resolves correctly on
// Linux, macOS and Windows alike rather than assuming "/".
export const CODEX_AUTH_SEGMENTS = [".codex", "auth.json"] as const;

export class CodexAuthError extends Error {}

interface CodexCreds { accessToken: string; accountId: string }

// Read the Codex credentials. Throws a MissingKeyError-equivalent rather than
// returning empty, so a mis-set-up upstream fails loud at the first request
// instead of sending an unauthenticated call and reporting the provider's 401.
export function readCodexAuth(path: string | undefined, env: Record<string, string | undefined>): CodexCreds {
  // CODEX_HOME first (Codex CLI's own override), then the platform home dir.
  const codexHome = env.CODEX_HOME;
  const home = env.HOME ?? env.USERPROFILE ?? homedir();
  const file = path ?? (codexHome
    ? join(codexHome, "auth.json")
    : join(home, ...CODEX_AUTH_SEGMENTS));
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  }
  catch {
    throw new CodexAuthError(
      `codex auth not found at ${file} — run \`codex login\` first (modelmux reads its credentials, it does not create them)`,
    );
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  }
  catch {
    throw new CodexAuthError(`codex auth at ${file} is not valid JSON`);
  }
  const accessToken = parsed?.tokens?.access_token;
  const accountId = parsed?.tokens?.account_id;
  if (typeof accessToken !== "string" || !accessToken)
    throw new CodexAuthError(`codex auth at ${file} has no tokens.access_token — re-run \`codex login\``);
  if (typeof accountId !== "string" || !accountId)
    throw new CodexAuthError(`codex auth at ${file} has no tokens.account_id — re-run \`codex login\``);
  return { accessToken, accountId };
}

function applyAuth(
  out: Headers,
  auth: AuthMode,
  inbound: Headers,
  env: Record<string, string | undefined>,
): void {
  if (auth.kind === "codex") {
    const { accessToken, accountId } = readCodexAuth(auth.path, env);
    out.set("authorization", `Bearer ${accessToken}`);
    // Load-bearing: without ChatGPT-Account-ID the backend answers 401/403.
    out.set("chatgpt-account-id", accountId);
    return;
  }
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
