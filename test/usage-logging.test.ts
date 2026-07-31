import type { Config } from "../src/types.ts";
import { readFileSync, rmSync } from "node:fs";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { buildServer } from "../src/server.ts";

// OQ-015. A translated leg cannot carry real input tokens on the wire: Anthropic
// reports them in `message_start`, while an OpenAI/Responses upstream sends no
// usage at all until the stream closes. So `message_start` honestly says 0 — and
// a client reading usage from there sees a STRUCTURAL ZERO for the request's
// whole life, indistinguishable from an agent that did nothing. Measured in the
// field: three healthy GLM legs read `0 tok` beside Opus twins at ~200k and were
// taken for dead.
//
// The fix is out-of-band truth, NOT a fabricated number in the wire field.

const LOG = "test/.tmp-usage.jsonl";

let fakeAnthropic: Bun.Server<never>, fakeOai: Bun.Server<never>, proxy: Bun.Server<never>;

// An OpenAI-format stream whose usage arrives ONLY in the final chunk, and whose
// usage chunk carries an EMPTY choices array — the real shape, and the one a
// naive `choices[0]` guard drops.
function oaiStream(): Response {
  const body = [
    "data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"},\"index\":0}]}",
    "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\",\"index\":0}]}",
    "data: {\"usage\":{\"prompt_tokens\":137,\"completion_tokens\":42},\"choices\":[]}",
    "data: [DONE]",
    "",
  ].join("\n\n");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function oaiJson(): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 11, completion_tokens: 3 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

beforeAll(() => {
  rmSync(LOG, { force: true });
  fakeAnthropic = Bun.serve({
    port: 0,
    fetch: () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
  });
  fakeOai = Bun.serve({
    port: 0,
    async fetch(req) {
      const b: any = await req.json().catch(() => ({}));
      return b?.stream ? oaiStream() : oaiJson();
    },
  });
  const config: Config = {
    models: {
      orchestrator: { upstream: "anthropic", slug: "passthrough" },
      oai: { upstream: "openrouter", slug: "some-model" },
    },
    default: "orchestrator",
    longContextThreshold: 200000,
    routes: [{ when: { tag: "oai" }, use: "oai" }],
    upstreams: {
      anthropic: {
        base: fakeAnthropic.url.origin,
        auth: { kind: "passthrough" },
        stripBeta: false,
        format: "anthropic",
        maxTokensField: "max_tokens",
      },
      // Reuse the `openrouter` NAME so baseOverride can retarget it, but declare
      // it as an OpenAI-format upstream — that is the leg with the zero.
      openrouter: {
        base: fakeOai.url.origin,
        auth: { kind: "none" },
        stripBeta: true,
        format: "openai",
        maxTokensField: "max_tokens",
      },
    },
  } as any;
  proxy = buildServer({ config, env: {}, logPath: LOG, port: 0 });
});

afterAll(() => {
  fakeAnthropic.stop(true);
  fakeOai.stop(true);
  proxy.stop(true);
  rmSync(LOG, { force: true });
});

function rows(): any[] {
  let raw = "";
  try {
    raw = readFileSync(LOG, "utf8");
  }
  catch {
    return [];
  }
  return raw.split("\n").filter(Boolean).map(l => JSON.parse(l));
}
const usageRows = (): any[] => rows().filter(r => r.kind === "usage");

async function call(body: any, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(`${proxy.url.origin}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.text(); // drain, so a stream reaches its close
}

test("a STREAMING translated leg logs the REAL usage at stream close", async () => {
  const before = usageRows().length;
  await call(
    { model: "m", max_tokens: 16, stream: true, system: "<<route:oai>>", messages: [] },
    { "x-claude-code-agent-id": "a1" },
  );
  const fresh = usageRows().slice(before);
  expect(fresh).toHaveLength(1);
  // The whole point: a real input-token count where the wire could only say 0.
  expect(fresh[0].inputTokens).toBe(137);
  expect(fresh[0].outputTokens).toBe(42);
  expect(fresh[0].upstream).toBe("openrouter");
  expect(fresh[0].resolvedModel).toBe("some-model");
  expect(fresh[0].agentId).toBe("a1");
});

test("a NON-STREAMING translated leg logs usage too", async () => {
  const before = usageRows().length;
  await call(
    { model: "m", max_tokens: 16, system: "<<route:oai>>", messages: [] },
    { "x-claude-code-agent-id": "a2" },
  );
  const fresh = usageRows().slice(before);
  expect(fresh).toHaveLength(1);
  expect(fresh[0].inputTokens).toBe(11);
  expect(fresh[0].outputTokens).toBe(3);
});

test("usage is a SECOND record — the routing decision is never amended", async () => {
  const before = rows().length;
  await call(
    { model: "m", max_tokens: 16, stream: true, system: "<<route:oai>>", messages: [] },
    { "x-claude-code-agent-id": "a3" },
  );
  const fresh = rows().slice(before);
  // Append-only: the decision row survives verbatim beside the usage row.
  expect(fresh.filter(r => r.kind === "usage")).toHaveLength(1);
  const decision = fresh.find(r => r.matchedRule === "tag:oai");
  expect(decision).toBeDefined();
  expect(decision.kind).toBeUndefined();
});

test("a PASSTHROUGH leg logs NO usage row — forwarded unparsed, by design", async () => {
  const before = usageRows().length;
  await call({ model: "m", max_tokens: 16, messages: [] });
  // Documented scope, not an oversight: the anthropic fast path is deliberately
  // untouched, and its client already receives real native usage. This fills the
  // half that was missing, and says so rather than implying full coverage.
  expect(usageRows().slice(before)).toHaveLength(0);
});
