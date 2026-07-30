import type { Config } from "../src/types.ts";
import { expect, test } from "bun:test";
import { listModels, retargetAgentTag, runCli, setModel, tagAgent } from "../src/cli.ts";
import { extractSignals } from "../src/signals.ts";

const ROUTES = `# menu
default = "flagship"

[models]
flagship = "openrouter:z-ai/glm-5.2" # keep this comment
claude-review = "anthropic:claude-sonnet-5"
`;

test("setModel rewrites an alias in TOML text and it re-parses", () => {
  const out = setModel(ROUTES, "flagship", "openrouter:z-ai/glm-4.6");
  expect(out).toContain(`flagship = "openrouter:z-ai/glm-4.6"`);
  expect((Bun.TOML.parse(out) as any).models.flagship).toBe("openrouter:z-ai/glm-4.6");
});

test("setModel preserves surrounding lines and comments", () => {
  const out = setModel(ROUTES, "flagship", "openrouter:z-ai/glm-4.6");
  expect(out).toContain("# keep this comment");
  expect(out).toContain("# menu");
  expect((Bun.TOML.parse(out) as any).models["claude-review"]).toBe("anthropic:claude-sonnet-5");
});

test("setModel handles a hyphenated alias without clobbering others", () => {
  const out = setModel(ROUTES, "claude-review", "openrouter:z-ai/glm-5.2");
  expect((Bun.TOML.parse(out) as any).models["claude-review"]).toBe("openrouter:z-ai/glm-5.2");
  expect((Bun.TOML.parse(out) as any).models.flagship).toBe("openrouter:z-ai/glm-5.2");
});

test("setModel throws on an unknown alias", () => {
  expect(() => setModel(ROUTES, "ghost", "openrouter:x/y")).toThrow(/not found/);
});

test("setModel rejects a malformed spec", () => {
  expect(() => setModel(`[models]\nx = "a:b"\n`, "x", "no-colon-spec")).toThrow();
});

test("listModels renders each alias", () => {
  const cfg: Config = {
    models: { flagship: { upstream: "openrouter", slug: "z-ai/glm-5.2" } },
    default: "flagship",
    routes: [],
    longContextThreshold: 200000,
  };
  expect(listModels(cfg)).toContain("flagship");
  expect(listModels(cfg)).toContain("z-ai/glm-5.2");
});

test("retargetAgentTag swaps the own-line route directive", () => {
  // Was "swaps the FIRST route tag", asserting `"intro <<route:flagship>> rest"`.
  // ADR-0004 removed "first match anywhere" as a concept: the CLI and the router
  // now share one definition of a directive, which is what stops `mux use` from
  // rewriting a doc string and reporting success.
  expect(retargetAgentTag("intro\n<<route:flagship>>\nrest", "max")).toContain("<<route:max>>");
});

test("retargetAgentTag throws instead of a false success when there is no tag", () => {
  expect(() => retargetAgentTag("an agent with no route tag", "max")).toThrow(/no <<route/);
});

// --- tagAgent: the insert path `use` deliberately refuses to take -------------

const UNTAGGED = `---
name: kit-agent
description: a third-party agent, untagged by construction
tools:
  - Read
---

You are a helper. Report findings to the orchestrator.
`;

test("tagAgent inserts a first tag into an untagged agent", () => {
  expect(tagAgent(UNTAGGED, "control")).toContain("<<route:control>>");
});

test("tagAgent puts the tag in the PROMPT BODY, not the front matter", () => {
  // The proxy only ever sees the body; a tag parked inside `---` fences would
  // look present on disk and route nothing. This is the falsifier for placement.
  const out = tagAgent(UNTAGGED, "control");
  const body = out.slice(out.indexOf("---", 3) + 3);
  expect(body).toContain("<<route:control>>");
  expect(out.indexOf("<<route:control>>")).toBeGreaterThan(out.lastIndexOf("---"));
});

// Claude Code sends the agent's PROMPT BODY as `system`; the YAML front matter
// is harness metadata and never reaches the proxy. Strip it the same way, or a
// signal-path test silently passes on a tag that only exists in the front matter.
function bodyOnly(agentFile: string): string {
  return agentFile.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

test("a tag inserted by tagAgent is the one the router actually extracts", () => {
  // End-to-end on the real signal path, against the text the proxy really sees.
  const tagged = tagAgent(UNTAGGED, "control");
  const signals = extractSignals(new Headers(), { system: bodyOnly(tagged) });
  expect(signals.tag).toBe("control");
});

test("tagAgent refuses to overwrite an existing tag (symmetric with use)", () => {
  // Was `"body <<route:flagship>>"` (trailing inline). ADR-0004: only an
  // own-line directive counts as "already tagged" — a prose mention must NOT
  // block tagging, which is a separate test in tag-must-be-own-line.test.ts.
  expect(() => tagAgent("body\n<<route:flagship>>", "control")).toThrow(/already has/);
});

test("tagAgent output is then retargetable by use", () => {
  const tagged = tagAgent(UNTAGGED, "control");
  expect(retargetAgentTag(tagged, "reasoner")).toContain("<<route:reasoner>>");
});

test("tagAgent handles an agent file with no front matter", () => {
  const out = tagAgent("Just a prompt body.\n", "control");
  expect(out.startsWith("<<route:control>>")).toBe(true);
  expect(extractSignals(new Headers(), { system: bodyOnly(out) }).tag).toBe("control");
});

test("tagAgent preserves CRLF front matter without mangling it", () => {
  const crlf = "---\r\nname: x\r\n---\r\n\r\nBody line.\r\n";
  const out = tagAgent(crlf, "control");
  expect(out).toContain("name: x");
  expect(out).toContain("Body line.");
  expect(extractSignals(new Headers(), { system: bodyOnly(out) }).tag).toBe("control");
});

test("runCli returns a clean exit code 1 (no stack trace) on a bad set spec", async () => {
  // parseModelRef rejects a colon-less spec before any write, so routes.toml is untouched.
  expect(await runCli(["set", "flagship", "bogus-no-colon"])).toBe(1);
});
