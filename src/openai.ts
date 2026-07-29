import type { MaxTokensField } from "./types.ts";

// Anthropic Messages <-> OpenAI Chat Completions translation.
//
// modelmux forwards the Anthropic Messages shape. Backends that only speak the
// OpenAI Chat Completions shape (LM Studio, llama.cpp, vLLM, the OpenAI API
// itself, and most "OpenAI-compatible" providers) are reachable by declaring
// `format = "openai"` on an upstream; this module is the whole adapter.
//
// Field and SSE-event mappings follow the published Anthropic Messages and
// OpenAI Chat Completions specs. Where the two disagree the Anthropic side wins,
// because that is the contract Claude Code holds us to.

// ── request: Anthropic -> OpenAI ─────────────────────────────────────────────

// Anthropic sends `system` as a string OR an array of text blocks; OpenAI wants
// one leading system message.
function systemToText(system: unknown): string {
  if (typeof system === "string")
    return system;
  if (Array.isArray(system)) {
    return system
      .map((b: any) => (typeof b?.text === "string" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

// An Anthropic image block carries base64 + media type; OpenAI wants a data URL.
function imageUrl(source: any): string {
  if (source?.type === "url" && typeof source.url === "string")
    return source.url;
  return `data:${source?.media_type ?? "image/png"};base64,${source?.data ?? ""}`;
}

// Anthropic content is a string or a block array. Returns OpenAI `content`
// (string when it is plain text, else a parts array) plus any tool_use /
// tool_result blocks, which become separate OpenAI structures.
function splitContent(content: unknown): {
  content: any;
  toolCalls: any[];
  toolResults: { tool_call_id: string; content: string }[];
} {
  if (typeof content === "string")
    return { content, toolCalls: [], toolResults: [] };
  if (!Array.isArray(content))
    return { content: "", toolCalls: [], toolResults: [] };

  const parts: any[] = [];
  const toolCalls: any[] = [];
  const toolResults: { tool_call_id: string; content: string }[] = [];

  for (const b of content) {
    if (b?.type === "text") {
      parts.push({ type: "text", text: b.text ?? "" });
    }
    else if (b?.type === "image") {
      parts.push({ type: "image_url", image_url: { url: imageUrl(b.source) } });
    }
    else if (b?.type === "tool_use") {
      toolCalls.push({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      });
    }
    else if (b?.type === "tool_result") {
      const c = b.content;
      toolResults.push({
        tool_call_id: b.tool_use_id,
        content: typeof c === "string"
          ? c
          : Array.isArray(c)
            ? c.map((x: any) => (x?.type === "text" ? x.text : JSON.stringify(x))).join("\n")
            : JSON.stringify(c ?? ""),
      });
    }
    // thinking / redacted_thinking blocks have no Chat Completions equivalent
    // and are dropped rather than smuggled through as text.
  }

  // Collapse a lone text part back to a plain string — some OpenAI-compatible
  // servers are stricter about the parts array than the spec requires.
  const only = parts.length === 1 && parts[0].type === "text" ? parts[0].text : null;
  return { content: only ?? (parts.length ? parts : ""), toolCalls, toolResults };
}

function mapToolChoice(tc: any): any {
  if (!tc)
    return undefined;
  if (tc.type === "auto")
    return "auto";
  if (tc.type === "any")
    return "required";
  if (tc.type === "none")
    return "none";
  if (tc.type === "tool" && tc.name)
    return { type: "function", function: { name: tc.name } };
  return undefined;
}

export function toOpenAIRequest(body: any, maxTokensField: MaxTokensField = "max_tokens"): any {
  const messages: any[] = [];

  const sys = systemToText(body?.system);
  if (sys)
    messages.push({ role: "system", content: sys });

  for (const m of Array.isArray(body?.messages) ? body.messages : []) {
    const { content, toolCalls, toolResults } = splitContent(m?.content);

    // Anthropic packs tool results into a USER message; OpenAI needs one
    // `tool` message per result, and they must precede the next user turn.
    for (const tr of toolResults)
      messages.push({ role: "tool", tool_call_id: tr.tool_call_id, content: tr.content });

    if (m?.role === "assistant") {
      const msg: any = { role: "assistant", content: content === "" ? null : content };
      if (toolCalls.length)
        msg.tool_calls = toolCalls;
      // An assistant turn that was ONLY tool calls has no content to send.
      if (msg.content !== null || msg.tool_calls)
        messages.push(msg);
    }
    else if (content !== "" || (!toolResults.length && !toolCalls.length)) {
      messages.push({ role: "user", content });
    }
  }

  const out: any = { model: body?.model, messages };
  if (body?.max_tokens != null)
    out[maxTokensField] = body.max_tokens;
  if (body?.temperature != null)
    out.temperature = body.temperature;
  if (body?.top_p != null)
    out.top_p = body.top_p;
  if (Array.isArray(body?.stop_sequences) && body.stop_sequences.length)
    out.stop = body.stop_sequences;
  if (body?.stream) {
    out.stream = true;
    // Chat Completions omits usage from streams unless asked. Anthropic's
    // message_delta carries output_tokens, so without this the token count is
    // structurally always zero — the stream looks fine and the numbers are lies.
    out.stream_options = { include_usage: true };
  }

  if (Array.isArray(body?.tools) && body.tools.length) {
    out.tools = body.tools.map((t: any) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description ?? "",
        parameters: t.input_schema ?? { type: "object", properties: {} },
      },
    }));
  }
  const tc = mapToolChoice(body?.tool_choice);
  if (tc !== undefined)
    out.tool_choice = tc;

  return out;
}

// ── response: OpenAI -> Anthropic ────────────────────────────────────────────

export function mapStopReason(finish: string | null | undefined, hadToolCalls = false): string {
  if (hadToolCalls || finish === "tool_calls")
    return "tool_use";
  switch (finish) {
    case "length": return "max_tokens";
    case "stop": return "end_turn";
    case "content_filter": return "stop_sequence";
    default: return "end_turn";
  }
}

export function toAnthropicResponse(oai: any, model: string): any {
  const choice = oai?.choices?.[0];
  const msg = choice?.message ?? {};
  const content: any[] = [];

  // Reasoning FIRST, matching Anthropic's own ordering (thinking precedes text).
  // OpenAI-format reasoning backends return it out-of-band as `reasoning_content`
  // (Z.ai/GLM, DeepSeek) or `reasoning` (some others); without this it arrives and
  // is silently dropped, so the caller pays for depth it never sees. NOTE: no
  // `signature` is emitted — that is an Anthropic-issued attestation we cannot
  // forge, and fabricating one would be worse than omitting it.
  const reasoning = msg.reasoning_content ?? msg.reasoning;
  if (typeof reasoning === "string" && reasoning.length)
    content.push({ type: "thinking", thinking: reasoning });

  if (typeof msg.content === "string" && msg.content.length)
    content.push({ type: "text", text: msg.content });

  const calls: any[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
  for (const c of calls) {
    let input: any = {};
    try {
      input = JSON.parse(c?.function?.arguments || "{}");
    }
    catch {
      // A backend that streams malformed JSON must not take the whole reply
      // down; surface the raw string so the caller can see what arrived.
      input = { _raw: c?.function?.arguments ?? "" };
    }
    content.push({ type: "tool_use", id: c?.id, name: c?.function?.name, input });
  }

  return {
    id: oai?.id ?? "msg_openai",
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: mapStopReason(choice?.finish_reason, calls.length > 0),
    stop_sequence: null,
    usage: {
      input_tokens: oai?.usage?.prompt_tokens ?? 0,
      output_tokens: oai?.usage?.completion_tokens ?? 0,
    },
  };
}

// ── streaming: OpenAI SSE -> Anthropic SSE ───────────────────────────────────

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Translate an OpenAI Chat Completions SSE stream into the Anthropic Messages
 * SSE event sequence Claude Code expects:
 *
 *   message_start → (content_block_start → content_block_delta* →
 *   content_block_stop)* → message_delta → message_stop
 *
 * Tool calls arrive from OpenAI as argument FRAGMENTS across chunks; Anthropic
 * models the same thing as input_json_delta, so fragments map through directly
 * rather than being buffered and re-emitted whole.
 */
export function toAnthropicStream(upstream: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = "";
  let started = false;
  // Block indices are ALLOCATED, not hardcoded. A reasoning backend emits
  // `reasoning_content` before `content`, so thinking takes index 0 and text
  // shifts to 1 — but only when reasoning actually arrives. With no reasoning
  // the first allocation still goes to text at index 0, so a non-reasoning
  // backend produces byte-identical output to before this existed.
  let nextIndex = 0;
  let thinkingIdx: number | null = null;
  let thinkingClosed = false;
  let textIdx: number | null = null;
  const openToolBlocks = new Map<number, number>(); // openai tool index -> anthropic block index
  let finish: string | null = null;
  let sawToolCall = false;
  let outputTokens = 0;
  // Same reason as responses.ts: usage arrives at the END of the stream, long
  // after message_start had to claim a number. Report it in message_delta.
  let inputTokens = 0;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (s: string): void => controller.enqueue(enc.encode(s));

      const openMessage = (): void => {
        if (started)
          return;
        started = true;
        emit(sse("message_start", {
          type: "message_start",
          message: {
            id: "msg_openai",
            type: "message",
            role: "assistant",
            model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        }));
      };

      const closeThinking = (): void => {
        if (thinkingIdx !== null && !thinkingClosed) {
          emit(sse("content_block_stop", { type: "content_block_stop", index: thinkingIdx }));
          thinkingClosed = true;
        }
      };

      const closeOpenBlocks = (): void => {
        closeThinking();
        if (textIdx !== null) {
          emit(sse("content_block_stop", { type: "content_block_stop", index: textIdx }));
          textIdx = null;
        }
        for (const idx of openToolBlocks.values())
          emit(sse("content_block_stop", { type: "content_block_stop", index: idx }));
        openToolBlocks.clear();
      };

      const handleChunk = (json: any): void => {
        // The usage-bearing chunk that `stream_options.include_usage` adds
        // arrives with an EMPTY choices array, so this must be read before the
        // no-choice guard below or the count is silently dropped.
        if (json?.usage?.completion_tokens != null)
          outputTokens = json.usage.completion_tokens;
        if (json?.usage?.prompt_tokens != null)
          inputTokens = json.usage.prompt_tokens;

        const choice = json?.choices?.[0];
        if (!choice)
          return;
        const delta = choice.delta ?? {};
        openMessage();

        // Reasoning deltas, out-of-band from content. Z.ai/GLM and DeepSeek use
        // `reasoning_content`; some backends use `reasoning`.
        const rDelta = delta.reasoning_content ?? delta.reasoning;
        if (typeof rDelta === "string" && rDelta.length && !thinkingClosed) {
          if (thinkingIdx === null) {
            thinkingIdx = nextIndex++;
            emit(sse("content_block_start", {
              type: "content_block_start",
              index: thinkingIdx,
              content_block: { type: "thinking", thinking: "" },
            }));
          }
          emit(sse("content_block_delta", {
            type: "content_block_delta",
            index: thinkingIdx,
            delta: { type: "thinking_delta", thinking: rDelta },
          }));
        }

        if (typeof delta.content === "string" && delta.content.length) {
          if (textIdx === null) {
            // Anthropic blocks do not interleave: the thinking block must be
            // closed before the text block opens.
            closeThinking();
            textIdx = nextIndex++;
            emit(sse("content_block_start", {
              type: "content_block_start",
              index: textIdx,
              content_block: { type: "text", text: "" },
            }));
          }
          emit(sse("content_block_delta", {
            type: "content_block_delta",
            index: textIdx,
            delta: { type: "text_delta", text: delta.content },
          }));
        }

        for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
          sawToolCall = true;
          const oaiIdx = call.index ?? 0;
          if (!openToolBlocks.has(oaiIdx)) {
            closeThinking(); // a tool_use block must not open inside thinking
            const idx = nextIndex++;
            openToolBlocks.set(oaiIdx, idx);
            emit(sse("content_block_start", {
              type: "content_block_start",
              index: idx,
              content_block: { type: "tool_use", id: call.id ?? `call_${oaiIdx}`, name: call.function?.name ?? "", input: {} },
            }));
          }
          const frag = call.function?.arguments;
          if (typeof frag === "string" && frag.length) {
            emit(sse("content_block_delta", {
              type: "content_block_delta",
              index: openToolBlocks.get(oaiIdx)!,
              delta: { type: "input_json_delta", partial_json: frag },
            }));
          }
        }

        if (choice.finish_reason)
          finish = choice.finish_reason;
      };

      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done)
            break;
          buf += dec.decode(value, { stream: true });
          // SSE frames are separated by a blank line; keep the partial tail.
          const frames = buf.split("\n\n");
          buf = frames.pop() ?? "";
          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:"))
                continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]")
                continue;
              try {
                handleChunk(JSON.parse(payload));
              }
              catch {
                // Skip an unparseable chunk rather than killing the stream —
                // one bad frame must not lose the turn.
              }
            }
          }
        }

        // An upstream that produced nothing still owes Claude Code a well-formed
        // message envelope, or the client hangs waiting for message_stop.
        openMessage();
        closeOpenBlocks();
        emit(sse("message_delta", {
          type: "message_delta",
          delta: { stop_reason: mapStopReason(finish, sawToolCall), stop_sequence: null },
          usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        }));
        emit(sse("message_stop", { type: "message_stop" }));
        controller.close();
      }
      catch (e) {
        controller.error(e);
      }
      finally {
        reader.releaseLock();
      }
    },
  });
}

// Chat Completions lives at a different path than Messages.
export function openaiPath(inboundPath: string): string {
  return inboundPath.replace(/\/v1\/messages$/, "/v1/chat/completions");
}
