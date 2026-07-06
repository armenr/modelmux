import type { Config } from "../src/types.ts";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { loadConfig } from "../src/config.ts";
import { readDecisions } from "../src/log.ts";
import { buildServer } from "../src/server.ts";

const LOG = "test/.tmp-int.jsonl";
const CONFIG: Config = {
  models: {
    orchestrator: { upstream: "anthropic", slug: "passthrough" },
    flagship: { upstream: "openrouter", slug: "z-ai/glm-5.2" },
  },
  default: "orchestrator",
  longContextThreshold: 200000,
  routes: [
    { when: { tag: "flagship" }, use: "flagship" },
    { when: { anySubagent: true }, use: "flagship" },
  ],
};

let fakeAnthropic: Bun.Server<never>, fakeOpenRouter: Bun.Server<never>, proxy: Bun.Server<never>;

beforeAll(() => {
  rmSync(LOG, { force: true });
  // Fake upstreams echo which one was hit and stream a tiny SSE body.
  fakeAnthropic = Bun.serve({ port: 0, fetch: () => sse("anthropic") });
  fakeOpenRouter = Bun.serve({ port: 0, fetch: () => sse("openrouter") });
  proxy = buildServer({
    config: CONFIG,
    env: { OPENROUTER_API_KEY: "sk-or-test" },
    logPath: LOG,
    port: 0,
    baseOverride: {
      anthropic: fakeAnthropic.url.origin,
      openrouter: fakeOpenRouter.url.origin,
    },
  });
});

afterAll(() => {
  fakeAnthropic.stop(true);
  fakeOpenRouter.stop(true);
  proxy.stop(true);
  rmSync(LOG, { force: true });
});

function sse(which: string) {
  return new Response(
    async function* () {
      yield `data: {"upstream":"${which}"}\n\n`;
      yield "data: [DONE]\n\n";
    },
    { headers: { "content-type": "text/event-stream" } },
  );
}

async function post(headers: Record<string, string>, body: unknown) {
  return fetch(`${proxy.url.origin}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("orchestrator request routes to Anthropic", async () => {
  const res = await post({ "x-app": "cli" }, { model: "claude-opus-4-8" });
  expect(await res.text()).toContain("\"upstream\":\"anthropic\"");
  const last = readDecisions(LOG).at(-1)!;
  expect(last.upstream).toBe("anthropic");
  expect(last.matchedRule).toBe("default");
});

test("tagged subagent routes to OpenRouter with model rewritten", async () => {
  const res = await post(
    { "x-app": "cli", "x-claude-code-agent-id": "abc" },
    { model: "claude-sonnet-4-6", system: "<<route:flagship>> research" },
  );
  expect(await res.text()).toContain("\"upstream\":\"openrouter\"");
  const last = readDecisions(LOG).at(-1)!;
  expect(last.upstream).toBe("openrouter");
  expect(last.resolvedModel).toBe("z-ai/glm-5.2");
  expect(last.matchedRule).toBe("tag:flagship");
});

test("plain subagent routes to OpenRouter via anySubagent", async () => {
  const res = await post({ "x-app": "cli", "x-claude-code-agent-id": "xyz" }, { model: "claude-haiku-4-5" });
  expect(await res.text()).toContain("\"upstream\":\"openrouter\"");
  expect(readDecisions(LOG).at(-1)!.matchedRule).toBe("anySubagent");
});

test("missing OpenRouter key fails loud with 400 AND logs an error record", async () => {
  const noKey = buildServer({
    config: CONFIG,
    env: {},
    logPath: LOG,
    port: 0,
    baseOverride: { anthropic: fakeAnthropic.url.origin, openrouter: fakeOpenRouter.url.origin },
  });
  const res = await fetch(`${noKey.url.origin}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-claude-code-agent-id": "a" },
    body: JSON.stringify({ model: "x" }),
  });
  expect(res.status).toBe(400);
  expect(readDecisions(LOG).at(-1)!.matchedRule).toBe("error"); // logged, not silent
  noKey.stop(true);
});

test("live config swap via holder changes routing without restart", async () => {
  const holder = { current: structuredClone(CONFIG) };
  const p = buildServer({
    configHolder: holder,
    env: { OPENROUTER_API_KEY: "k" },
    logPath: LOG,
    port: 0,
    baseOverride: { anthropic: fakeAnthropic.url.origin, openrouter: fakeOpenRouter.url.origin },
  });
  const hit = () => fetch(`${p.url.origin}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-claude-code-agent-id": "a" },
    body: JSON.stringify({ model: "m", system: "<<route:flagship>>" }),
  });
  await hit();
  expect(readDecisions(LOG).at(-1)!.upstream).toBe("openrouter"); // flagship -> openrouter
  // hot-swap flagship onto anthropic; no restart
  holder.current = {
    ...holder.current,
    models: { ...holder.current.models, flagship: { upstream: "anthropic", slug: "passthrough" } },
  };
  await hit();
  expect(readDecisions(LOG).at(-1)!.upstream).toBe("anthropic"); // applied live
  p.stop(true);
});

// Proves SSE passthrough survives a quiet gap: the upstream emits nothing for
// 1.5s, then streams to [DONE], and the idleTimeout:0 proxy streams it straight
// through to completion. There is intentionally NO negative-control ("a short
// idleTimeout drops it") case: Bun 1.3.14 does not drop active proxied streams
// via idleTimeout (verified empirically 2026-06 — it keeps streaming/awaiting
// connections alive regardless of idleTimeout), so such an assertion is unprovable.
test("idleTimeout:0 streams a quiet SSE response through to completion", async () => {
  const up = Bun.serve({
    port: 0,
    idleTimeout: 0, // upstream must not drop first
    fetch: () => new Response(
      async function* () {
        await Bun.sleep(1500);
        yield "data: late\n\n";
        yield "data: [DONE]\n\n";
      },
      { headers: { "content-type": "text/event-stream" } },
    ),
  });
  const ovr = { anthropic: up.url.origin, openrouter: up.url.origin };

  const keep = buildServer({ config: CONFIG, env: { OPENROUTER_API_KEY: "k" }, logPath: LOG, port: 0, idleTimeout: 0, baseOverride: ovr });
  const res = await fetch(`${keep.url.origin}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "x" }),
  });
  expect(await res.text()).toContain("[DONE]");

  keep.stop(true);
  up.stop(true);
});

// End-to-end over the REAL routes.toml (not an inline config): proves the TOML
// config loads and the shipped cascade routes correctly through the server.
test("real routes.toml routes a flagship subagent to OpenRouter and a control tag to Claude", async () => {
  const realCfg = loadConfig("routes.toml", {});
  const p = buildServer({
    config: realCfg,
    env: { OPENROUTER_API_KEY: "sk-or-test" },
    logPath: LOG,
    port: 0,
    baseOverride: { anthropic: fakeAnthropic.url.origin, openrouter: fakeOpenRouter.url.origin },
  });

  const hit = (headers: Record<string, string>, body: unknown) =>
    fetch(`${p.url.origin}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

  // flagship-tagged subagent → OpenRouter, model rewritten to the real slug
  const a = await hit({ "x-claude-code-agent-id": "a" }, { model: "claude-x", system: "<<route:flagship>>" });
  expect(await a.text()).toContain("\"upstream\":\"openrouter\"");
  const la = readDecisions(LOG).at(-1)!;
  expect(la.upstream).toBe("openrouter");
  expect(la.resolvedModel).toBe("z-ai/glm-5.2");

  // control-tagged subagent → stays on Claude (passthrough), ahead of anySubagent
  const b = await hit({ "x-claude-code-agent-id": "b" }, { model: "claude-x", system: "<<route:control>>" });
  expect(await b.text()).toContain("\"upstream\":\"anthropic\"");
  expect(readDecisions(LOG).at(-1)!.matchedRule).toBe("tag:control");

  p.stop(true);
});
