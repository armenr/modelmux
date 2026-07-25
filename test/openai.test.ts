import { expect, test } from "bun:test";
import { mapStopReason, openaiPath, toAnthropicResponse, toAnthropicStream, toOpenAIRequest } from "../src/openai.ts";

// ── request: Anthropic -> OpenAI ─────────────────────────────────────────────

test("system string becomes a leading system message", () => {
  const out = toOpenAIRequest({ system: "be terse", messages: [{ role: "user", content: "hi" }] });
  expect(out.messages[0]).toEqual({ role: "system", content: "be terse" });
  expect(out.messages[1]).toEqual({ role: "user", content: "hi" });
});

test("system BLOCK ARRAY is flattened (Claude Code sends this form)", () => {
  const out = toOpenAIRequest({
    system: [{ type: "text", text: "line one" }, { type: "text", text: "line two" }],
    messages: [],
  });
  expect(out.messages[0].content).toBe("line one\nline two");
});

test("tools map to OpenAI function shape with input_schema -> parameters", () => {
  const out = toOpenAIRequest({
    messages: [],
    tools: [{ name: "get_weather", description: "d", input_schema: { type: "object", properties: { q: { type: "string" } } } }],
  });
  expect(out.tools[0]).toEqual({
    type: "function",
    function: { name: "get_weather", description: "d", parameters: { type: "object", properties: { q: { type: "string" } } } },
  });
});

test("tool_choice maps across all four Anthropic forms", () => {
  const at = (tc: any): any => toOpenAIRequest({ messages: [], tool_choice: tc }).tool_choice;
  expect(at({ type: "auto" })).toBe("auto");
  expect(at({ type: "any" })).toBe("required"); // Anthropic "any" == OpenAI "required"
  expect(at({ type: "none" })).toBe("none");
  expect(at({ type: "tool", name: "f" })).toEqual({ type: "function", function: { name: "f" } });
});

test("assistant tool_use becomes tool_calls with stringified arguments", () => {
  const out = toOpenAIRequest({
    messages: [{ role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "f", input: { a: 1 } }] }],
  });
  const msg = out.messages[0];
  expect(msg.role).toBe("assistant");
  expect(msg.tool_calls[0]).toEqual({ id: "toolu_1", type: "function", function: { name: "f", arguments: `{"a":1}` } });
});

test("tool_result in a USER message becomes a separate tool message", () => {
  // Anthropic packs results into a user turn; OpenAI needs role:"tool" rows.
  const out = toOpenAIRequest({
    messages: [{ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "42" }] }],
  });
  expect(out.messages).toEqual([{ role: "tool", tool_call_id: "toolu_1", content: "42" }]);
});

test("image blocks become data-URL image_url parts", () => {
  const out = toOpenAIRequest({
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAA" } }] }],
  });
  expect(out.messages[0].content[0]).toEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,AAA" } });
});

test("stop_sequences map to stop; sampling params pass through", () => {
  const out = toOpenAIRequest({ messages: [], stop_sequences: ["END"], temperature: 0.2, top_p: 0.9 });
  expect(out.stop).toEqual(["END"]);
  expect(out.temperature).toBe(0.2);
  expect(out.top_p).toBe(0.9);
});

test("max_tokens goes to the configured field — newer OpenAI models reject max_tokens", () => {
  expect(toOpenAIRequest({ messages: [], max_tokens: 10 }).max_tokens).toBe(10);
  const newer = toOpenAIRequest({ messages: [], max_tokens: 10 }, "max_completion_tokens");
  expect(newer.max_completion_tokens).toBe(10);
  expect(newer.max_tokens).toBeUndefined(); // sending both is what triggers the 400
});

test("a streaming request ASKS for usage — without this the token count is always zero", () => {
  const out = toOpenAIRequest({ messages: [], stream: true });
  expect(out.stream).toBe(true);
  expect(out.stream_options).toEqual({ include_usage: true });
});

test("a non-streaming request sends no stream_options", () => {
  expect(toOpenAIRequest({ messages: [] }).stream_options).toBeUndefined();
});

// ── response: OpenAI -> Anthropic ────────────────────────────────────────────

test("a text reply becomes an Anthropic message envelope", () => {
  const out = toAnthropicResponse({
    id: "chatcmpl-1",
    choices: [{ message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 7, completion_tokens: 3 },
  }, "local-model");
  expect(out.type).toBe("message");
  expect(out.role).toBe("assistant");
  expect(out.model).toBe("local-model");
  expect(out.content).toEqual([{ type: "text", text: "hello" }]);
  expect(out.stop_reason).toBe("end_turn");
  expect(out.usage).toEqual({ input_tokens: 7, output_tokens: 3 });
});

test("tool_calls become tool_use blocks with PARSED input", () => {
  const out = toAnthropicResponse({
    choices: [{
      message: { tool_calls: [{ id: "call_1", function: { name: "f", arguments: `{"a":1}` } }] },
      finish_reason: "tool_calls",
    }],
  }, "m");
  expect(out.content[0]).toEqual({ type: "tool_use", id: "call_1", name: "f", input: { a: 1 } });
  expect(out.stop_reason).toBe("tool_use");
});

test("malformed tool arguments surface rather than throwing", () => {
  const out = toAnthropicResponse({
    choices: [{ message: { tool_calls: [{ id: "c", function: { name: "f", arguments: "{not json" } }] } }],
  }, "m");
  expect(out.content[0].input._raw).toBe("{not json");
});

test("stop reasons map to Anthropic's vocabulary", () => {
  expect(mapStopReason("stop")).toBe("end_turn");
  expect(mapStopReason("length")).toBe("max_tokens");
  expect(mapStopReason("tool_calls")).toBe("tool_use");
  expect(mapStopReason("content_filter")).toBe("stop_sequence");
  expect(mapStopReason(null)).toBe("end_turn");
});

// ── streaming: OpenAI SSE -> Anthropic SSE ───────────────────────────────────

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const s of chunks)
        c.enqueue(enc.encode(s));
      c.close();
    },
  });
}

async function collect(rs: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(rs).text();
}

function events(sse: string): string[] {
  return [...sse.matchAll(/^event: (.+)$/gm)].map(m => m[1]!);
}

test("a text stream emits the documented Anthropic event sequence", async () => {
  const out = await collect(toAnthropicStream(streamOf([
    `data: {"choices":[{"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
    `data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\n`,
    `data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n`,
    `data: [DONE]\n\n`,
  ]), "m"));
  expect(events(out)).toEqual([
    "message_start",
    "content_block_start",
    "content_block_delta",
    "content_block_delta",
    "content_block_stop",
    "message_delta",
    "message_stop",
  ]);
  expect(out).toContain(`"type":"text_delta","text":"Hel"`);
  expect(out).toContain(`"stop_reason":"end_turn"`);
});

test("tool calls stream as input_json_delta fragments, not buffered wholes", async () => {
  const out = await collect(toAnthropicStream(streamOf([
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_weather","arguments":""}}]}}]}\n\n`,
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"loc"}}]}}]}\n\n`,
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ation\\":\\"SF\\"}"}}]}}]}\n\n`,
    `data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n`,
    `data: [DONE]\n\n`,
  ]), "m"));
  // content_block_start must carry the tool id + name with empty input, per spec.
  expect(out).toContain(`"content_block":{"type":"tool_use","id":"call_1","name":"get_weather","input":{}}`);
  expect(out).toContain(`"type":"input_json_delta","partial_json":"{\\"loc"`);
  expect(out).toContain(`"type":"input_json_delta","partial_json":"ation\\":\\"SF\\"}"`);
  expect(out).toContain(`"stop_reason":"tool_use"`);
});

test("text and a tool call occupy DIFFERENT block indices", async () => {
  const out = await collect(toAnthropicStream(streamOf([
    `data: {"choices":[{"delta":{"content":"thinking"}}]}\n\n`,
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"f","arguments":"{}"}}]}}]}\n\n`,
    `data: [DONE]\n\n`,
  ]), "m"));
  expect(out).toContain(`"content_block_start","index":0,"content_block":{"type":"text"`);
  expect(out).toContain(`"content_block_start","index":1,"content_block":{"type":"tool_use"`);
});

test("usage arrives on a chunk with an EMPTY choices array and must still be read", async () => {
  // This is the shape `stream_options.include_usage` produces. Reading usage
  // after a `choices[0]` guard silently drops it.
  const out = await collect(toAnthropicStream(streamOf([
    `data: {"choices":[{"delta":{"content":"hi"},"finish_reason":"stop"}]}\n\n`,
    `data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":11}}\n\n`,
    `data: [DONE]\n\n`,
  ]), "m"));
  // BOTH figures ride that same empty-choices chunk, so both must survive the
  // guard — input_tokens is the half that used to be reported as a flat 0,
  // which reads as "free" rather than "not yet known" (OQ-006).
  expect(out).toContain(`"usage":{"input_tokens":5,"output_tokens":11}`);
});

test("an SSE frame split across chunk boundaries is reassembled", async () => {
  const out = await collect(toAnthropicStream(streamOf([
    `data: {"choices":[{"delta":{"cont`,
    `ent":"split"}}]}\n\n`,
    `data: [DONE]\n\n`,
  ]), "m"));
  expect(out).toContain(`"text":"split"`);
});

test("an empty upstream stream still produces a well-formed envelope", async () => {
  // Otherwise the client waits forever for message_stop.
  const out = await collect(toAnthropicStream(streamOf([`data: [DONE]\n\n`]), "m"));
  expect(events(out)).toEqual(["message_start", "message_delta", "message_stop"]);
});

test("one unparseable frame does not kill the turn", async () => {
  const out = await collect(toAnthropicStream(streamOf([
    `data: {broken json\n\n`,
    `data: {"choices":[{"delta":{"content":"ok"}}]}\n\n`,
    `data: [DONE]\n\n`,
  ]), "m"));
  expect(out).toContain(`"text":"ok"`);
  expect(events(out)).toContain("message_stop");
});

// ── path ─────────────────────────────────────────────────────────────────────

test("the Messages path is rewritten to Chat Completions", () => {
  expect(openaiPath("/v1/messages")).toBe("/v1/chat/completions");
  expect(openaiPath("/v1/chat/completions")).toBe("/v1/chat/completions"); // idempotent
});
