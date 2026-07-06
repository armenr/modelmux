import { mkdirSync, writeFileSync } from "node:fs";
import process from "node:process";
import { extractSignals } from "../src/signals.ts";

// Record real Claude Code requests for hermetic replay.
// Usage: bun run scripts/record-fixtures.ts   (then run `claude -p ...` against it)

const REDACT = ["authorization", "x-api-key", "cookie"];

// Never persist real Claude Code credentials into a (git-tracked) fixture.
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out = { ...headers };
  for (const k of REDACT) {
    if (k in out)
      out[k] = "REDACTED";
  }
  return out;
}

function stripHop(h: Headers): Headers {
  const out = new Headers(h);
  for (const k of ["host", "content-length", "connection", "accept-encoding"]) out.delete(k);
  return out;
}

function startRecorder(): void {
  mkdirSync("test/fixtures", { recursive: true });
  let n = 0;
  Bun.serve({
    port: Number(process.env.PORT ?? 8787),
    idleTimeout: 0,
    async fetch(req) {
      const body = await req.json();
      const s = extractSignals(req.headers, body);
      const name = `${String(++n).padStart(2, "0")}-${s.isSubagent ? "sub" : "main"}-${s.tag ?? "none"}`;
      writeFileSync(
        `test/fixtures/${name}.json`,
        JSON.stringify({ headers: redactHeaders(Object.fromEntries(req.headers)), body }, null, 2),
      );
      process.stderr.write(`recorded ${name}\n`);
      // Forward to real Anthropic so the session keeps working while recording.
      const url = new URL(req.url);
      const upstream = await fetch(`https://api.anthropic.com${url.pathname}${url.search}`, {
        method: req.method,
        headers: stripHop(req.headers),
        body: JSON.stringify(body),
      });
      return new Response(upstream.body, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
    },
  });
  console.error(`recorder on :${process.env.PORT ?? 8787}`);
}

if (import.meta.main)
  startRecorder();
