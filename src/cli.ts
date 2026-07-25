import type { Config } from "./types.ts";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { loadConfig, parseModelRef } from "./config.ts";

const ROUTES = process.env.MUX_ROUTES ?? "routes.toml";

// Rewrite one alias's value in routes.toml text, preserving the rest verbatim.
// Matches a TOML `alias = "..."` line under [models] (leading whitespace tolerated).
export function setModel(tomlText: string, alias: string, spec: string): string {
  parseModelRef(spec); // validate (throws on bad upstream/slug)
  const re = new RegExp(`^(\\s*${escape(alias)}\\s*=\\s*)"[^"]*"`, "m");
  if (!re.test(tomlText))
    throw new Error(`alias "${alias}" not found in models`);
  return tomlText.replace(re, `$1"${spec}"`);
}

// Rewrite the first <<route:alias>> tag in an agent file's text. Throws if there
// is no tag to retarget, so `use` can't report a false success on a tagless file.
export function retargetAgentTag(text: string, alias: string): string {
  const re = /<<route:[\w-]+>>/i;
  if (!re.test(text))
    throw new Error("no <<route:...>> tag found to retarget");
  return text.replace(re, `<<route:${alias}>>`);
}

// Insert a FIRST <<route:alias>> tag into an agent file that has none — the
// counterpart to retargetAgentTag, which deliberately refuses to create one.
// Third-party agents (a docs kit, a starter pack) ship untagged by
// construction, so under an `anySubagent` catch-all they silently route to
// whatever that rule names; `use` cannot fix them because it only retargets.
//
// Guards are symmetric with retargetAgentTag: that one refuses to CREATE, this
// one refuses to OVERWRITE. Neither can report a false success.
//
// Placement: immediately after YAML front matter when present (the tag must sit
// in the agent's prompt body, which is what the proxy reads — front matter is
// not sent), else at the very top.
export function tagAgent(text: string, alias: string): string {
  if (/<<route:[\w-]+>>/i.test(text))
    throw new Error("agent already has a <<route:...>> tag; use `use` to retarget it");
  const tag = `<<route:${alias}>>`;
  const fm = /^(---\r?\n[\s\S]*?\r?\n---)\r?\n/.exec(text);
  if (fm)
    return `${fm[1]}\n\n${tag}\n\n${text.slice(fm[0].length).replace(/^(\r?\n)+/, "")}`;
  return `${tag}\n\n${text}`;
}

export function listModels(config: Config): string {
  const rows = Object.entries(config.models).map(
    ([alias, ref]) => `  ${alias.padEnd(16)} ${ref.upstream}:${ref.slug}`,
  );
  return ["alias            upstream:slug", ...rows].join("\n");
}

// Dispatch a `modelmux` / `mux` subcommand. Returns a process exit code so both
// the dev CLI (bin/mux) and the compiled binary (src/main.ts) can share it.
export async function runCli(argv: string[]): Promise<number> {
  const [cmd, a, b] = argv;
  try {
    if (cmd === "models") {
      console.log(listModels(loadConfig(ROUTES)));
      return 0;
    }
    if (cmd === "set") {
      if (!a || !b) {
        console.error("usage: modelmux set <alias> <upstream:slug>");
        return 1;
      }
      writeFileSync(ROUTES, setModel(readFileSync(ROUTES, "utf8"), a, b));
      console.log(`set ${a} -> ${b}`);
      return 0;
    }
    if (cmd === "use") {
      if (!a || !b) {
        console.error("usage: modelmux use <agent-name> <alias>");
        return 1;
      }
      const path = `.claude/agents/${a}.md`;
      writeFileSync(path, retargetAgentTag(readFileSync(path, "utf8"), b));
      console.log(`agent ${a} now uses <<route:${b}>>`);
      return 0;
    }
    if (cmd === "tag") {
      if (!a || !b) {
        console.error("usage: modelmux tag <agent-name> <alias>");
        return 1;
      }
      const path = `.claude/agents/${a}.md`;
      writeFileSync(path, tagAgent(readFileSync(path, "utf8"), b));
      console.log(`agent ${a} tagged <<route:${b}>>`);
      return 0;
    }
    if (cmd === "check-latest") {
      const { run } = await import("../scripts/check-latest.ts");
      return run(ROUTES); // honor MUX_ROUTES like every other command
    }
    console.log("commands: serve | models | set <alias> <upstream:slug> | tag <agent> <alias> | use <agent> <alias> | check-latest");
    return 0;
  }
  catch (e) {
    console.error(`error: ${(e as Error).message}`);
    return 1;
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
