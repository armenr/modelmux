import type { Config, ModelRef, RouteRule, Upstream, WorkType } from "./types.ts";
import { readFileSync, watch } from "node:fs";
import process from "node:process";

const UPSTREAMS: Upstream[] = ["anthropic", "openrouter"];
const WORK_TYPES = new Set<WorkType>(["background", "think", "longContext", "webSearch"]);

// A route's `when` must name exactly one recognized condition. Reject anything
// else at load so a typo'd/empty/ambiguous rule fails loud here instead of
// silently never matching (which would also defeat the hot-reload keep-last-good
// safety net, since loadConfig succeeding is what lets a bad config swap in).
function validateWhen(when: RouteRule["when"] | undefined): void {
  if (!when || typeof when !== "object")
    throw new Error("a route is missing its `when` clause");
  const active = (["tag", "workType", "anySubagent"] as const).filter(k => when[k] !== undefined);
  if (active.length === 0)
    throw new Error(`a route \`when\` names no condition (need tag / workType / anySubagent): ${JSON.stringify(when)}`);
  if (active.length > 1)
    throw new Error(`a route \`when\` must name exactly one condition, got: ${active.join(" + ")}`);
  if (when.workType !== undefined && !WORK_TYPES.has(when.workType))
    throw new Error(`unknown workType "${when.workType}" (expected one of: ${[...WORK_TYPES].join(" | ")})`);
  if (when.anySubagent !== undefined && when.anySubagent !== true)
    throw new Error("route `when.anySubagent` must be true when present");
}

export function parseModelRef(spec: string): ModelRef {
  const idx = spec.indexOf(":");
  if (idx === -1)
    throw new Error(`bad model spec (need "<upstream>:<slug>"): ${spec}`);
  const upstream = spec.slice(0, idx) as Upstream;
  const slug = spec.slice(idx + 1);
  if (!UPSTREAMS.includes(upstream))
    throw new Error(`unknown upstream: ${upstream}`);
  if (!slug)
    throw new Error(`empty slug in: ${spec}`);
  return { upstream, slug };
}

export function resolveMenu(
  config: Config,
  env: Record<string, string | undefined>,
): Config {
  const models = { ...config.models };
  const claimedBy = new Map<string, string>(); // MUX_MODEL_ key -> alias that owns it
  for (const alias of Object.keys(models)) {
    const key = `MUX_MODEL_${alias.toUpperCase().replace(/-/g, "_")}`;
    const prior = claimedBy.get(key);
    if (prior !== undefined && env[key])
      throw new Error(`aliases "${prior}" and "${alias}" both map to ${key}; rename one to avoid an ambiguous override`);
    claimedBy.set(key, alias);
    const override = env[key];
    if (override)
      models[alias] = parseModelRef(override);
  }
  return { ...config, models };
}

interface RawConfig {
  models: Record<string, string>;
  default: string;
  routes: Config["routes"];
  longContextThreshold?: number;
}

export function loadConfig(
  path: string,
  env: Record<string, string | undefined> = process.env,
): Config {
  const raw = Bun.TOML.parse(readText(path)) as unknown as RawConfig;
  if (!raw.models || typeof raw.models !== "object")
    throw new Error("routes.toml is missing a [models] table");
  const models: Record<string, ModelRef> = {};
  for (const [alias, spec] of Object.entries(raw.models)) {
    models[alias] = parseModelRef(spec);
  }
  const config: Config = {
    models,
    default: raw.default,
    routes: raw.routes ?? [],
    longContextThreshold: raw.longContextThreshold ?? 200000,
  };
  if (!config.default)
    throw new Error("routes.toml is missing a `default` alias");
  if (!models[config.default]) {
    throw new Error(`default alias "${config.default}" not in models`);
  }
  // Fail loud at load time: each route needs a valid `when` and a known target alias.
  for (const r of config.routes) {
    validateWhen(r.when);
    if (!models[r.use])
      throw new Error(`route uses unknown alias "${r.use}" (not in models)`);
  }
  return resolveMenu(config, env);
}

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

// Live config: a mutable holder reloaded on file change (enables `mux set` + hot-swap).
export interface ConfigHolder {
  current: Config;
}

export function watchConfig(
  path: string,
  env: Record<string, string | undefined> = process.env,
): ConfigHolder {
  const holder: ConfigHolder = { current: loadConfig(path, env) };
  try {
    watch(path, { persistent: false }, () => {
      try {
        holder.current = loadConfig(path, env);
        process.stderr.write(`[config] reloaded ${path}\n`);
      }
      catch (e) {
        process.stderr.write(`[config] reload failed, keeping previous: ${(e as Error).message}\n`);
      }
    });
  }
  catch {
    // fs.watch unsupported on this platform — static config still works.
  }
  return holder;
}
