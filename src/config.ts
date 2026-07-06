import type { Config, ModelRef, Upstream } from "./types.ts";
import { readFileSync, watch } from "node:fs";
import process from "node:process";
import { parseJsonc } from "./jsonc.ts";

const UPSTREAMS: Upstream[] = ["anthropic", "openrouter"];

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
  for (const alias of Object.keys(models)) {
    const key = `MUX_MODEL_${alias.toUpperCase().replace(/-/g, "_")}`;
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
  const raw = parseJsonc(readText(path)) as RawConfig;
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
  if (!models[config.default]) {
    throw new Error(`default alias "${config.default}" not in models`);
  }
  // Fail loud at load time: every route's target alias must exist.
  for (const r of config.routes) {
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
