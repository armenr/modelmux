import { expect, test } from "bun:test";
import { collectResponsesOutput, toAnthropicFromResponses, toAnthropicStreamFromResponses } from "../src/responses.ts";

// OQ-021. The Codex/Responses backend CAN emit reasoning summaries, but only
// when the request asks (`reasoning: { summary: "auto" }`). MEASURED against the
// live backend: with no `summary` key, zero reasoning content arrives at all —
// so "this model gives no thinking" and "we never asked" are indistinguishable
// from the client side. We asked for neither, and would have discarded the
// answer: `response.reasoning_summary_*` was entirely unhandled.

function sse(events: any[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const e of events)
        c.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      c.close();
    },
  });
}

async function drain(s: ReadableStream<Uint8Array>): Promise<any[]> {
  const out: any[] = [];
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of s as any)
    buf += dec.decode(chunk, { stream: true });
  for (const line of buf.split("\n")) {
    if (line.startsWith("data: ")) {
      try {
        out.push(JSON.parse(line.slice(6)));
      }
      catch { /* non-JSON keepalive */ }
    }
  }
  return out;
}

test("non-streaming: a reasoning SUMMARY becomes a thinking block", () => {
  const res = {
    id: "resp_1",
    output: [
      { type: "reasoning", summary: [{ type: "summary_text", text: "Checking divisibility." }] },
      { type: "message", content: [{ type: "output_text", text: "Yes, 17 is prime." }] },
    ],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
  const out = toAnthropicFromResponses(res, "gpt-5.6-sol");
  expect(out.content[0]).toEqual({ type: "thinking", thinking: "Checking divisibility." });
  expect(out.content[1]).toEqual({ type: "text", text: "Yes, 17 is prime." });
  // Never fabricate a signature — Anthropic's is a server-issued attestation.
  expect("signature" in (out.content[0] as any)).toBe(false);
});

test("non-streaming: a reasoning item with NO summary opens no block", () => {
  const res = {
    output: [
      { type: "reasoning", summary: [] },
      { type: "message", content: [{ type: "output_text", text: "hi" }] },
    ],
  };
  const out = toAnthropicFromResponses(res, "m");
  expect(out.content).toHaveLength(1);
  expect(out.content[0].type).toBe("text");
});

test("streaming: summary deltas become thinking_delta, text keeps a contiguous index", async () => {
  const evs = await drain(toAnthropicStreamFromResponses(sse([
    { type: "response.output_item.added", output_index: 0, item: { type: "reasoning" } },
    { type: "response.reasoning_summary_text.delta", output_index: 0, delta: "Weighing " },
    { type: "response.reasoning_summary_text.delta", output_index: 0, delta: "the cases." },
    { type: "response.output_item.done", output_index: 0, item: { type: "reasoning" } },
    { type: "response.output_item.added", output_index: 1, item: { type: "message" } },
    { type: "response.output_text.delta", output_index: 1, delta: "Yes." },
    { type: "response.output_item.done", output_index: 1, item: { type: "message" } },
    { type: "response.completed", response: { usage: { input_tokens: 3, output_tokens: 4 } } },
  ]), "gpt-5.6-sol"));

  const starts = evs.filter(e => e.type === "content_block_start");
  expect(starts[0].content_block.type).toBe("thinking");
  expect(starts[0].index).toBe(0);
  expect(starts[1].content_block.type).toBe("text");
  // CONTIGUOUS from 0 — Anthropic requires it, and a hole here is the bug the
  // lookup-don't-allocate rule in output_item.done exists to prevent.
  expect(starts[1].index).toBe(1);

  const thinking = evs.filter(e => e.delta?.type === "thinking_delta").map(e => e.delta.thinking).join("");
  expect(thinking).toBe("Weighing the cases.");
  const stops = evs.filter(e => e.type === "content_block_stop").map(e => e.index);
  expect(stops).toContain(0);
  expect(stops).toContain(1);
});

test("streaming: a reasoning item with NO summary deltas opens NO empty thinking block", async () => {
  // The regression this guards: the backend prefixes ~every reply with a
  // reasoning item. Opening at `output_item.added` would emit an empty thinking
  // block on 100% of replies and push text off index 0.
  const evs = await drain(toAnthropicStreamFromResponses(sse([
    { type: "response.output_item.added", output_index: 0, item: { type: "reasoning" } },
    { type: "response.output_item.done", output_index: 0, item: { type: "reasoning" } },
    { type: "response.output_item.added", output_index: 1, item: { type: "message" } },
    { type: "response.output_text.delta", output_index: 1, delta: "Yes." },
    { type: "response.completed", response: {} },
  ]), "m"));
  const starts = evs.filter(e => e.type === "content_block_start");
  expect(starts).toHaveLength(1);
  expect(starts[0].content_block.type).toBe("text");
  expect(starts[0].index).toBe(0);
});

test("the SSE-only aggregator keeps the summary too", async () => {
  const res = await collectResponsesOutput(sse([
    { type: "response.output_item.added", output_index: 0, item: { type: "reasoning" } },
    {
      type: "response.output_item.done",
      output_index: 0,
      item: { type: "reasoning", summary: [{ type: "summary_text", text: "Because 17 has no divisors." }] },
    },
    {
      type: "response.output_item.done",
      output_index: 1,
      item: { type: "message", content: [{ type: "output_text", text: "Prime." }] },
    },
    { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 1 } } },
  ]));
  const out = toAnthropicFromResponses(res, "m");
  expect(out.content.some((c: any) => c.type === "thinking" && c.thinking.includes("no divisors"))).toBe(true);
  expect(out.content.some((c: any) => c.type === "text" && c.text === "Prime.")).toBe(true);
});
