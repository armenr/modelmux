import { expect, test } from "bun:test";
import { extractSignals } from "../src/signals.ts";

function h(obj: Record<string, string>) {
  return new Headers(obj);
}

test("subagent detected via x-claude-code-agent-id, session id captured", () => {
  const s = extractSignals(
    h({ "x-claude-code-agent-id": "abc123", "x-claude-code-session-id": "sess-9", "x-app": "cli" }),
    {},
  );
  expect(s.isSubagent).toBe(true);
  expect(s.agentId).toBe("abc123");
  expect(s.sessionId).toBe("sess-9");
});

test("orchestrator has no agent id", () => {
  const s = extractSignals(h({ "x-app": "cli" }), {});
  expect(s.isSubagent).toBe(false);
  expect(s.agentId).toBeNull();
});

test("background flagged via x-app cli-bg", () => {
  expect(extractSignals(h({ "x-app": "cli-bg" }), {}).xApp).toBe("cli-bg");
});

test("tag parsed from string system prompt", () => {
  const s = extractSignals(h({}), { system: "<<route:flagship>>\nYou are a researcher." });
  expect(s.tag).toBe("flagship");
});

test("tag parsed from system block array", () => {
  const body = { system: [{ type: "text", text: "<<route:review>> do stuff" }] };
  expect(extractSignals(h({}), body).tag).toBe("review");
});

test("thinking + web_search + token estimate", () => {
  const body = {
    thinking: { type: "enabled", budget_tokens: 1024 },
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  };
  const s = extractSignals(h({}), body);
  expect(s.hasThinking).toBe(true);
  expect(s.hasWebSearch).toBe(true);
  expect(s.tokensIn).toBeGreaterThan(0);
});

test("no tag returns null", () => {
  expect(extractSignals(h({}), { system: "plain prompt" }).tag).toBeNull();
});
