import type { Decision, Signals } from "./types.ts";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import process from "node:process";

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
  appendFileSync(path, `${JSON.stringify(record)}\n`);
  process.stderr.write(
    `[route] ${decision.matchedRule} -> ${decision.upstream}:${decision.model}`
    + ` (sub=${signals.isSubagent})\n`,
  );
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
  appendFileSync(path, `${JSON.stringify(record)}\n`);
  process.stderr.write(`[route] ERROR ${err.message}\n`);
}

export function readDecisions(path: string): any[] {
  if (!existsSync(path))
    return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(l => l.trim().length > 0)
    .map(l => JSON.parse(l));
}
