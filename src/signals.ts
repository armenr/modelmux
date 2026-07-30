import type { Signals } from "./types.ts";

// A directive is a `<<route:NAME>>` token ALONE on its own line (ADR-0004).
//
// It was unanchored, matched against the whole system text, first-match-wins —
// so ANY MENTION of a tag was the tag, including the sentence documenting it.
// Backticks and code fences do not fence a regex. A peer lost a six-leg
// model-comparison run to it: their CONTROL arm carried no directive, only a
// sentence explaining one, and routed to the model under test. Worse, a prose
// mention placed BEFORE a real directive OVERRODE it, so a correctly-tagged
// agent could be hijacked by an earlier incidental reference.
//
// Exported because `cli.ts` must agree with the router on what a directive IS —
// when they disagreed, `mux use` rewrote a doc string and reported success.
//
// Own-line survives the wire: MEASURED from a recorded subagent request,
// `body.system` arrives as a block array whose agent-body block opens with
// `<<route:NAME>>\n\n`, and `systemToText` joins blocks with "\n".
export const TAG_LINE_RE = /^[ \t]*<<route:([\w-]+)>>[ \t]*$/im;

export function extractSignals(headers: Headers, body: any): Signals {
  const agentId = headers.get("x-claude-code-agent-id");
  const sessionId = headers.get("x-claude-code-session-id");
  const xApp = headers.get("x-app");
  const systemText = systemToText(body?.system);
  const tagMatch = systemText.match(TAG_LINE_RE);
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
