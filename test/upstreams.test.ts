import type { Decision } from "../src/types.ts";
import { expect, test } from "bun:test";
import { forwardUrl, MissingKeyError, passthroughHeaders, resolveUpstream, rewriteBody, rewriteHeaders } from "../src/upstreams.ts";

const toOR: Decision = { alias: "flagship", upstream: "openrouter", model: "z-ai/glm-5.2", matchedRule: "tag:flagship" };
const toAnthropic: Decision = { alias: "orchestrator", upstream: "anthropic", model: "passthrough", matchedRule: "default" };

test("forwardUrl builds upstream URLs", () => {
  expect(forwardUrl("anthropic", "/v1/messages", "")).toBe("https://api.anthropic.com/v1/messages");
  expect(forwardUrl("openrouter", "/v1/messages", "?beta=true")).toBe("https://openrouter.ai/api/v1/messages?beta=true");
});

test("openrouter leg injects Bearer key and strips anthropic-beta", () => {
  const inbound = new Headers({ "authorization": "Bearer dummy", "anthropic-beta": "x", "host": "localhost" });
  const out = rewriteHeaders(toOR, inbound, { OPENROUTER_API_KEY: "sk-or-REAL" });
  expect(out.get("authorization")).toBe("Bearer sk-or-REAL");
  expect(out.get("anthropic-beta")).toBeNull();
  expect(out.get("host")).toBeNull();
});

test("openrouter leg without key throws MissingKeyError", () => {
  expect(() => rewriteHeaders(toOR, new Headers(), {})).toThrow(MissingKeyError);
});

test("openrouter leg does not leak inbound x-api-key", () => {
  const inbound = new Headers({ "x-api-key": "sk-inbound-DUMMY", "authorization": "Bearer dummy" });
  const out = rewriteHeaders(toOR, inbound, { OPENROUTER_API_KEY: "sk-or-REAL" });
  expect(out.get("x-api-key")).toBeNull();
  expect(out.get("authorization")).toBe("Bearer sk-or-REAL");
});

test("anthropic leg passes auth + beta through", () => {
  const inbound = new Headers({ "authorization": "Bearer oauth-tok", "anthropic-beta": "caching" });
  const out = rewriteHeaders(toAnthropic, inbound, {});
  expect(out.get("authorization")).toBe("Bearer oauth-tok");
  expect(out.get("anthropic-beta")).toBe("caching");
});

test("anthropic leg prefers env ANTHROPIC_API_KEY as x-api-key", () => {
  const out = rewriteHeaders(toAnthropic, new Headers(), { ANTHROPIC_API_KEY: "sk-ant-X" });
  expect(out.get("x-api-key")).toBe("sk-ant-X");
});

test("anthropic leg with no env key and no inbound auth returns no auth and does not throw", () => {
  const out = rewriteHeaders(toAnthropic, new Headers(), {});
  expect(out.get("authorization")).toBeNull();
  expect(out.get("x-api-key")).toBeNull();
});

test("rewriteBody sets model unless passthrough", () => {
  expect(rewriteBody(toOR, { model: "claude-sonnet-4-6" }).model).toBe("z-ai/glm-5.2");
  expect(rewriteBody(toAnthropic, { model: "claude-sonnet-4-6" }).model).toBe("claude-sonnet-4-6");
});

test("passthroughHeaders keeps rate-limit/retry-after/request-id, drops framing, forces no-cache", () => {
  const up = new Headers({
    "content-type": "text/event-stream",
    "retry-after": "30",
    "anthropic-ratelimit-requests-remaining": "42",
    "request-id": "req_123",
    "content-length": "999",
    "content-encoding": "gzip",
    "transfer-encoding": "chunked",
    "connection": "keep-alive",
  });
  const out = passthroughHeaders(up);
  expect(out.get("retry-after")).toBe("30");
  expect(out.get("anthropic-ratelimit-requests-remaining")).toBe("42");
  expect(out.get("request-id")).toBe("req_123");
  expect(out.get("content-type")).toBe("text/event-stream");
  expect(out.get("cache-control")).toBe("no-cache");
  // framing headers stripped — Bun already decoded the body and re-frames our reply
  expect(out.get("content-length")).toBeNull();
  expect(out.get("content-encoding")).toBeNull();
  expect(out.get("transfer-encoding")).toBeNull();
  expect(out.get("connection")).toBeNull();
});

test("passthroughHeaders defaults content-type when the upstream omits it", () => {
  const out = passthroughHeaders(new Headers());
  expect(out.get("content-type")).toBe("application/json");
  expect(out.get("cache-control")).toBe("no-cache");
});

test("resolveUpstream falls back to built-ins and honors config overrides", () => {
  expect(resolveUpstream("anthropic").base).toBe("https://api.anthropic.com");
  expect(resolveUpstream("openrouter").auth).toEqual({ kind: "bearer", envKey: "OPENROUTER_API_KEY" });
  const custom = { local: { base: "http://localhost:11434", auth: { kind: "none" as const }, stripBeta: true } };
  expect(resolveUpstream("local", custom).base).toBe("http://localhost:11434");
  expect(() => resolveUpstream("nope")).toThrow(/unknown upstream/);
});

test("a local (none-auth) upstream sends no auth and forwards to its configured base", () => {
  const toLocal: Decision = { alias: "flagship", upstream: "local", model: "qwen3-coder:30b", matchedRule: "anySubagent" };
  const upstreams = { local: { base: "http://localhost:11434", auth: { kind: "none" as const }, stripBeta: true } };
  const inbound = new Headers({ "authorization": "Bearer oauth-tok", "x-api-key": "sk-ant", "anthropic-beta": "x", "content-type": "application/json" });
  const out = rewriteHeaders(toLocal, inbound, {}, upstreams);
  expect(out.get("authorization")).toBeNull(); // no Claude auth leaked to the local server
  expect(out.get("x-api-key")).toBeNull();
  expect(out.get("anthropic-beta")).toBeNull(); // stripped
  expect(out.get("content-type")).toBe("application/json");
  expect(forwardUrl("local", "/v1/messages", "", upstreams)).toBe("http://localhost:11434/v1/messages");
});

test("a config-defined bearer upstream injects its own env key", () => {
  const toGw: Decision = { alias: "x", upstream: "gw", model: "m", matchedRule: "tag:x" };
  const upstreams = { gw: { base: "https://gw.example", auth: { kind: "bearer" as const, envKey: "GW_KEY" }, stripBeta: true } };
  expect(rewriteHeaders(toGw, new Headers(), { GW_KEY: "secret" }, upstreams).get("authorization")).toBe("Bearer secret");
  expect(() => rewriteHeaders(toGw, new Headers(), {}, upstreams)).toThrow(MissingKeyError);
});

const toZai: Decision = { alias: "flagship", upstream: "zai", model: "glm-5.2", matchedRule: "tag:flagship" };

test("built-in zai upstream targets Z.ai's Anthropic endpoint", () => {
  expect(resolveUpstream("zai").base).toBe("https://api.z.ai/api/anthropic");
  expect(forwardUrl("zai", "/v1/messages", "")).toBe("https://api.z.ai/api/anthropic/v1/messages");
});

test("built-in zai upstream sends Bearer ZAI_API_KEY, drops Claude auth, strips betas", () => {
  const inbound = new Headers({ "authorization": "Bearer claude-oauth", "x-api-key": "sk-ant", "anthropic-beta": "x", "content-type": "application/json" });
  const out = rewriteHeaders(toZai, inbound, { ZAI_API_KEY: "zk-secret" });
  expect(out.get("authorization")).toBe("Bearer zk-secret"); // your Z.ai key, not Claude's
  expect(out.get("x-api-key")).toBeNull(); // Claude auth never leaked to Z.ai
  expect(out.get("anthropic-beta")).toBeNull(); // stripped by default (safe)
  expect(out.get("content-type")).toBe("application/json");
});

test("built-in zai upstream throws MissingKeyError without ZAI_API_KEY", () => {
  expect(() => rewriteHeaders(toZai, new Headers(), {})).toThrow(MissingKeyError);
});
