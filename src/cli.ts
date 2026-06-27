import type { Config } from "./types.ts";
import { parseModelRef } from "./config.ts";

// Rewrite one alias's value in routes.jsonc text, preserving the rest verbatim.
export function setModel(jsoncText: string, alias: string, spec: string): string {
  parseModelRef(spec); // validate (throws on bad upstream/slug)
  const re = new RegExp(`("${escape(alias)}"\\s*:\\s*)"[^"]*"`);
  if (!re.test(jsoncText))
    throw new Error(`alias "${alias}" not found in models`);
  return jsoncText.replace(re, `$1"${spec}"`);
}

export function listModels(config: Config): string {
  const rows = Object.entries(config.models).map(
    ([alias, ref]) => `  ${alias.padEnd(16)} ${ref.upstream}:${ref.slug}`,
  );
  return ["alias            upstream:slug", ...rows].join("\n");
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
