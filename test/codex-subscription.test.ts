import { expect, test } from "bun:test";
import { collectResponsesOutput, toAnthropicFromResponses, toAnthropicStreamFromResponses, toResponsesRequest } from "../src/responses.ts";

// Every constraint asserted here was MEASURED against the live
// ChatGPT-subscription Codex backend on 2026-07-25, not inferred from a spec.
// Each returned `400 Unsupported parameter` / `400 Store must be set to false`
// on the real endpoint before the guard existed.

const BASE = { model: "gpt-5.5", messages: [{ role: "user", content: "hi" }] };

// ── request shape ────────────────────────────────────────────────────────────

test("codexSubscription forces store:false — the backend 400s without it", () => {
  expect(toResponsesRequest(BASE, true).store).toBe(false);
  // generic Responses upstreams must NOT be given this
  expect(toResponsesRequest(BASE, false).store).toBeUndefined();
});

test("codexSubscription forces stream:true even when the caller wanted JSON", () => {
  // That backend is SSE-ONLY: a non-streaming request is rejected outright, so
  // there is nothing to degrade to. The server re-aggregates for the caller.
  const out = toResponsesRequest({ ...BASE, stream: false }, true);
  expect(out.stream).toBe(true);
  // a generic Responses upstream keeps the caller's intent
  expect(toResponsesRequest({ ...BASE, stream: false }, false).stream).toBeUndefined();
});

test("codexSubscription supplies a non-empty instructions floor", () => {
  // `instructions` must be a non-empty string, but an Anthropic request with no
  // system prompt is perfectly legal — so it needs a floor, not a throw.
  const out = toResponsesRequest(BASE, true);
  expect(typeof out.instructions).toBe("string");
  expect(out.instructions.length).toBeGreaterThan(0);
  // a real system prompt still wins over the floor
  expect(toResponsesRequest({ ...BASE, system: "be terse" }, true).instructions).toBe("be terse");
});

test("codexSubscription DROPS max_output_tokens/temperature/top_p — each is a hard 400", () => {
  const out = toResponsesRequest(
    { ...BASE, max_tokens: 64, temperature: 0.5, top_p: 0.9 },
    true,
  );
  expect(out.max_output_tokens).toBeUndefined();
  expect(out.temperature).toBeUndefined();
  expect(out.top_p).toBeUndefined();
  // Anthropic REQUIRES max_tokens, so every real Claude Code request carries
  // one — this is the common path, not an edge case.
});

test("a generic responses upstream still forwards the sampling params", () => {
  // Guards against the Codex-specific stripping leaking into every upstream.
  const out = toResponsesRequest({ ...BASE, max_tokens: 64, temperature: 0.5, top_p: 0.9 }, false);
  expect(out.max_output_tokens).toBe(64);
  expect(out.temperature).toBe(0.5);
  expect(out.top_p).toBe(0.9);
});

// ── the empty-output aggregation trap ────────────────────────────────────────

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const f of frames)
        c.enqueue(enc.encode(f));
      c.close();
    },
  });
}

test("collectResponsesOutput accumulates ITEM events, not response.completed.output", () => {
  // THE TRAP: the live backend's terminal `response.completed` carries
  // `output: []` — ALWAYS EMPTY. Reading the result off that event is the
  // obvious implementation and yields a structurally-valid EMPTY message.
  // This fixture reproduces that exact shape.
  const frames = [
    `event: response.output_item.done\ndata: ${JSON.stringify({
      type: "response.output_item.done",
      item: { type: "message", content: [{ type: "output_text", text: "pong" }] },
    })}\n\n`,
    `event: response.completed\ndata: ${JSON.stringify({
      type: "response.completed",
      response: { id: "resp_1", output: [], usage: { input_tokens: 19, output_tokens: 16 } },
    })}\n\n`,
  ];
  return collectResponsesOutput(sseStream(frames)).then((res) => {
    expect(res.output).toHaveLength(1);
    expect(res.id).toBe("resp_1"); // metadata still comes from the envelope
    const msg = toAnthropicFromResponses(res, "gpt-5.5");
    expect(msg.content).toEqual([{ type: "text", text: "pong" }]);
  });
});

test("collectResponsesOutput reassembles a streamed tool call", () => {
  const frames = [
    `event: response.output_item.done\ndata: ${JSON.stringify({
      type: "response.output_item.done",
      item: { type: "function_call", call_id: "call_1", name: "get_weather", arguments: "{\"city\":\"Paris\"}" },
    })}\n\n`,
    `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { id: "r", output: [] } })}\n\n`,
  ];
  return collectResponsesOutput(sseStream(frames)).then((res) => {
    const msg = toAnthropicFromResponses(res, "gpt-5.5");
    expect(msg.stop_reason).toBe("tool_use");
    expect(msg.content[0]).toEqual({ type: "tool_use", id: "call_1", name: "get_weather", input: { city: "Paris" } });
  });
});

// ── reasoning items must not become empty blocks ─────────────────────────────

async function drain(s: ReadableStream<Uint8Array>): Promise<string> {
  const dec = new TextDecoder();
  const r = s.getReader();
  let out = "";
  for (;;) {
    const { done, value } = await r.read();
    if (done)
      break;
    out += dec.decode(value, { stream: true });
  }
  return out;
}

test("a reasoning item opens NO content block, and indices stay contiguous from 0", async () => {
  // The live backend prefixes EVERY reply with a reasoning item, so before this
  // guard 100% of streamed responses carried a spurious empty text block at
  // index 0 and pushed the real text to index 1.
  const frames = [
    `event: response.output_item.added\ndata: ${JSON.stringify({ type: "response.output_item.added", output_index: 0, item: { type: "reasoning" } })}\n\n`,
    `event: response.output_item.done\ndata: ${JSON.stringify({ type: "response.output_item.done", output_index: 0, item: { type: "reasoning" } })}\n\n`,
    `event: response.output_item.added\ndata: ${JSON.stringify({ type: "response.output_item.added", output_index: 1, item: { type: "message" } })}\n\n`,
    `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", output_index: 1, delta: "hi" })}\n\n`,
    `event: response.output_item.done\ndata: ${JSON.stringify({ type: "response.output_item.done", output_index: 1, item: { type: "message" } })}\n\n`,
    `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { output: [] } })}\n\n`,
  ];
  const out = await drain(toAnthropicStreamFromResponses(sseStream(frames), "gpt-5.5"));

  const starts = [...out.matchAll(/"type":"content_block_start","index":(\d+)/g)].map(m => Number(m[1]));
  expect(starts).toEqual([0]); // exactly one block, at index 0 — not two, not index 1
  const stops = [...out.matchAll(/"type":"content_block_stop","index":(\d+)/g)].map(m => Number(m[1]));
  expect(stops).toEqual([0]); // and no stop for a block that was never opened
  expect(out).toContain("hi");
});

// ── OQ-006: streamed input usage must not stay at 0 ──────────────────────────

test("streamed message_delta reports the REAL input_tokens, not a flat 0", async () => {
  // Responses only reveals usage at response.completed, but Anthropic wants input
  // usage in message_start — which is emitted before any of it is known. Leaving
  // the placeholder 0 uncorrected reads as "this call was free".
  const frames = [
    `event: response.output_item.added\ndata: ${JSON.stringify({ type: "response.output_item.added", output_index: 0, item: { type: "message" } })}\n\n`,
    `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", output_index: 0, delta: "hi" })}\n\n`,
    `event: response.completed\ndata: ${JSON.stringify({
      type: "response.completed",
      response: { output: [], usage: { input_tokens: 19, output_tokens: 16 } },
    })}\n\n`,
  ];
  const out = await drain(toAnthropicStreamFromResponses(sseStream(frames), "gpt-5.5"));
  expect(out).toContain(`"usage":{"input_tokens":19,"output_tokens":16}`);
  // and the message_start placeholder is still the documented 0/0
  expect(out).toContain(`"usage":{"input_tokens":0,"output_tokens":0}`);
});
