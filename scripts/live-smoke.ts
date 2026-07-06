// `bun run scripts/live-smoke.ts` (aka `bun test:live`) — a REAL end-to-end
// check: start the proxy in-process, send a request shaped like a Claude Code
// subagent tagged to the `flagship` route, and confirm it forwards to
// OpenRouter and comes back 200. Opt-in: it needs OPENROUTER_API_KEY and does a
// live billable call, so it is NOT part of the hermetic `bun test` suite.
//
// If the configured flagship slug is stale, override it with the same env knob
// the proxy already understands:
//   HETERO_MODEL_FLAGSHIP=openrouter:<real-slug> bun run scripts/live-smoke.ts
import process from "node:process";
import { loadConfig } from "../src/config.ts";
import { buildServer } from "../src/server.ts";

export interface SmokeProbe {
  headers: Record<string, string>;
  body: any;
}

// A request that looks like a Claude Code SUBAGENT (has x-claude-code-agent-id)
// explicitly tagged to the flagship route. The requested `model` is deliberately
// a Claude id — the proxy must reroute it, proving routing actually happened.
export function buildSmokeProbe(): SmokeProbe {
  return {
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-claude-code-agent-id": "live-smoke",
    },
    body: {
      model: "claude-sonnet-4-5",
      max_tokens: 16,
      system: "<<route:flagship>> Reply with exactly: OK",
      messages: [{ role: "user", content: "Say OK." }],
    },
  };
}

export async function run(): Promise<number> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("[live-smoke] SKIP — set OPENROUTER_API_KEY to run a real end-to-end call.");
    return 0;
  }

  const server = buildServer({
    config: loadConfig("routes.jsonc"),
    env: process.env,
    logPath: process.env.HETERO_LOG ?? "decisions.jsonl",
    port: 0, // ephemeral
  });

  try {
    const probe = buildSmokeProbe();
    const res = await fetch(`${server.url.origin}/v1/messages`, {
      method: "POST",
      headers: probe.headers,
      body: JSON.stringify(probe.body),
    });
    const text = await res.text();

    if (res.status !== 200) {
      console.error(`[live-smoke] FAIL — proxy returned HTTP ${res.status}`);
      console.error(text.slice(0, 400));
      console.error(
        "\nHint: the flagship slug may not exist on OpenRouter yet.\n"
        + "  • see what's live:  hetero check-latest\n"
        + "  • or override:      HETERO_MODEL_FLAGSHIP=openrouter:<real-slug> bun run scripts/live-smoke.ts",
      );
      return 1;
    }

    console.log("[live-smoke] PASS — subagent request routed through the proxy to OpenRouter (HTTP 200).");
    console.log(text.slice(0, 200));
    return 0;
  }
  finally {
    server.stop(true);
  }
}

if (import.meta.main) {
  process.exit(await run());
}
