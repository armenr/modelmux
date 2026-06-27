import type { Decision, Signals } from "../src/types.ts";
import { rmSync } from "node:fs";
import { expect, test } from "bun:test";
import { logDecision, readDecisions } from "../src/log.ts";

const TMP = "test/.tmp-decisions.jsonl";

function sig(p: Partial<Signals> = {}): Signals {
  return {
    agentId: "a1",
    sessionId: "sess-1",
    isSubagent: true,
    xApp: "cli",
    requestedModel: "claude-sonnet-4-6",
    systemText: "",
    tag: "flagship",
    hasThinking: false,
    tokensIn: 42,
    hasWebSearch: false,
    ...p,
  };
}
const dec: Decision = { alias: "flagship", upstream: "openrouter", model: "z-ai/glm-5.2", matchedRule: "tag:flagship" };

test("appends a decision record readable back", () => {
  rmSync(TMP, { force: true });
  logDecision(TMP, sig(), dec);
  logDecision(TMP, sig({ agentId: null, isSubagent: false }), { ...dec, upstream: "anthropic", model: "passthrough", matchedRule: "default" });
  const rows = readDecisions(TMP);
  expect(rows.length).toBe(2);
  expect(rows[0].upstream).toBe("openrouter");
  expect(rows[0].resolvedModel).toBe("z-ai/glm-5.2");
  expect(rows[1].isSubagent).toBe(false);
  rmSync(TMP, { force: true });
});
