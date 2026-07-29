import type { UpstreamDef } from "../src/types.ts";
import { expect, test } from "bun:test";
import { openaiPath, toAnthropicResponse, toAnthropicStream } from "../src/openai.ts";
import { applyExtraBody, forwardUrl } from "../src/upstreams.ts";

// Imposing max reasoning on a GLM reviewer needs BOTH halves, and neither alone
// is worth anything. Measured against Z.ai on 2026-07-29:
//   /api/anthropic          subscription, `reasoning_effort` SILENTLY DROPPED (200 on a bad value)
//   /api/paas/v4            metered, validated -> "Insufficient balance" on a Coding Plan key
//   /api/coding/paas/v4     subscription, validated (400 on a bad value, listing the allowed set)
// and on that last endpoint effort demonstrably works: minimal -> 0 reasoning
// chars, max -> 5730. So depth requires routing over format="openai" AND
// injecting the field — and then carrying `reasoning_content` BACK, or the
// reasoning is paid for and dropped on the floor.

// ── half one: the request-side injection ─────────────────────────────────────

function DEF(extra?: Record<string, unknown>): UpstreamDef {
  return {
    base: "https://api.z.ai/api/coding/paas/v4",
    auth: { kind: "bearer", envKey: "ZAI_API_KEY" },
    stripBeta: true,
    format: "openai",
    maxTokensField: "max_tokens",
    ...(extra ? { extraBody: extra } : {}),
  };
}

test("extraBody is merged into the outbound body", () => {
  const out = applyExtraBody(DEF({ reasoning_effort: "max" }), { model: "glm-5.2", messages: [] });
  expect(out.reasoning_effort).toBe("max");
});

test("extraBody IMPOSES — it wins over a value the caller already set", () => {
  // Deliberate: depth is per-upstream policy, and Claude Code has no vocabulary
  // for reasoning_effort, so there is no user intent being overridden.
  const out = applyExtraBody(DEF({ reasoning_effort: "max" }), { reasoning_effort: "minimal" });
  expect(out.reasoning_effort).toBe("max");
});

test("an upstream with no extraBody leaves the body untouched", () => {
  const body = { model: "glm-5.2", messages: [] };
  expect(applyExtraBody(DEF(), body)).toEqual({ model: "glm-5.2", messages: [] });
});

// ── half two: the response-side reasoning carry-back (buffered) ──────────────

test("reasoning_content becomes a thinking block, BEFORE the text block", () => {
  const out = toAnthropicResponse(
    { choices: [{ message: { reasoning_content: "step 1, step 2", content: "42" }, finish_reason: "stop" }] },
    "glm-5.2",
  );
  expect(out.content.map((b: any) => b.type)).toEqual(["thinking", "text"]);
  expect(out.content[0].thinking).toBe("step 1, step 2");
  expect(out.content[1].text).toBe("42");
});

test("the `reasoning` spelling is accepted too", () => {
  const out = toAnthropicResponse({ choices: [{ message: { reasoning: "hmm", content: "ok" } }] }, "m");
  expect(out.content[0]).toEqual({ type: "thinking", thinking: "hmm" });
});

test("no signature is fabricated on a thinking block", () => {
  // An Anthropic thinking signature is a server-issued attestation. Forging one
  // is worse than omitting it.
  const out = toAnthropicResponse({ choices: [{ message: { reasoning_content: "x", content: "y" } }] }, "m");
  expect(out.content[0].signature).toBeUndefined();
});

test("REGRESSION: no reasoning -> no thinking block (non-reasoning backends unchanged)", () => {
  const out = toAnthropicResponse({ choices: [{ message: { content: "hi" }, finish_reason: "stop" }] }, "m");
  expect(out.content.map((b: any) => b.type)).toEqual(["text"]);
});

// ── half two, streaming: block indices are ALLOCATED, not hardcoded ──────────

function chunk(delta: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ choices: [{ delta, index: 0 }] })}\n\n`;
}

async function collect(frames: string[]): Promise<any[]> {
  const upstream = new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      for (const f of frames) c.enqueue(enc.encode(f));
      c.close();
    },
  });
  const text = await new Response(toAnthropicStream(upstream, "glm-5.2")).text();
  return text
    .split("\n\n")
    .map(f => f.split("\n").find(l => l.startsWith("data:")))
    .filter(Boolean)
    .map(l => JSON.parse(l!.slice(5).trim()));
}

test("streamed reasoning opens a thinking block at index 0, text shifts to 1", async () => {
  const events = await collect([
    chunk({ reasoning_content: "think..." }),
    chunk({ content: "answer" }),
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
  ]);
  const starts = events.filter(e => e.type === "content_block_start");
  expect(starts.map(s => [s.index, s.content_block.type])).toEqual([[0, "thinking"], [1, "text"]]);

  const tDelta = events.find(e => e.type === "content_block_delta" && e.delta.type === "thinking_delta");
  expect(tDelta.index).toBe(0);
  expect(tDelta.delta.thinking).toBe("think...");
});

test("the thinking block is CLOSED before the text block opens (blocks never interleave)", async () => {
  const events = await collect([chunk({ reasoning_content: "r" }), chunk({ content: "t" })]);
  const order = events
    .filter(e => e.type === "content_block_start" || e.type === "content_block_stop")
    .map(e => `${e.type}#${e.index}`);
  expect(order.indexOf("content_block_stop#0")).toBeLessThan(order.indexOf("content_block_start#1"));
});

test("REGRESSION: with no reasoning, text still lands at index 0", async () => {
  // The whole point of allocating rather than hardcoding — a non-reasoning
  // backend must produce exactly what it produced before this feature existed.
  const events = await collect([chunk({ content: "hi" })]);
  const start = events.find(e => e.type === "content_block_start");
  expect([start.index, start.content_block.type]).toEqual([0, "text"]);
});

test("a tool_use block also closes thinking first, and gets the next index", async () => {
  const events = await collect([
    chunk({ reasoning_content: "r" }),
    chunk({ tool_calls: [{ index: 0, id: "c1", function: { name: "grep", arguments: "{}" } }] }),
  ]);
  const starts = events.filter(e => e.type === "content_block_start");
  expect(starts.map(s => [s.index, s.content_block.type])).toEqual([[0, "thinking"], [1, "tool_use"]]);
  const order = events.filter(e => e.type.startsWith("content_block_")).map(e => `${e.type}#${e.index}`);
  expect(order.indexOf("content_block_stop#0")).toBeLessThan(order.indexOf("content_block_start#1"));
});

// ── the URL half: a base that already carries its version ────────────────────

test("chatPath overrides the derived /v1/chat/completions", () => {
  // MEASURED: base ".../paas/v4" + derived "/v1/chat/completions" gave
  // ".../paas/v4/v1/chat/completions" -> 404 from Z.ai. Explicit override.
  const def = { ...DEF({ reasoning_effort: "max" }), chatPath: "/chat/completions" };
  expect(forwardUrl("zai-max", def.chatPath, "", { "zai-max": def })).toBe(
    "https://api.z.ai/api/coding/paas/v4/chat/completions",
  );
});

test("without chatPath the derived OpenAI path is still used (regression)", () => {
  expect(openaiPath("/v1/messages")).toBe("/v1/chat/completions");
});
