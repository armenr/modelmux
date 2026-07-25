import type { ConfigHolder } from "./config.ts";
import type { Config, Decision, Upstream } from "./types.ts";
import process from "node:process";
import { untaggedAgentWarning } from "./agents.ts";
import { watchConfig } from "./config.ts";
import { logDecision, logError } from "./log.ts";
import { openaiPath, toAnthropicResponse, toAnthropicStream, toOpenAIRequest } from "./openai.ts";
import { route } from "./route.ts";
import { extractSignals } from "./signals.ts";
import { normalizeBase, passthroughHeaders, resolveUpstream, rewriteBody, rewriteHeaders } from "./upstreams.ts";

export interface ServerOpts {
  config?: Config; // static config (tests); ignored if configHolder is set
  configHolder?: ConfigHolder; // live config read per-request (hot-reload)
  env: Record<string, string | undefined>;
  logPath: string;
  port?: number;
  idleTimeout?: number; // seconds; default 0 = never drop quiet SSE
  baseOverride?: Partial<Record<Upstream, string>>;
}

export function buildServer(opts: ServerOpts): Bun.Server<never> {
  return Bun.serve({
    port: opts.port ?? Number(opts.env.PORT ?? 8787),
    // idleTimeout 0 = defensive: Bun 1.3.14 doesn't drop active proxied
    // streams this way, but Bun docs document a 10s idle-default, so keep 0
    // to guard genuinely-idle gaps / future behavior changes (verified 2026-06).
    idleTimeout: opts.idleTimeout ?? 0,
    async fetch(req) {
      let body: any;
      try {
        body = await req.json();
      }
      catch {
        return new Response("expected JSON body", { status: 400 });
      }
      const signals = extractSignals(req.headers, body);
      const config = opts.configHolder?.current ?? opts.config;
      if (!config)
        return new Response("server has no config", { status: 500 });

      // Routing + auth rewrite can throw (unknown alias, missing key).
      // Fail loud: log the error to the same seam and return 400 — never silently mis-route.
      // (MissingKeyError and unknown-alias are both client/config-fixable → 400.)
      let decision: Decision;
      let headers: Headers;
      try {
        decision = route(signals, config);
        headers = rewriteHeaders(decision, req.headers, opts.env, config.upstreams);
      }
      catch (e) {
        logError(opts.logPath, signals, e as Error);
        return new Response((e as Error).message, { status: 400 });
      }

      rewriteBody(decision, body);
      logDecision(opts.logPath, signals, decision);

      // An upstream that speaks OpenAI Chat Completions needs the body, the
      // path and (below) the response translated. "anthropic" is the fast path
      // and forwards untouched, exactly as before.
      const def = resolveUpstream(decision.upstream, config.upstreams);
      const isOpenAI = def.format === "openai";
      const wantsStream = body?.stream === true;
      const outboundBody = isOpenAI ? toOpenAIRequest(body, def.maxTokensField) : body;

      const url = new URL(req.url);
      const path = isOpenAI ? openaiPath(url.pathname) : url.pathname;
      const base = opts.baseOverride?.[decision.upstream];
      const target = base
        ? base + path + url.search
        : normalizeBase(def.base) + path + url.search;

      let upstream: Response;
      try {
        upstream = await fetch(target, {
          method: req.method,
          headers,
          body: JSON.stringify(outboundBody),
          signal: req.signal, // propagate client cancellation so we don't keep billing
        });
      }
      catch (e) {
        // Client hung up before the upstream answered — nothing left to reply to.
        if ((e as Error).name === "AbortError")
          return new Response(null, { status: 499 });
        // Upstream unreachable (DNS/refused/TLS/offline): fail loud + log, never a silent 500.
        logError(opts.logPath, signals, e as Error);
        return new Response(`upstream fetch failed: ${(e as Error).message}`, { status: 502 });
      }

      // Anthropic-format upstreams stream straight through, untouched.
      if (!isOpenAI) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: passthroughHeaders(upstream.headers),
        });
      }

      // An upstream ERROR body is provider-shaped either way — pass it along
      // rather than translating it into a well-formed message that says nothing.
      if (!upstream.ok || !upstream.body) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: passthroughHeaders(upstream.headers),
        });
      }

      if (wantsStream) {
        const sseHeaders = passthroughHeaders(upstream.headers);
        sseHeaders.set("content-type", "text/event-stream");
        return new Response(toAnthropicStream(upstream.body, decision.model), {
          status: upstream.status,
          headers: sseHeaders,
        });
      }

      const oaiJson = await upstream.json().catch(() => null);
      if (oaiJson == null)
        return new Response("upstream returned an unparseable body", { status: 502 });
      const jsonHeaders = passthroughHeaders(upstream.headers);
      jsonHeaders.set("content-type", "application/json");
      return new Response(JSON.stringify(toAnthropicResponse(oaiJson, decision.model)), {
        status: upstream.status,
        headers: jsonHeaders,
      });
    },
  });
}

// Boot the proxy from a routes file (used by `bun run proxy` and the compiled
// binary). watchConfig enables `mux set` / live routes.toml edits without a restart.
export function startProxy(routesPath = process.env.MUX_ROUTES ?? "routes.toml"): Bun.Server<never> {
  const holder = watchConfig(routesPath);
  const server = buildServer({
    configHolder: holder,
    env: process.env,
    logPath: process.env.MUX_LOG ?? "decisions.jsonl",
  });
  console.log(`modelmux listening on ${server.url.origin}`);
  // Say out loud which agents the anySubagent rule will divert. Silent unless
  // there is something to act on; see untaggedAgentWarning for the three cases.
  const warning = untaggedAgentWarning(holder.current);
  if (warning)
    process.stderr.write(warning);
  return server;
}

if (import.meta.main)
  startProxy();
