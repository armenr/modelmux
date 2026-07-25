// Anthropic Messages <-> OpenAI Responses translation.
//
// The second wire format modelmux speaks (see openai.ts for Chat Completions).
// Responses is what the Codex subscription backend and OpenAI's newer surface
// use, and it differs from Chat Completions in ways that matter:
//
//   - the system prompt is `instructions`, not a message with role "system"
//   - conversation turns live in `input`, not `messages`
//   - tools are FLAT ({type,name,parameters}), not nested under `function`
//   - a tool call is an `input`/`output` ITEM, not a field on a message
//   - the token cap is `max_output_tokens`
//   - streaming uses named semantic events, not opaque chat chunks
//
// Shapes verified against the published Responses schema rather than recalled.

import type { Usage } from "./types.ts";

// ── request: Anthropic -> Responses ──────────────────────────────────────────

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

function blocksToText(content: unknown): string {
  if (typeof content === "string")
    return content;
  if (!Array.isArray(content))
    return "";
  return content
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text ?? "")
    .join("");
}

/**
 * Flatten Anthropic messages into the Responses `input` array.
 *
 * Anthropic carries tool calls INSIDE an assistant message and tool results
 * INSIDE a user message; Responses makes both standalone items, so one
 * Anthropic turn can expand into several input items.
 */
function toInputItems(messages: any[]): any[] {
  const input: any[] = [];
  for (const m of messages) {
    const content = m?.content;
    const blocks: any[] = Array.isArray(content) ? content : [];

    // tool results first: they answer the PREVIOUS assistant turn.
    for (const b of blocks) {
      if (b?.type !== "tool_result")
        continue;
      const c = b.content;
      input.push({
        type: "function_call_output",
        call_id: b.tool_use_id,
        output: typeof c === "string"
          ? c
          : Array.isArray(c)
            ? c.map((x: any) => (x?.type === "text" ? x.text : JSON.stringify(x))).join("\n")
            : JSON.stringify(c ?? ""),
      });
    }

    const text = blocksToText(content);
    if (text)
      input.push({ role: m?.role === "assistant" ? "assistant" : "user", content: text });

    for (const b of blocks) {
      if (b?.type !== "tool_use")
        continue;
      input.push({
        type: "function_call",
        call_id: b.id,
        name: b.name,
        arguments: JSON.stringify(b.input ?? {}),
      });
    }
  }
  return input;
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
    return { type: "function", name: tc.name };
  return undefined;
}

export function toResponsesRequest(body: any): any {
  const out: any = {
    model: body?.model,
    input: toInputItems(Array.isArray(body?.messages) ? body.messages : []),
  };

  const sys = systemToText(body?.system);
  if (sys)
    out.instructions = sys;
  if (body?.max_tokens != null)
    out.max_output_tokens = body.max_tokens;
  if (body?.temperature != null)
    out.temperature = body.temperature;
  if (body?.top_p != null)
    out.top_p = body.top_p;
  if (body?.stream)
    out.stream = true;

  if (Array.isArray(body?.tools) && body.tools.length) {
    // FLAT tool shape — Chat Completions nests under `function`, Responses does not.
    out.tools = body.tools.map((t: any) => ({
      type: "function",
      name: t.name,
      description: t.description ?? "",
      parameters: t.input_schema ?? { type: "object", properties: {} },
    }));
  }
  const tc = mapToolChoice(body?.tool_choice);
  if (tc !== undefined)
    out.tool_choice = tc;

  return out;
}

// ── response: Responses -> Anthropic ─────────────────────────────────────────

function usageOf(u: any): Usage {
  return {
    input_tokens: u?.input_tokens ?? 0,
    output_tokens: u?.output_tokens ?? 0,
  };
}

export function toAnthropicFromResponses(res: any, model: string): any {
  const content: any[] = [];
  let sawToolCall = false;

  for (const item of Array.isArray(res?.output) ? res.output : []) {
    if (item?.type === "message") {
      const text = (Array.isArray(item.content) ? item.content : [])
        .filter((c: any) => c?.type === "output_text")
        .map((c: any) => c.text ?? "")
        .join("");
      if (text)
        content.push({ type: "text", text });
    }
    else if (item?.type === "function_call") {
      sawToolCall = true;
      let input: any = {};
      try {
        input = JSON.parse(item.arguments || "{}");
      }
      catch {
        input = { _raw: item.arguments ?? "" };
      }
      // Anthropic's tool_use id must be the call_id, because that is what the
      // client echoes back as tool_use_id and what Responses matches on.
      content.push({ type: "tool_use", id: item.call_id, name: item.name, input });
    }
    // reasoning items carry no Anthropic equivalent and are dropped.
  }

  return {
    id: res?.id ?? "msg_responses",
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: sawToolCall
      ? "tool_use"
      : res?.incomplete_details?.reason === "max_output_tokens"
        ? "max_tokens"
        : "end_turn",
    stop_sequence: null,
    usage: usageOf(res?.usage),
  };
}

// ── streaming: Responses SSE -> Anthropic SSE ────────────────────────────────

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Responses streams NAMED semantic events, which map more directly onto
 * Anthropic's block model than Chat Completions chunks do:
 *
 *   response.output_item.added        -> content_block_start (the event carries
 *                                        the whole item, so its type decides
 *                                        whether a text or tool_use block opens)
 *   response.output_text.delta        -> content_block_delta / text_delta
 *   response.function_call_arguments.delta -> content_block_delta / input_json_delta
 *   response.output_item.done         -> content_block_stop
 *   response.completed                -> message_delta + message_stop
 */
export function toAnthropicStreamFromResponses(
  upstream: ReadableStream<Uint8Array>,
  model: string,
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = "";
  let started = false;
  let sawToolCall = false;
  let outputTokens = 0;
  let stopReason = "end_turn";
  const blockFor = new Map<number, number>(); // responses output_index -> anthropic index
  const openBlocks = new Set<number>();
  let nextIndex = 0;

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
            id: "msg_responses",
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

      const indexFor = (outputIndex: number): number => {
        let idx = blockFor.get(outputIndex);
        if (idx === undefined) {
          idx = nextIndex++;
          blockFor.set(outputIndex, idx);
        }
        return idx;
      };

      const handle = (ev: any): void => {
        const t = ev?.type;
        if (typeof t !== "string")
          return;

        if (t === "response.output_item.added") {
          openMessage();
          const idx = indexFor(ev.output_index ?? 0);
          const item = ev.item ?? {};
          if (item.type === "function_call") {
            sawToolCall = true;
            emit(sse("content_block_start", {
              type: "content_block_start",
              index: idx,
              content_block: { type: "tool_use", id: item.call_id, name: item.name, input: {} },
            }));
          }
          else {
            emit(sse("content_block_start", {
              type: "content_block_start",
              index: idx,
              content_block: { type: "text", text: "" },
            }));
          }
          openBlocks.add(idx);
          return;
        }

        if (t === "response.output_text.delta") {
          openMessage();
          emit(sse("content_block_delta", {
            type: "content_block_delta",
            index: indexFor(ev.output_index ?? 0),
            delta: { type: "text_delta", text: ev.delta ?? "" },
          }));
          return;
        }

        if (t === "response.function_call_arguments.delta") {
          openMessage();
          emit(sse("content_block_delta", {
            type: "content_block_delta",
            index: indexFor(ev.output_index ?? 0),
            delta: { type: "input_json_delta", partial_json: ev.delta ?? "" },
          }));
          return;
        }

        if (t === "response.output_item.done") {
          const idx = indexFor(ev.output_index ?? 0);
          if (openBlocks.delete(idx))
            emit(sse("content_block_stop", { type: "content_block_stop", index: idx }));
          return;
        }

        if (t === "response.completed" || t === "response.incomplete" || t === "response.failed") {
          const r = ev.response ?? {};
          const u = usageOf(r.usage);
          outputTokens = u.output_tokens;
          if (r?.incomplete_details?.reason === "max_output_tokens")
            stopReason = "max_tokens";
        }
      };

      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done)
            break;
          buf += dec.decode(value, { stream: true });
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
                handle(JSON.parse(payload));
              }
              catch {
                // one bad frame must not lose the turn
              }
            }
          }
        }

        openMessage();
        for (const idx of openBlocks)
          emit(sse("content_block_stop", { type: "content_block_stop", index: idx }));
        openBlocks.clear();
        emit(sse("message_delta", {
          type: "message_delta",
          delta: { stop_reason: sawToolCall ? "tool_use" : stopReason, stop_sequence: null },
          usage: { output_tokens: outputTokens },
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

export function responsesPath(inboundPath: string): string {
  return inboundPath.replace(/\/v1\/messages$/, "/responses");
}
