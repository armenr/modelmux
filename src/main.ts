// Unified entrypoint for the vended single binary (`bun build --compile`).
//   modelmux                 → run the proxy (same as `modelmux serve`)
//   modelmux models|set|…    → manage routes.toml (see cli.ts)
//
// The binary is self-contained: routes.toml is embedded at compile time, so if
// the working directory has none, we write the baked-in default and carry on.
import { existsSync, writeFileSync } from "node:fs";
import process from "node:process";
import DEFAULT_ROUTES from "../routes.toml" with { type: "text" };
import { runCli } from "./cli.ts";
import { startProxy } from "./server.ts";

const ROUTES = process.env.MUX_ROUTES ?? "routes.toml";
if (!existsSync(ROUTES)) {
  writeFileSync(ROUTES, DEFAULT_ROUTES);
  process.stderr.write(`[modelmux] wrote default ${ROUTES} (edit it to change models)\n`);
}

const cmd = process.argv[2];
if (!cmd || cmd === "serve")
  startProxy(ROUTES);
else
  runCli(process.argv.slice(2)).then(code => process.exit(code));
