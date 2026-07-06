import type { Config, Signals } from "../src/types.ts";
import { expect, test } from "bun:test";
import { route } from "../src/route.ts";

const CONFIG: Config = {
  models: {
    orchestrator: { upstream: "anthropic", slug: "passthrough" },
    flagship: { upstream: "openrouter", slug: "z-ai/glm-5.2" },
    cheap: { upstream: "openrouter", slug: "deepseek/deepseek-v4-flash" },
  },
  default: "orchestrator",
  longContextThreshold: 200000,
  routes: [
    { when: { tag: "flagship" }, use: "flagship" },
    { when: { tag: "control" }, use: "orchestrator" },
    { when: { workType: "background" }, use: "cheap" },
    { when: { anySubagent: true }, use: "flagship" },
  ],
};

function sig(p: Partial<Signals> = {}): Signals {
  return {
    agentId: null,
    sessionId: null,
    isSubagent: false,
    xApp: "cli",
    requestedModel: null,
    systemText: "",
    tag: null,
    hasThinking: false,
    tokensIn: 10,
    hasWebSearch: false,
    ...p,
  };
}

test("orchestrator (no subagent) → default anthropic passthrough", () => {
  expect(route(sig(), CONFIG)).toEqual({
    alias: "orchestrator",
    upstream: "anthropic",
    model: "passthrough",
    matchedRule: "default",
  });
});

test("tag wins over any-subagent", () => {
  const d = route(sig({ isSubagent: true, agentId: "x", tag: "flagship" }), CONFIG);
  expect(d).toEqual({
    alias: "flagship",
    upstream: "openrouter",
    model: "z-ai/glm-5.2",
    matchedRule: "tag:flagship",
  });
});

test("control tag pins a subagent back to Claude, ahead of any-subagent", () => {
  const d = route(sig({ isSubagent: true, agentId: "x", tag: "control" }), CONFIG);
  expect(d).toEqual({
    alias: "orchestrator",
    upstream: "anthropic",
    model: "passthrough",
    matchedRule: "tag:control",
  });
});

test("background subagent → cheap before any-subagent", () => {
  const d = route(sig({ isSubagent: true, agentId: "x", xApp: "cli-bg" }), CONFIG);
  expect(d.alias).toBe("cheap");
  expect(d.matchedRule).toBe("workType:background");
});

test("plain subagent → any-subagent flagship", () => {
  const d = route(sig({ isSubagent: true, agentId: "x" }), CONFIG);
  expect(d).toEqual({
    alias: "flagship",
    upstream: "openrouter",
    model: "z-ai/glm-5.2",
    matchedRule: "anySubagent",
  });
});

test("unknown alias in a rule throws", () => {
  const bad = { ...CONFIG, routes: [{ when: { anySubagent: true }, use: "nope" }] };
  expect(() => route(sig({ isSubagent: true, agentId: "x" }), bad)).toThrow();
});
