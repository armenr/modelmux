import type { Config } from "../src/types.ts";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { anySubagentSink, untaggedAgents, untaggedAgentWarning } from "../src/agents.ts";

function agentsDir(files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), "mux-agents-")), ".claude", "agents");
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(dir, name), body);
  return dir;
}

function config(anySubagentUse: string | null, models: Config["models"]): Config {
  return {
    models,
    default: "orchestrator",
    routes: anySubagentUse === null ? [] : [{ when: { anySubagent: true }, use: anySubagentUse }],
    longContextThreshold: 200000,
  };
}

const DIVERTS = config("flagship", {
  orchestrator: { upstream: "anthropic", slug: "passthrough" },
  flagship: { upstream: "openrouter", slug: "z-ai/glm-5.2" },
});

// --- untaggedAgents -----------------------------------------------------------

test("untaggedAgents finds the untagged and ignores the tagged", () => {
  const dir = agentsDir({
    "kit-agent.md": "---\nname: kit-agent\n---\n\nNo tag here.\n",
    "mine.md": "---\nname: mine\n---\n\n<<route:control>>\n\nTagged.\n",
  });
  expect(untaggedAgents(dir)).toEqual(["kit-agent"]);
});

test("untaggedAgents ignores non-markdown and returns sorted names", () => {
  const dir = agentsDir({
    "zebra.md": "untagged",
    "alpha.md": "untagged",
    "notes.txt": "untagged but not an agent",
  });
  expect(untaggedAgents(dir)).toEqual(["alpha", "zebra"]);
});

test("untaggedAgents on a missing directory is empty, not a throw", () => {
  expect(untaggedAgents("/nonexistent-probe-root/.claude/agents")).toEqual([]);
});

// --- anySubagentSink: the three cases where silence is correct ----------------

test("no anySubagent rule -> no sink", () => {
  expect(anySubagentSink(config(null, { orchestrator: { upstream: "anthropic", slug: "passthrough" } }))).toBeNull();
});

test("anySubagent pointing at passthrough is not a diversion", () => {
  // Still Claude, still the model Claude Code picked. Warning here would be noise.
  const cfg = config("orchestrator", { orchestrator: { upstream: "anthropic", slug: "passthrough" } });
  expect(anySubagentSink(cfg)).toBeNull();
});

test("anySubagent pointing at an unconfigured alias -> no sink (route() owns that error)", () => {
  expect(anySubagentSink(config("ghost", { orchestrator: { upstream: "anthropic", slug: "passthrough" } }))).toBeNull();
});

test("anySubagent pointing at a real non-passthrough alias IS a sink", () => {
  expect(anySubagentSink(DIVERTS)).toEqual({ alias: "flagship", ref: "openrouter:z-ai/glm-5.2" });
});

// --- the warning itself -------------------------------------------------------

test("warning names every untagged agent, the sink, and the fix", () => {
  const dir = agentsDir({
    "kit-agent.md": "no tag",
    "other-kit-agent.md": "no tag",
    "mine.md": "<<route:control>>",
  });
  const out = untaggedAgentWarning(DIVERTS, dir);
  expect(out).toContain("kit-agent");
  expect(out).toContain("other-kit-agent");
  expect(out).not.toContain("mine");
  expect(out).toContain("openrouter:z-ai/glm-5.2");
  expect(out).toContain("modelmux tag <name> control");
});

test("warning is SILENT when every agent is tagged", () => {
  const dir = agentsDir({ "mine.md": "<<route:control>>" });
  expect(untaggedAgentWarning(DIVERTS, dir)).toBeNull();
});

test("warning is SILENT when nothing would divert an untagged agent", () => {
  // Untagged agents present, but anySubagent resolves to passthrough — the
  // falsifier for warning on agent-state alone instead of on actual exposure.
  const dir = agentsDir({ "kit-agent.md": "no tag" });
  const harmless = config("orchestrator", { orchestrator: { upstream: "anthropic", slug: "passthrough" } });
  expect(untaggedAgentWarning(harmless, dir)).toBeNull();
});

test("warning is SILENT when there is no agents directory at all", () => {
  expect(untaggedAgentWarning(DIVERTS, "/nonexistent-probe-root/.claude/agents")).toBeNull();
});
