// Unified entrypoint for the vended single binary (`bun build --compile`).
//   modelmux                 → run the proxy (same as `modelmux serve`)
//   modelmux models|set|…    → manage routes.toml (see cli.ts)
//
// The binary is self-contained: routes.toml is embedded at compile time, so if
// the working directory has none, we write the baked-in default and carry on.
import { existsSync, writeFileSync } from "node:fs";
import process from "node:process";
import DEFAULT_ROUTES from "../routes.toml" with { type: "text" };
import { needsConfig, runCli } from "./cli.ts";
import { startProxy } from "./server.ts";

const ROUTES = process.env.MUX_ROUTES ?? "routes.toml";
const cmd = process.argv[2];

// Bootstrap the config ONLY for invocations that go on to read it. `version` and
// `help` answer from the binary itself, and an unrecognised verb is about to exit
// 1 — neither is consent to write a routes.toml into the current directory.
if (needsConfig(cmd) && !existsSync(ROUTES)) {
  writeFileSync(ROUTES, DEFAULT_ROUTES);
  process.stderr.write(`[modelmux] wrote default ${ROUTES} (edit it to change models)\n`);
}

if (!cmd || cmd === "serve")
  startProxy(ROUTES);
else
  runCli(process.argv.slice(2)).then(code => process.exit(code));
