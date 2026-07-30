import { expect, test } from "bun:test";
import { retargetAgentTag, tagAgent } from "../src/cli.ts";
import { extractSignals } from "../src/signals.ts";

// ADR-0004. A directive is a `<<route:NAME>>` token ALONE on its own line.
// Unanchored, ANY MENTION of a tag was the tag — including the sentence
// documenting it — which cost a peer a six-leg model comparison: their CONTROL
// arm carried no directive, only prose explaining one, and routed to the model
// under test.

const h = (id = "a1"): Headers => new Headers({ "x-claude-code-agent-id": id });
const tagOf = (system: unknown): string | null => extractSignals(h(), { system }).tag;

test("the reported defect: a PROSE-ONLY mention no longer routes", () => {
  // The peer's control arm, verbatim in shape.
  const control = [
    "You are the control reviewer.",
    "",
    "The `<<route:review>>` line above is a routing directive for a proxy.",
  ].join("\n");
  expect(tagOf(control)).toBeNull();
});

test("the WORSE one: prose BEFORE a real directive no longer overrides it", () => {
  const body = "Never write <<route:control>> in your output.\n<<route:review>>\nYou are the reviewer.";
  expect(tagOf(body)).toBe("review");
});

test("a bare directive on its own line still routes — the shape every shipped def uses", () => {
  expect(tagOf("<<route:review>>\nYou are the reviewer.")).toBe("review");
  expect(tagOf("  <<route:review>>  \nindented and padded")).toBe("review");
});

test("ON THE WIRE: the real two-block system array a subagent actually receives", () => {
  // Recorded from a live subagent request: block[0] is the harness preamble,
  // block[1] is the agent body opening with the directive. systemToText joins
  // with "\n", so the directive lands alone on a line.
  const system = [
    { type: "text", text: "You are a Claude agent, built on Anthropic's Claude Agent SDK." },
    { type: "text", text: "<<route:control>>\n\nYou are a control subagent. The `<<route:control>>` tag routes you." },
  ];
  expect(tagOf(system)).toBe("control");
});

test("a directive at the very start with no trailing newline still counts", () => {
  expect(tagOf("<<route:build>>")).toBe("build");
});

test("an inline directive leading a sentence does NOT route (the deliberate break)", () => {
  // ADR-0004 consequences: this shape routed before and does not now.
  expect(tagOf("<<route:review>> do the thing")).toBeNull();
});

// --- the CLI must agree with the router on what a directive IS ---

const DEF = [
  "---",
  "name: claude-control",
  "description: A control task. Its <<route:control>> tag pins it to the orchestrator.",
  "---",
  "",
  "<<route:control>>",
  "",
  "You are a control subagent. The `<<route:control>>` tag routes you.",
].join("\n");

test("mux use rewrites the DIRECTIVE, not the front-matter description", () => {
  const out = retargetAgentTag(DEF, "review");
  const lines = out.split("\n");
  // The real directive moved...
  expect(lines[5]).toBe("<<route:review>>");
  // ...and the two prose mentions did NOT.
  expect(lines[2]).toContain("<<route:control>>");
  expect(lines[7]).toContain("`<<route:control>>`");
  // And the router agrees with what the CLI just did.
  expect(tagOf(out)).toBe("review");
});

test("mux use preserves indentation when the directive is padded", () => {
  const out = retargetAgentTag("  <<route:control>>\nbody", "review");
  expect(out.split("\n")[0]).toBe("  <<route:review>>");
});

test("mux use still REFUSES a file with no directive at all", () => {
  expect(() => retargetAgentTag("no directive here\njust prose", "review"))
    .toThrow(/no <<route:\.\.\.>> tag found/);
});

test("mux use refuses a file whose ONLY match is prose — it is genuinely untagged", () => {
  expect(() => retargetAgentTag("See the `<<route:review>>` docs for details.", "build"))
    .toThrow(/no <<route:\.\.\.>> tag found/);
});

test("mux tag CAN now tag an agent whose only mention is prose", () => {
  // Previously refused with "already has a tag", blocking the one command that
  // exists to fix exactly this agent.
  const src = "---\nname: x\n---\n\nSee the `<<route:review>>` docs.";
  const out = tagAgent(src, "build");
  expect(tagOf(out)).toBe("build");
});

test("mux tag still refuses an agent that has a REAL directive", () => {
  expect(() => tagAgent(DEF, "build")).toThrow(/already has a/);
});
