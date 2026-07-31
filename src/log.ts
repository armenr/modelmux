import type { Decision, Signals } from "./types.ts";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import process from "node:process";

// Best-effort append: a logging I/O failure (bad MUX_LOG path, read-only cwd,
// full disk) is observability, not correctness — it must never crash a request
// that would otherwise route fine.
function tryAppend(path: string, line: string): void {
  try {
    appendFileSync(path, line);
  }
  catch {
    // swallow — do not let a log write take down the proxy
  }
}

export function logDecision(path: string, signals: Signals, decision: Decision): void {
  const record = {
    ts: new Date().toISOString(),
    sessionId: signals.sessionId,
    agentId: signals.agentId,
    isSubagent: signals.isSubagent,
    xApp: signals.xApp,
    requestedModel: signals.requestedModel,
    tokensIn: signals.tokensIn,
    matchedRule: decision.matchedRule,
    upstream: decision.upstream,
    resolvedModel: decision.model,
  };
  tryAppend(path, `${JSON.stringify(record)}\n`);
  process.stderr.write(
    `[route] ${decision.matchedRule} -> ${decision.upstream}:${decision.model}`
    + ` (sub=${signals.isSubagent})\n`,
  );
}

// Per-request usage, appended when the reply COMPLETES — a second record, not an
// amendment to the first (this log is append-only JSONL).
//
// Why it exists (OQ-015): on a translated leg the wire cannot carry real input
// tokens. Anthropic reports them in `message_start`; an OpenAI/Responses upstream
// sends no usage at all until the stream closes, so `message_start` honestly says
// 0 rather than inventing a number. A dashboard reading usage from there sees a
// STRUCTURAL ZERO for the whole life of the request — indistinguishable from an
// agent that did nothing. Measured in the field: three healthy GLM legs read
// `0 tok` beside Opus twins at ~200k and were taken for dead.
//
// Fabricating an estimate into `message_start` was REJECTED: that field means
// "measured tokens as billed", the tokenizers differ per provider, and the whole
// use case is cross-upstream comparison — a plausible wrong number ends an
// investigation that an obvious zero would have started.
//
// SCOPE, stated because the gap is the point: this covers TRANSLATED legs only.
// An `anthropic` passthrough leg is forwarded unparsed by design (the untouched
// fast path), so it contributes no record here — and needs none: its client
// already receives real native usage. This fills the half that was missing.
export function logUsage(
  path: string,
  signals: Signals,
  decision: Decision,
  usage: { input_tokens?: number; output_tokens?: number } | null | undefined,
): void {
  if (!usage)
    return;
  const record = {
    ts: new Date().toISOString(),
    kind: "usage",
    sessionId: signals.sessionId,
    agentId: signals.agentId,
    isSubagent: signals.isSubagent,
    upstream: decision.upstream,
    resolvedModel: decision.model,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  };
  tryAppend(path, `${JSON.stringify(record)}\n`);
}

// Fail-loud companion: record a routing/forwarding error to the same log seam.
export function logError(path: string, signals: Signals, err: Error): void {
  const record = {
    ts: new Date().toISOString(),
    sessionId: signals.sessionId,
    agentId: signals.agentId,
    isSubagent: signals.isSubagent,
    matchedRule: "error",
    error: err.message,
  };
  tryAppend(path, `${JSON.stringify(record)}\n`);
  process.stderr.write(`[route] ERROR ${err.message}\n`);
}

export function readDecisions(path: string): any[] {
  if (!existsSync(path))
    return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(l => l.trim().length > 0)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      }
      catch {
        return []; // skip a truncated/partial final line rather than losing every record
      }
    });
}
