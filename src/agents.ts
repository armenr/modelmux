import type { Config } from "./types.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TAG_RE = /<<route:[\w-]+>>/i;
const AGENTS_DIR = join(".claude", "agents");

// Agent files in `dir` carrying no <<route:>> tag, sorted. A missing or
// unreadable directory yields none — a project without .claude/agents/ is the
// normal case, not an error.
export function untaggedAgents(dir: string = AGENTS_DIR): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  }
  catch {
    return [];
  }
  return entries
    .filter(f => f.endsWith(".md"))
    .filter((f) => {
      try {
        return !TAG_RE.test(readFileSync(join(dir, f), "utf8"));
      }
      catch {
        return false; // unreadable file: not our business to claim it is untagged
      }
    })
    .map(f => f.slice(0, -3))
    .sort();
}

// Where an untagged subagent actually lands, or null when nothing diverts it.
// Null in three cases, each meaning "there is nothing to warn about":
//   - no anySubagent rule in the cascade at all
//   - it resolves to an alias that is not configured (route() will throw loudly
//     on its own; a startup warning would be the wrong messenger)
//   - it resolves to anthropic:passthrough, i.e. still Claude, still the model
//     Claude Code picked — a diversion in name only
export function anySubagentSink(config: Config): { alias: string; ref: string } | null {
  const rule = config.routes.find(r => r.when.anySubagent === true);
  if (!rule)
    return null;
  const ref = config.models[rule.use];
  if (!ref)
    return null;
  if (ref.upstream === "anthropic" && ref.slug === "passthrough")
    return null;
  return { alias: rule.use, ref: `${ref.upstream}:${ref.slug}` };
}

// The startup notice, or null when silence is correct. Named separately from the
// printing so it is testable without capturing stderr.
//
// This exists because the diversion is otherwise invisible until you read the
// cascade: a third-party agent ships untagged, matches anySubagent, and runs on
// a model nobody chose for it. Per-request route logs name the RULE but never
// the AGENT, and only if someone is watching stderr.
export function untaggedAgentWarning(config: Config, dir: string = AGENTS_DIR): string | null {
  const sink = anySubagentSink(config);
  if (!sink)
    return null;
  const names = untaggedAgents(dir);
  if (names.length === 0)
    return null;
  const listed = names.map(n => `    - ${n}`).join("\n");
  return `[modelmux] ${names.length} agent(s) in ${dir}/ carry no <<route:>> tag and will be routed\n`
    + `  by the anySubagent rule to '${sink.alias}' (${sink.ref}):\n${listed}\n`
    + `  Pin one to Claude with:  modelmux tag <name> control\n`;
}
