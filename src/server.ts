import type { ConfigHolder } from "./config.ts";
import type { Config, Decision, Upstream } from "./types.ts";
import process from "node:process";
import { watchConfig } from "./config.ts";
import { logDecision, logError } from "./log.ts";
import { route } from "./route.ts";
import { extractSignals } from "./signals.ts";
import { forwardUrl, rewriteBody, rewriteHeaders } from "./upstreams.ts";

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
        headers = rewriteHeaders(decision, req.headers, opts.env);
      }
      catch (e) {
        logError(opts.logPath, signals, e as Error);
        return new Response((e as Error).message, { status: 400 });
      }

      rewriteBody(decision, body);
      logDecision(opts.logPath, signals, decision);

      const url = new URL(req.url);
      const base = opts.baseOverride?.[decision.upstream];
      const target = base
        ? base + url.pathname + url.search
        : forwardUrl(decision.upstream, url.pathname, url.search);

      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: JSON.stringify(body),
      });

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "application/json",
          "cache-control": "no-cache",
        },
      });
    },
  });
}

if (import.meta.main) {
  // watchConfig enables `mux set` / live routes.toml edits without a restart.
  const server = buildServer({
    configHolder: watchConfig("routes.toml"),
    env: process.env,
    logPath: process.env.MUX_LOG ?? "decisions.jsonl",
  });
  console.log(`modelmux listening on ${server.url.origin}`);
}
