import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { loadConfig, parseAuth, parseModelRef, resolveMenu, watchConfig } from "../src/config.ts";

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

test("parseModelRef validates shape, not the upstream name", () => {
  expect(() => parseModelRef("no-colon-here")).toThrow(/upstream.*slug/);
  expect(() => parseModelRef("openrouter:")).toThrow(/empty slug/);
  expect(() => parseModelRef(":slug")).toThrow(/empty upstream/);
  // an unknown upstream name is fine at parse time — it's checked against [upstreams] at load
  expect(parseModelRef("local:qwen3-coder:30b")).toEqual({ upstream: "local", slug: "qwen3-coder:30b" });
});

test("parseAuth understands the auth shorthands", () => {
  expect(parseAuth("none")).toEqual({ kind: "none" });
  expect(parseAuth("passthrough")).toEqual({ kind: "passthrough" });
  expect(parseAuth("passthrough:ANTHROPIC_API_KEY")).toEqual({ kind: "passthrough", envKey: "ANTHROPIC_API_KEY" });
  expect(parseAuth("bearer:OPENROUTER_API_KEY")).toEqual({ kind: "bearer", envKey: "OPENROUTER_API_KEY" });
  expect(() => parseAuth("weird")).toThrow();
});

test("loadConfig parses [upstreams] and accepts a model that targets one", () => {
  const tmp = "test/.tmp-upstreams.toml";
  writeFileSync(tmp, `default = "a"\n\n[models]\na = "local:qwen3-coder:30b"\n\n[upstreams]\nlocal = { base = "http://localhost:11434", auth = "none" }\n`);
  const cfg = loadConfig(tmp, {});
  expect(cfg.models.a).toEqual({ upstream: "local", slug: "qwen3-coder:30b" });
  expect(cfg.upstreams?.local).toEqual({ base: "http://localhost:11434", auth: { kind: "none" }, stripBeta: true });
  expect(cfg.upstreams?.anthropic).toBeDefined(); // built-ins still present
  rmSync(tmp, { force: true });
});

test("loadConfig accepts a built-in zai model with no [upstreams] block", () => {
  const tmp = "test/.tmp-zai.toml";
  writeFileSync(tmp, toml({ orchestrator: "anthropic:passthrough", flagship: "zai:glm-5.2" }, "orchestrator"));
  const cfg = loadConfig(tmp, {});
  expect(cfg.models.flagship).toEqual({ upstream: "zai", slug: "glm-5.2" });
  expect(cfg.upstreams?.zai?.base).toBe("https://api.z.ai/api/anthropic");
  rmSync(tmp, { force: true });
});

test("loadConfig rejects a model whose upstream is neither built in nor declared", () => {
  const tmp = "test/.tmp-bad-upstream.toml";
  writeFileSync(tmp, toml({ a: "local:qwen" }, "a")); // no [upstreams] table -> "local" is undefined
  expect(() => loadConfig(tmp, {})).toThrow(/unknown upstream/);
  rmSync(tmp, { force: true });
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

test("loadConfig rejects a route with a malformed `when` (fail loud)", () => {
  const tmp = "test/.tmp-bad-when.toml";
  writeFileSync(tmp, toml({ a: "openrouter:x/y" }, "a", `\n[[routes]]\nuse = "a"\n`)); // no `when`
  expect(() => loadConfig(tmp, {})).toThrow(/when/);
  writeFileSync(tmp, toml({ a: "openrouter:x/y" }, "a", `\n[[routes]]\nwhen.workType = "thinking"\nuse = "a"\n`)); // typo
  expect(() => loadConfig(tmp, {})).toThrow(/workType/);
  rmSync(tmp, { force: true });
});

test("loadConfig rejects a multi-condition `when` as ambiguous", () => {
  const tmp = "test/.tmp-multi-when.toml";
  writeFileSync(tmp, toml({ a: "openrouter:x/y" }, "a", `\n[[routes]]\nwhen.tag = "a"\nwhen.anySubagent = true\nuse = "a"\n`));
  expect(() => loadConfig(tmp, {})).toThrow(/exactly one/);
  rmSync(tmp, { force: true });
});

test("loadConfig gives a clear error when [models] is missing", () => {
  const tmp = "test/.tmp-no-models.toml";
  writeFileSync(tmp, `default = "a"\n`);
  expect(() => loadConfig(tmp, {})).toThrow(/\[models\]/);
  rmSync(tmp, { force: true });
});

test("resolveMenu throws when two aliases collide on one MUX_MODEL_ key", () => {
  const cfg = {
    models: {
      "claude-review": { upstream: "anthropic", slug: "claude-sonnet-5" },
      "claude_review": { upstream: "openrouter", slug: "z-ai/glm-5.2" },
    },
    default: "claude-review",
    routes: [],
    longContextThreshold: 200000,
  } as any;
  expect(() => resolveMenu(cfg, { MUX_MODEL_CLAUDE_REVIEW: "openrouter:x/y" })).toThrow(/both map to/);
});

// The watched file lives in its OWN directory so macOS FSEvents delivers only
// its events — other test files churning test/ won't coalesce/drop them (which
// made these flaky under full-suite load). We also arm the watcher before the
// first mutating write, and poll with a wide budget that exits on first change.
test("watchConfig reloads holder.current on file change", async () => {
  const dir = "test/.tmp-watch-a";
  mkdirSync(dir, { recursive: true });
  const tmp = `${dir}/routes.toml`;
  writeFileSync(tmp, toml({ a: "openrouter:x/y1" }, "a"));
  const holder = watchConfig(tmp, {});
  expect(holder.current.models.a.slug).toBe("x/y1");
  await Bun.sleep(100); // let the OS-level watch arm before mutating
  writeFileSync(tmp, toml({ a: "openrouter:x/y2" }, "a"));
  for (let i = 0; i < 120 && holder.current.models.a.slug !== "x/y2"; i++) await Bun.sleep(50);
  expect(holder.current.models.a.slug).toBe("x/y2");
  rmSync(dir, { recursive: true, force: true });
});

test("watchConfig keeps previous config when a reload fails, then recovers", async () => {
  const dir = "test/.tmp-watch-b";
  mkdirSync(dir, { recursive: true });
  const tmp = `${dir}/routes.toml`;
  writeFileSync(tmp, toml({ a: "openrouter:x/y1" }, "a"));
  const holder = watchConfig(tmp, {});
  expect(holder.current.models.a.slug).toBe("x/y1");
  await Bun.sleep(100); // arm the watcher
  // unparseable edit: must be caught, previous kept, no crash
  writeFileSync(tmp, "[[[ not valid toml");
  await Bun.sleep(400);
  expect(holder.current.models.a.slug).toBe("x/y1");
  // recovery: a subsequent valid edit still reloads
  writeFileSync(tmp, toml({ a: "openrouter:x/y3" }, "a"));
  for (let i = 0; i < 120 && holder.current.models.a.slug !== "x/y3"; i++) await Bun.sleep(50);
  expect(holder.current.models.a.slug).toBe("x/y3");
  rmSync(dir, { recursive: true, force: true });
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
