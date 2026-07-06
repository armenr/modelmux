import type { Config } from "../src/types.ts";
import { expect, test } from "bun:test";
import { listModels, retargetAgentTag, runCli, setModel } from "../src/cli.ts";

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

test("setModel rejects an invalid spec", () => {
  expect(() => setModel(`[models]\nx = "a:b"\n`, "x", "bogus:y")).toThrow();
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

test("retargetAgentTag swaps the first route tag", () => {
  expect(retargetAgentTag("intro <<route:flagship>> rest", "max")).toContain("<<route:max>>");
});

test("retargetAgentTag throws instead of a false success when there is no tag", () => {
  expect(() => retargetAgentTag("an agent with no route tag", "max")).toThrow(/no <<route/);
});

test("runCli returns a clean exit code 1 (no stack trace) on a bad set spec", async () => {
  // parseModelRef rejects a colon-less spec before any write, so routes.toml is untouched.
  expect(await runCli(["set", "flagship", "bogus-no-colon"])).toBe(1);
});
