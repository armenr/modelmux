import type { Config } from "./types.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import pkg from "../package.json" with { type: "json" };
import { loadConfig, parseModelRef } from "./config.ts";

// THE single source for the CLI's verb list: printed by the usage line AND
// asserted against README.md by test/cli-docs.test.ts. The README used to
// transcribe these by hand, which is a claim about a system the doc has no
// link to — correct until someone adds a verb and forgets. Adding a verb here
// now fails the test until it is documented.
export const USAGE = "serve | models | set <alias> <upstream:slug> | tag <agent> <alias> | use <agent> <alias> | check-latest | version | help";

// Derived from package.json, never transcribed — the same reason USAGE is the
// single source for the verbs. release-please bumps package.json, so a hand-typed
// constant here would report the version of whenever someone last remembered.
export const VERSION: string = pkg.version;

// Conventional flag spellings, normalized to their canonical verb before dispatch.
// Deliberately a lookup rather than more `cmd === "..."` branches: cli-docs.test.ts
// derives the handled-verb set from that literal, and `--version` as a branch would
// register as a verb USAGE must advertise. The canonical verbs are what we document.
const FLAG_ALIASES: Record<string, string> = {
  "--version": "version",
  "-v": "version",
  "--help": "help",
  "-h": "help",
};

// Which invocations may bootstrap a default routes.toml. main.ts writes one before
// dispatch when the file is missing, and that is right for the commands that go on
// to READ it — but asking a binary its version, or fat-fingering a verb, is not
// consent to drop a config file into whatever directory you happen to be in.
//
// DERIVED from USAGE (minus the two self-answering verbs) rather than transcribed,
// so a new verb is config-consuming by default and this cannot silently drift out
// of step with the dispatch. An UNRECOGNISED command is absent by construction.
const SELF_ANSWERING = new Set(["version", "help"]);
export const CONFIG_VERBS: ReadonlySet<string> = new Set(
  USAGE.split("|")
    .map(s => s.trim().split(/\s+/)[0]!)
    .filter(v => v && !SELF_ANSWERING.has(v)),
);

/** True when this argv should bootstrap a routes.toml. Bare invocation == `serve`. */
export function needsConfig(rawCmd: string | undefined): boolean {
  if (rawCmd == null || rawCmd === "")
    return true; // bare invocation runs the proxy, which needs a config
  return CONFIG_VERBS.has(FLAG_ALIASES[rawCmd] ?? rawCmd);
}

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
  const [raw, a, b] = argv;
  const cmd = raw == null ? raw : (FLAG_ALIASES[raw] ?? raw);
  try {
    if (cmd === "version") {
      console.log(VERSION);
      return 0;
    }
    if (cmd === "help") {
      console.log(`commands: ${USAGE}`);
      return 0;
    }
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
      const path = join(".claude", "agents", `${a}.md`);
      writeFileSync(path, retargetAgentTag(readFileSync(path, "utf8"), b));
      console.log(`agent ${a} now uses <<route:${b}>>`);
      return 0;
    }
    if (cmd === "tag") {
      if (!a || !b) {
        console.error("usage: modelmux tag <agent-name> <alias>");
        return 1;
      }
      const path = join(".claude", "agents", `${a}.md`);
      writeFileSync(path, tagAgent(readFileSync(path, "utf8"), b));
      console.log(`agent ${a} tagged <<route:${b}>>`);
      return 0;
    }
    if (cmd === "check-latest") {
      const { run } = await import("../scripts/check-latest.ts");
      return run(ROUTES); // honor MUX_ROUTES like every other command
    }
    // Bare invocation is a request for the usage line — that is a success.
    if (!cmd) {
      console.log(`commands: ${USAGE}`);
      return 0;
    }
    // An UNRECOGNISED command is a failure and must say so in its exit code.
    // This used to print the usage line and `return 0`, so `modelmux --version`
    // reported SUCCESS while doing nothing — a typo in a script exited clean and
    // the script carried on as though the command had run.
    console.error(`unknown command "${raw}"\ncommands: ${USAGE}`);
    return 1;
  }
  catch (e) {
    console.error(`error: ${(e as Error).message}`);
    return 1;
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
