import type { AuthMode, Decision, Upstream, UpstreamDef } from "./types.ts";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Built-in upstreams. Users can add more (or override these) via the [upstreams]
// table in routes.toml; these are the defaults when a name isn't configured.
export const BUILTIN_UPSTREAMS: Record<string, UpstreamDef> = {
  anthropic: {
    // NO envKey. The orchestrator's own subscription credential is forwarded
    // untouched; modelmux never substitutes a metered key for a subscription one.
    auth: { kind: "passthrough" },
    base: "https://api.anthropic.com",
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
    // Not generic Responses — see UpstreamDef.codexSubscription for the three
    // measured 400s and the empty-`output` aggregation trap.
    codexSubscription: true,
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
    // Sent because the official client sends it and it is the documented way to
    // disambiguate which ChatGPT account a request bills to.
    //
    // HONESTY NOTE: an earlier comment here claimed this header was load-bearing
    // ("without it the backend answers 401/403"). MEASURED 2026-07-25 against the
    // live endpoint, that is FALSE — omitting it still returns 200 on a
    // single-account login. It is retained because a multi-account/workspace
    // login is exactly the case a single-account test cannot observe, and the
    // cost of sending it is nil. Do not re-derive "required" from its presence.
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
    // PASSTHROUGH FORWARDS THE CALLER'S CREDENTIAL AND NOTHING ELSE. It must never
    // substitute one from the environment.
    //
    // This branch used to prefer `envKey` and `return` before ever reading the
    // inbound headers. With ANTHROPIC_API_KEY exported — common, and set for
    // unrelated reasons — every request through the default `anthropic` upstream
    // had Claude Code's SUBSCRIPTION OAuth silently replaced by a METERED API key.
    // The proxy answered 200 to a request carrying no credentials at all, which is
    // the tell, and 93 orchestrator requests were billed to the wrong account
    // before anyone noticed. A billing redirect must never be a silent default.
    //
    // No inbound credential now means NO credential goes out: the upstream answers
    // 401, which is loud and immediately diagnosable. Anyone who genuinely wants
    // key auth against Anthropic declares it explicitly:
    //   [upstreams]
    //   anthropic = { base = "https://api.anthropic.com", auth = "bearer:ANTHROPIC_API_KEY" }
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

// Merge an upstream's `extraBody` into the OUTBOUND body, after wire-format
// translation. It must run post-translation: `toOpenAIRequest` builds a fresh
// object from named fields, so anything injected upstream of it is discarded.
//
// Applied LAST and it WINS over the caller — that is deliberate. Imposing depth
// is per-upstream policy, and the caller (Claude Code) has no vocabulary for
// `reasoning_effort` to begin with, so there is no user intent to preserve.
export function applyExtraBody(def: UpstreamDef, outbound: any): any {
  if (!def.extraBody || typeof outbound !== "object" || outbound === null)
    return outbound;
  for (const [k, v] of Object.entries(def.extraBody))
    outbound[k] = v;
  return outbound;
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
