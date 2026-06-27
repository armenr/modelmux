import type { Config } from "../src/types.ts";
import { expect, test } from "bun:test";
import { listModels, setModel } from "../src/cli.ts";

test("setModel rewrites an alias in routes text", () => {
  const text = `{
    "models": { "flagship": "openrouter:z-ai/glm-5.2" },
    "default": "flagship", "routes": []
  }`;
  const out = setModel(text, "flagship", "openrouter:z-ai/glm-4.6");
  expect(out).toContain("\"flagship\": \"openrouter:z-ai/glm-4.6\"");
  // still valid + parseable
  expect(JSON.parse(out.replace(/,(\s*[}\]])/g, "$1")).models.flagship).toBe("openrouter:z-ai/glm-4.6");
});

test("setModel rejects an invalid spec", () => {
  expect(() => setModel(`{"models":{"x":"a:b"},"default":"x","routes":[]}`, "x", "bogus:y")).toThrow();
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
