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

test("watchConfig keeps previous config when a reload fails, then recovers", async () => {
  const tmp = "test/.tmp-watch-bad.jsonc";
  writeFileSync(tmp, JSON.stringify({ models: { a: "openrouter:x/y1" }, default: "a", routes: [] }));
  const holder = watchConfig(tmp, {});
  expect(holder.current.models.a.slug).toBe("x/y1");
  // unparseable edit: must be caught, previous kept, no crash
  writeFileSync(tmp, "{ this is not valid json");
  await Bun.sleep(300);
  expect(holder.current.models.a.slug).toBe("x/y1");
  // recovery: a subsequent valid edit still reloads
  writeFileSync(tmp, JSON.stringify({ models: { a: "openrouter:x/y3" }, default: "a", routes: [] }));
  for (let i = 0; i < 40 && holder.current.models.a.slug !== "x/y3"; i++) await Bun.sleep(50);
  expect(holder.current.models.a.slug).toBe("x/y3");
  rmSync(tmp, { force: true });
});

test("loadConfig throws when default alias is absent from models (fail loud)", () => {
  const tmp = "test/.tmp-bad-default.jsonc";
  writeFileSync(tmp, JSON.stringify({ models: { a: "openrouter:x/y" }, default: "ghost", routes: [] }));
  expect(() => loadConfig(tmp, {})).toThrow();
  rmSync(tmp, { force: true });
});

test("resolveMenu maps a hyphenated alias to the HETERO_MODEL_ underscore form", () => {
  const cfg = {
    models: { "claude-review": { upstream: "anthropic", slug: "claude-sonnet-4.6" } },
    default: "claude-review",
    routes: [],
    longContextThreshold: 200000,
  } as any;
  const out = resolveMenu(cfg, { HETERO_MODEL_CLAUDE_REVIEW: "openrouter:z-ai/glm-5.2" });
  expect(out.models["claude-review"]).toEqual({ upstream: "openrouter", slug: "z-ai/glm-5.2" });
});
