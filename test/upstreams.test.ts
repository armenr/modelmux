import type { Decision } from "../src/types.ts";
import { expect, test } from "bun:test";
import { forwardUrl, MissingKeyError, rewriteBody, rewriteHeaders } from "../src/upstreams.ts";

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

test("rewriteBody sets model unless passthrough", () => {
  expect(rewriteBody(toOR, { model: "claude-sonnet-4-6" }).model).toBe("z-ai/glm-5.2");
  expect(rewriteBody(toAnthropic, { model: "claude-sonnet-4-6" }).model).toBe("claude-sonnet-4-6");
});
