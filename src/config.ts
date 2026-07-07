import type { AuthMode, Config, ModelRef, RouteRule, UpstreamDef, WorkType } from "./types.ts";
import { readFileSync, watch } from "node:fs";
import process from "node:process";
import { BUILTIN_UPSTREAMS } from "./upstreams.ts";

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

// Split "<upstream>:<slug>" into its parts (shape only). Whether the upstream
// name actually exists is validated against the [upstreams] table in loadConfig.
export function parseModelRef(spec: string): ModelRef {
  const idx = spec.indexOf(":");
  if (idx === -1)
    throw new Error(`bad model spec (need "<upstream>:<slug>"): ${spec}`);
  const upstream = spec.slice(0, idx);
  const slug = spec.slice(idx + 1);
  if (!upstream)
    throw new Error(`empty upstream in: ${spec}`);
  if (!slug)
    throw new Error(`empty slug in: ${spec}`);
  return { upstream, slug };
}

interface RawUpstream {
  base?: string;
  auth?: string;
  stripBeta?: boolean;
}

// Parse an auth spec: "passthrough" | "passthrough:ENV" | "bearer:ENV" | "none".
export function parseAuth(spec: string): AuthMode {
  if (spec === "none")
    return { kind: "none" };
  if (spec === "passthrough")
    return { kind: "passthrough" };
  if (spec.startsWith("passthrough:"))
    return { kind: "passthrough", envKey: spec.slice("passthrough:".length) };
  if (spec.startsWith("bearer:")) {
    const envKey = spec.slice("bearer:".length);
    if (!envKey)
      throw new Error("bearer auth needs an env var, e.g. auth = \"bearer:MY_API_KEY\"");
    return { kind: "bearer", envKey };
  }
  throw new Error(`unknown auth "${spec}" (use passthrough | passthrough:ENV | bearer:ENV | none)`);
}

// Merge any user-declared [upstreams] over the built-ins (anthropic, openrouter, zai).
function buildUpstreams(raw: Record<string, RawUpstream> | undefined): Record<string, UpstreamDef> {
  const out: Record<string, UpstreamDef> = { ...BUILTIN_UPSTREAMS };
  for (const [name, u] of Object.entries(raw ?? {})) {
    if (!u || typeof u !== "object" || typeof u.base !== "string" || !u.base)
      throw new Error(`upstream "${name}" needs a base URL, e.g. base = "http://localhost:11434"`);
    const auth = parseAuth(u.auth ?? "none");
    const stripBeta = u.stripBeta ?? (auth.kind !== "passthrough");
    out[name] = { base: u.base, auth, stripBeta };
  }
  return out;
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
  upstreams?: Record<string, RawUpstream>;
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
    upstreams: buildUpstreams(raw.upstreams),
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
  const resolved = resolveMenu(config, env);
  // Every model's upstream must be built in or declared in [upstreams].
  for (const [alias, ref] of Object.entries(resolved.models)) {
    if (!resolved.upstreams?.[ref.upstream])
      throw new Error(`model "${alias}" uses unknown upstream "${ref.upstream}" — built-ins are anthropic, openrouter, and zai; add others under [upstreams]`);
  }
  return resolved;
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
