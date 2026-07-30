import type { UpstreamDef } from "../src/types.ts";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { loadConfig } from "../src/config.ts";
import { toResponsesRequest } from "../src/responses.ts";
import { applyMinMaxTokens, capFieldFor } from "../src/upstreams.ts";

// OQ-019. applyMinMaxTokens runs AFTER the wire translation, so the body it
// edits is already in the target format. `maxTokensField` only ever described
// the OpenAI/Anthropic shape, and writing it onto a Responses body invents a
// field that wire does not define.

function def(over: Partial<UpstreamDef>): UpstreamDef {
  return {
    base: "https://example.test",
    auth: { kind: "none" },
    stripBeta: false,
    format: "anthropic",
    maxTokensField: "max_tokens",
    ...over,
  } as UpstreamDef;
}

test("a RESPONSES upstream gets max_output_tokens, NOT the declared maxTokensField", () => {
  const d = def({ format: "responses", maxTokensField: "max_tokens", minMaxTokens: 32000 });
  const out = applyMinMaxTokens(d, { model: "m", input: [] });
  expect(out.max_output_tokens).toBe(32000);
  // The regression this test exists for: `max_tokens` is not a Responses field.
  expect(out.max_tokens).toBeUndefined();
});

test("a RESPONSES upstream never LOWERS a caller who asked for more", () => {
  const d = def({ format: "responses", minMaxTokens: 32000 });
  const out = applyMinMaxTokens(d, { max_output_tokens: 90000 });
  expect(out.max_output_tokens).toBe(90000);
});

test("codexSubscription gets NO cap field at all — every cap is a hard 400 there", () => {
  const d = def({ format: "responses", codexSubscription: true, minMaxTokens: 32000 });
  const out = applyMinMaxTokens(d, { model: "m", input: [] });
  expect(out.max_output_tokens).toBeUndefined();
  expect(out.max_tokens).toBeUndefined();
});

test("THE ORIGINAL DEFECT, end to end through the real translator", () => {
  // Exactly the shipped codex built-in plus a floor, run through server.ts's
  // order of operations: translate first, then floor.
  const codex = def({
    format: "responses",
    maxTokensField: "max_tokens",
    codexSubscription: true,
    minMaxTokens: 32000,
  });
  const inbound = { model: "gpt-5.6-sol", max_tokens: 4096, messages: [{ role: "user", content: "hi" }] };
  const out = applyMinMaxTokens(codex, toResponsesRequest(inbound, true));
  // Before the fix this asserted 32000 — an undefined field on a wire whose
  // sibling params are each a measured 400.
  expect(out.max_tokens).toBeUndefined();
  expect(out.max_output_tokens).toBeUndefined();
});

test("openai and anthropic upstreams are UNCHANGED — the floor still applies as before", () => {
  const oa = def({ format: "openai", maxTokensField: "max_completion_tokens", minMaxTokens: 32000 });
  expect(applyMinMaxTokens(oa, {}).max_completion_tokens).toBe(32000);

  const an = def({ format: "anthropic", maxTokensField: "max_tokens", minMaxTokens: 32000 });
  expect(applyMinMaxTokens(an, { max_tokens: 100 }).max_tokens).toBe(32000);
  expect(applyMinMaxTokens(an, { max_tokens: 99999 }).max_tokens).toBe(99999);
});

test("capFieldFor names the field each wire actually uses", () => {
  expect(capFieldFor(def({ format: "responses" }))).toBe("max_output_tokens");
  expect(capFieldFor(def({ format: "openai", maxTokensField: "max_completion_tokens" }))).toBe("max_completion_tokens");
  expect(capFieldFor(def({ format: "anthropic" }))).toBe("max_tokens");
});

// --- config-time rejection: refuse the lie rather than ignore the setting ---

function writeRoutes(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "mux-minmax-"));
  const p = join(dir, "routes.toml");
  writeFileSync(p, body);
  return p;
}

test("config REFUSES minMaxTokens on a codex-auth upstream instead of silently dropping it", () => {
  const p = writeRoutes(`
default = "d"
[models]
d = "mine:gpt-5.6-sol"
[upstreams]
mine = { base = "https://chatgpt.com/backend-api/codex", auth = "codex", format = "responses", minMaxTokens = 32000 }
`);
  expect(() => loadConfig(p, {})).toThrow(/cannot use minMaxTokens/);
});

test("the same upstream WITHOUT minMaxTokens loads fine — the guard is not over-broad", () => {
  const p = writeRoutes(`
default = "d"
[models]
d = "mine:gpt-5.6-sol"
[upstreams]
mine = { base = "https://chatgpt.com/backend-api/codex", auth = "codex", format = "responses" }
`);
  const cfg = loadConfig(p, {});
  expect(cfg.upstreams?.mine?.codexSubscription).toBe(true);
  expect(cfg.upstreams?.mine?.minMaxTokens).toBeUndefined();
});

test("a non-codex responses upstream may still declare minMaxTokens", () => {
  const p = writeRoutes(`
default = "d"
[models]
d = "mine:some-model"
[upstreams]
mine = { base = "https://self-hosted.test/v1", format = "responses", minMaxTokens = 32000 }
`);
  const cfg = loadConfig(p, {});
  expect(cfg.upstreams?.mine?.minMaxTokens).toBe(32000);
});
