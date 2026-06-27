import type { Config } from "../src/types.ts";
import { readFileSync, rmSync } from "node:fs";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { readDecisions } from "../src/log.ts";
import { buildServer } from "../src/server.ts";

const LOG = "test/.tmp-replay.jsonl";
const CONFIG: Config = {
  models: {
    orchestrator: { upstream: "anthropic", slug: "passthrough" },
    flagship: { upstream: "openrouter", slug: "z-ai/glm-5.2" },
  },
  default: "orchestrator",
  longContextThreshold: 200000,
  routes: [
    { when: { tag: "flagship" }, use: "flagship" },
    { when: { anySubagent: true }, use: "flagship" },
  ],
};

let anthropic: Bun.Server<never>, openrouter: Bun.Server<never>, proxy: Bun.Server<never>;
const ok = (w: string) => () => new Response(`{"upstream":"${w}"}`, { headers: { "content-type": "application/json" } });

beforeAll(() => {
  rmSync(LOG, { force: true });
  anthropic = Bun.serve({ port: 0, fetch: ok("anthropic") });
  openrouter = Bun.serve({ port: 0, fetch: ok("openrouter") });
  proxy = buildServer({
    config: CONFIG,
    env: { OPENROUTER_API_KEY: "k" },
    logPath: LOG,
    port: 0,
    baseOverride: { anthropic: anthropic.url.origin, openrouter: openrouter.url.origin },
  });
});

afterAll(() => {
  anthropic.stop(true);
  openrouter.stop(true);
  proxy.stop(true);
  rmSync(LOG, { force: true });
});

async function replay(file: string) {
  const fx = JSON.parse(readFileSync(`test/fixtures/${file}`, "utf8"));
  await fetch(`${proxy.url.origin}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", ...fx.headers },
    body: JSON.stringify(fx.body),
  });
  return readDecisions(LOG).at(-1)!;
}

test("01 main → anthropic/default", async () => {
  const d = await replay("01-main.json");
  expect(d.upstream).toBe("anthropic");
  expect(d.matchedRule).toBe("default");
});

test("02 tagged subagent → openrouter glm-5.2", async () => {
  const d = await replay("02-sub-flagship.json");
  expect(d.upstream).toBe("openrouter");
  expect(d.resolvedModel).toBe("z-ai/glm-5.2");
});

test("03 untagged subagent → openrouter via anySubagent", async () => {
  const d = await replay("03-sub-none.json");
  expect(d.matchedRule).toBe("anySubagent");
});
