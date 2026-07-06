import type { Config } from "./types.ts";
import { parseModelRef } from "./config.ts";

// Rewrite one alias's value in routes.toml text, preserving the rest verbatim.
// Matches a TOML `alias = "..."` line under [models] (leading whitespace tolerated).
export function setModel(tomlText: string, alias: string, spec: string): string {
  parseModelRef(spec); // validate (throws on bad upstream/slug)
  const re = new RegExp(`^(\\s*${escape(alias)}\\s*=\\s*)"[^"]*"`, "m");
  if (!re.test(tomlText))
    throw new Error(`alias "${alias}" not found in models`);
  return tomlText.replace(re, `$1"${spec}"`);
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
