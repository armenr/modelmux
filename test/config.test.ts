import { rmSync, writeFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { loadConfig, parseModelRef, resolveMenu, watchConfig } from "../src/config.ts";

test("parseModelRef splits upstream and slug", () => {
  expect(parseModelRef("openrouter:z-ai/glm-5.2")).toEqual({
    upstream: "openrouter",
    slug: "z-ai/glm-5.2",
  });
  expect(parseModelRef("anthropic:passthrough")).toEqual({
    upstream: "anthropic",
    slug: "passthrough",
  });
});

test("parseModelRef rejects unknown upstream", () => {
  expect(() => parseModelRef("bogus:x")).toThrow();
});

test("resolveMenu applies HETERO_MODEL_<ALIAS> overrides", () => {
  const cfg = {
    models: { flagship: { upstream: "openrouter", slug: "z-ai/glm-5.2" } },
    default: "flagship",
    routes: [],
    longContextThreshold: 200000,
  } as const;
  const out = resolveMenu(cfg as any, { HETERO_MODEL_FLAGSHIP: "openrouter:z-ai/glm-4.6" });
  expect(out.models.flagship).toEqual({ upstream: "openrouter", slug: "z-ai/glm-4.6" });
});

test("loadConfig reads routes.jsonc and defaults the threshold", () => {
  const cfg = loadConfig("routes.jsonc", {});
  expect(cfg.models.flagship).toEqual({ upstream: "openrouter", slug: "z-ai/glm-5.2" });
  expect(cfg.default).toBe("orchestrator");
  expect(cfg.longContextThreshold).toBe(200000);
});

test("loadConfig rejects a route using an unknown alias (fail loud)", () => {
  const tmp = "test/.tmp-bad-routes.jsonc";
  writeFileSync(tmp, JSON.stringify({
    models: { a: "openrouter:x/y" },
    default: "a",
    routes: [{ when: { anySubagent: true }, use: "ghost" }],
  }));
  expect(() => loadConfig(tmp, {})).toThrow();
  rmSync(tmp, { force: true });
});

test("watchConfig reloads holder.current on file change", async () => {
  const tmp = "test/.tmp-watch.jsonc";
  writeFileSync(tmp, JSON.stringify({ models: { a: "openrouter:x/y1" }, default: "a", routes: [] }));
  const holder = watchConfig(tmp, {});
  expect(holder.current.models.a.slug).toBe("x/y1");
  writeFileSync(tmp, JSON.stringify({ models: { a: "openrouter:x/y2" }, default: "a", routes: [] }));
  for (let i = 0; i < 40 && holder.current.models.a.slug !== "x/y2"; i++) await Bun.sleep(50);
  expect(holder.current.models.a.slug).toBe("x/y2");
  rmSync(tmp, { force: true });
});
