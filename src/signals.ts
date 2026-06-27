import type { Signals } from "./types.ts";

const TAG_RE = /<<route:([\w-]+)>>/i;

export function extractSignals(headers: Headers, body: any): Signals {
  const agentId = headers.get("x-claude-code-agent-id");
  const sessionId = headers.get("x-claude-code-session-id");
  const xApp = headers.get("x-app");
  const systemText = systemToText(body?.system);
  const tagMatch = systemText.match(TAG_RE);
  const tools: any[] = Array.isArray(body?.tools) ? body.tools : [];
  return {
    agentId: agentId ?? null,
    sessionId: sessionId ?? null,
    isSubagent: agentId != null,
    xApp: xApp ?? null,
    requestedModel: typeof body?.model === "string" ? body.model : null,
    systemText,
    tag: tagMatch ? tagMatch[1].toLowerCase() : null,
    hasThinking: body?.thinking != null,
    tokensIn: estimateTokens(body),
    hasWebSearch: tools.some(
      t => typeof t?.type === "string" && t.type.startsWith("web_search"),
    ),
  };
}

function systemToText(system: unknown): string {
  if (typeof system === "string")
    return system;
  if (Array.isArray(system)) {
    return system
      .map(b => (typeof b?.text === "string" ? b.text : ""))
      .join("\n");
  }
  return "";
}

function estimateTokens(body: unknown): number {
  try {
    return Math.ceil(JSON.stringify(body).length / 4);
  }
  catch {
    return 0;
  }
}
