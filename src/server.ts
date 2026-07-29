import type { ConfigHolder } from "./config.ts";
import type { Config, Decision, Upstream } from "./types.ts";
import process from "node:process";
import { untaggedAgentWarning } from "./agents.ts";
import { watchConfig } from "./config.ts";
import { logDecision, logError } from "./log.ts";
import { openaiPath, toAnthropicResponse, toAnthropicStream, toOpenAIRequest } from "./openai.ts";
import { collectResponsesOutput, responsesPath, toAnthropicFromResponses, toAnthropicStreamFromResponses, toResponsesRequest } from "./responses.ts";
import { route } from "./route.ts";
import { extractSignals } from "./signals.ts";
import { applyExtraBody, applyMinMaxTokens, forwardUrl, passthroughHeaders, resolveUpstream, rewriteBody, rewriteHeaders } from "./upstreams.ts";

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
      const isResponses = def.format === "responses";
      const translates = isOpenAI || isResponses;
      const wantsStream = body?.stream === true;
      const outboundBody = applyMinMaxTokens(def, applyExtraBody(def, isOpenAI
        ? toOpenAIRequest(body, def.maxTokensField)
        : isResponses ? toResponsesRequest(body, def.codexSubscription === true) : body));

      const url = new URL(req.url);
      const path = isOpenAI
        ? (def.chatPath ?? openaiPath(url.pathname))
        : isResponses ? responsesPath(url.pathname) : url.pathname;
      // Call forwardUrl rather than re-deriving the same expression inline.
      // It used to be duplicated here, which meant the ONE tested URL-builder was
      // not the one production ran — the reachability oracle caught it as an
      // export with no production caller. Keep them the same function so the test
      // covers the real path. baseOverride stays inline: it is a test seam that
      // bypasses upstream resolution entirely.
      const base = opts.baseOverride?.[decision.upstream];
      const target = base
        ? base + path + url.search
        : forwardUrl(decision.upstream, path, url.search, config.upstreams);

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
      if (!translates) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: passthroughHeaders(upstream.headers),
        });
      }

      // A lapsed Codex credential is the ONE upstream error we can diagnose
      // better than the provider can. modelmux reads `~/.codex/auth.json` but
      // never refreshes it (OQ-002), so once the access token expires every
      // request 401s — and the raw ChatGPT-backend body does not tell you that
      // re-running `codex login` is the fix. Fail LOUD with the actual remedy
      // instead of forwarding an opaque 401. Only for the codex auth kind: any
      // other upstream's 401 means a wrong API key, which is a different fix.
      if (def.auth.kind === "codex" && (upstream.status === 401 || upstream.status === 403)) {
        const detail = await upstream.text().catch(() => "");
        const msg = `codex upstream rejected the credential (HTTP ${upstream.status}).\n`
          + `The access token in ~/.codex/auth.json has most likely expired — modelmux READS that file `
          + `but never refreshes it.\nFix: re-run \`codex login\`, then retry. No modelmux restart is `
          + `needed; the credential is re-read on every request.\nUpstream said: ${detail.slice(0, 500)}`;
        logError(opts.logPath, signals, new Error(`codex auth rejected (${upstream.status})`));
        return new Response(msg, { status: upstream.status, headers: { "content-type": "text/plain" } });
      }

      // Every other upstream ERROR body is provider-shaped either way — pass it
      // along rather than translating it into a well-formed message that says nothing.
      if (!upstream.ok || !upstream.body) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: passthroughHeaders(upstream.headers),
        });
      }

      if (wantsStream) {
        const sseHeaders = passthroughHeaders(upstream.headers);
        sseHeaders.set("content-type", "text/event-stream");
        const translated = isResponses
          ? toAnthropicStreamFromResponses(upstream.body, decision.model)
          : toAnthropicStream(upstream.body, decision.model);
        return new Response(translated, { status: upstream.status, headers: sseHeaders });
      }

      // An SSE-ONLY upstream (the ChatGPT-subscription Codex backend) was sent
      // stream:true regardless of what the caller asked for, because it rejects
      // anything else. Drain that stream back into one response object so a
      // non-streaming caller still gets the JSON reply it asked for.
      const forcedStream = isResponses && def.codexSubscription === true;
      const oaiJson = forcedStream
        ? await collectResponsesOutput(upstream.body).catch(() => null)
        : await upstream.json().catch(() => null);
      if (oaiJson == null)
        return new Response("upstream returned an unparseable body", { status: 502 });
      const jsonHeaders = passthroughHeaders(upstream.headers);
      jsonHeaders.set("content-type", "application/json");
      const anthropicJson = isResponses
        ? toAnthropicFromResponses(oaiJson, decision.model)
        : toAnthropicResponse(oaiJson, decision.model);
      return new Response(JSON.stringify(anthropicJson), {
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
