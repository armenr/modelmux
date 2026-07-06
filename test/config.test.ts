import { rmSync, writeFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { loadConfig, parseModelRef, resolveMenu, watchConfig } from "../src/config.ts";

// Build a minimal routes.toml body for temp-file tests.
function toml(models: Record<string, string>, def: string, extra = ""): string {
  const m = Object.entries(models).map(([k, v]) => `${k} = "${v}"`).join("\n");
  return `default = "${def}"\n\n[models]\n${m}\n${extra}`;
}

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

test("resolveMenu applies MUX_MODEL_<ALIAS> overrides", () => {
  const cfg = {
    models: { flagship: { upstream: "openrouter", slug: "z-ai/glm-5.2" } },
    default: "flagship",
    routes: [],
    longContextThreshold: 200000,
  } as const;
  const out = resolveMenu(cfg as any, { MUX_MODEL_FLAGSHIP: "openrouter:z-ai/glm-4.6" });
  expect(out.models.flagship).toEqual({ upstream: "openrouter", slug: "z-ai/glm-4.6" });
});

test("loadConfig reads the real routes.toml and defaults the threshold", () => {
  const cfg = loadConfig("routes.toml", {});
  expect(cfg.models.flagship).toEqual({ upstream: "openrouter", slug: "z-ai/glm-5.2" });
  expect(cfg.default).toBe("orchestrator");
  expect(cfg.longContextThreshold).toBe(200000);
});

test("routes.toml keeps the control route ahead of anySubagent (pins to Claude)", () => {
  const cfg = loadConfig("routes.toml", {});
  const ci = cfg.routes.findIndex(r => r.when.tag === "control");
  const ai = cfg.routes.findIndex(r => r.when.anySubagent === true);
  expect(ci).toBeGreaterThanOrEqual(0);
  expect(cfg.routes[ci].use).toBe("orchestrator");
  expect(ai).toBeGreaterThan(ci);
});

test("loadConfig rejects a route using an unknown alias (fail loud)", () => {
  const tmp = "test/.tmp-bad-routes.toml";
  writeFileSync(tmp, toml({ a: "openrouter:x/y" }, "a", `\n[[routes]]\nwhen.anySubagent = true\nuse = "ghost"\n`));
  expect(() => loadConfig(tmp, {})).toThrow();
  rmSync(tmp, { force: true });
});

test("watchConfig reloads holder.current on file change", async () => {
  const tmp = "test/.tmp-watch.toml";
  writeFileSync(tmp, toml({ a: "openrouter:x/y1" }, "a"));
  const holder = watchConfig(tmp, {});
  expect(holder.current.models.a.slug).toBe("x/y1");
  writeFileSync(tmp, toml({ a: "openrouter:x/y2" }, "a"));
  for (let i = 0; i < 40 && holder.current.models.a.slug !== "x/y2"; i++) await Bun.sleep(50);
  expect(holder.current.models.a.slug).toBe("x/y2");
  rmSync(tmp, { force: true });
});

test("watchConfig keeps previous config when a reload fails, then recovers", async () => {
  const tmp = "test/.tmp-watch-bad.toml";
  writeFileSync(tmp, toml({ a: "openrouter:x/y1" }, "a"));
  const holder = watchConfig(tmp, {});
  expect(holder.current.models.a.slug).toBe("x/y1");
  // unparseable edit: must be caught, previous kept, no crash
  writeFileSync(tmp, "[[[ not valid toml");
  await Bun.sleep(300);
  expect(holder.current.models.a.slug).toBe("x/y1");
  // recovery: a subsequent valid edit still reloads
  writeFileSync(tmp, toml({ a: "openrouter:x/y3" }, "a"));
  for (let i = 0; i < 40 && holder.current.models.a.slug !== "x/y3"; i++) await Bun.sleep(50);
  expect(holder.current.models.a.slug).toBe("x/y3");
  rmSync(tmp, { force: true });
});

test("loadConfig throws when default alias is absent from models (fail loud)", () => {
  const tmp = "test/.tmp-bad-default.toml";
  writeFileSync(tmp, toml({ a: "openrouter:x/y" }, "ghost"));
  expect(() => loadConfig(tmp, {})).toThrow();
  rmSync(tmp, { force: true });
});

test("resolveMenu maps a hyphenated alias to the MUX_MODEL_ underscore form", () => {
  const cfg = {
    models: { "claude-review": { upstream: "anthropic", slug: "claude-sonnet-5" } },
    default: "claude-review",
    routes: [],
    longContextThreshold: 200000,
  } as any;
  const out = resolveMenu(cfg, { MUX_MODEL_CLAUDE_REVIEW: "openrouter:z-ai/glm-5.2" });
  expect(out.models["claude-review"]).toEqual({ upstream: "openrouter", slug: "z-ai/glm-5.2" });
});
