import process from "node:process";
import { expect, test } from "bun:test";
import { buildSmokeProbe, run } from "../scripts/live-smoke.ts";

test("buildSmokeProbe is a flagship-tagged subagent request", () => {
  const p = buildSmokeProbe();
  expect(p.headers["x-claude-code-agent-id"]).toBeTruthy();
  expect(p.body.system).toContain("<<route:flagship>>");
  expect(p.body.max_tokens).toBeLessThanOrEqual(32);
});

test("run() skips cleanly (exit 0) when OPENROUTER_API_KEY is unset", async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    expect(await run()).toBe(0);
  }
  finally {
    if (saved !== undefined)
      process.env.OPENROUTER_API_KEY = saved;
  }
});
