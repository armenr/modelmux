import { expect, test } from "bun:test";
import { BUILTIN_UPSTREAMS, rewriteHeaders } from "../src/upstreams.ts";

// REGRESSION: modelmux silently redirected billing from a SUBSCRIPTION to a
// METERED API key.
//
// `applyAuth`'s passthrough branch preferred `auth.envKey` and returned before it
// ever read the inbound headers. The `anthropic` built-in carried
// `envKey: "ANTHROPIC_API_KEY"`, so on any machine with that variable exported —
// common, and usually set for unrelated reasons — Claude Code's subscription OAuth
// was replaced by the metered key on EVERY request through the default upstream.
//
// The tell was visible and missed: the proxy answered 200 to a request carrying no
// credentials at all. 93 orchestrator requests were billed to the wrong account.
//
// A billing redirect must never be a silent default. These are its falsifiers.

const ANTHROPIC = BUILTIN_UPSTREAMS.anthropic!;
const OAUTH = "Bearer sk-ant-oat-SUBSCRIPTION-TOKEN";
const METERED = "sk-ant-api03-METERED-KEY";

function headersFor(inbound: Headers, env: Record<string, string | undefined>): Headers {
  return rewriteHeaders(
    { upstream: "anthropic", model: "passthrough" } as never,
    inbound,
    env,
    { anthropic: ANTHROPIC } as never,
  );
}

test("the anthropic built-in declares NO envKey — passthrough cannot substitute", () => {
  // The root cause, pinned at the declaration site.
  expect(ANTHROPIC.auth).toEqual({ kind: "passthrough" });
  expect((ANTHROPIC.auth as { envKey?: string }).envKey).toBeUndefined();
});

test("the caller's subscription OAuth survives even when ANTHROPIC_API_KEY is set", () => {
  // THE REGRESSION. Before the fix this returned x-api-key=METERED and dropped the
  // Authorization header entirely — the subscription token never left the process.
  const inbound = new Headers({ authorization: OAUTH });
  const out = headersFor(inbound, { ANTHROPIC_API_KEY: METERED });

  expect(out.get("authorization")).toBe(OAUTH);
  expect(out.get("x-api-key")).toBeNull();
});

test("an inbound x-api-key is forwarded unchanged, not overwritten by the env", () => {
  const inbound = new Headers({ "x-api-key": "caller-supplied-key" });
  const out = headersFor(inbound, { ANTHROPIC_API_KEY: METERED });

  expect(out.get("x-api-key")).toBe("caller-supplied-key");
});

test("NO inbound credential sends NO credential — a loud 401, never a silent bill", () => {
  // The behaviour that makes the redirect impossible rather than merely unlikely.
  // A 200 here would mean modelmux paid for the request out of someone's key.
  const out = headersFor(new Headers(), { ANTHROPIC_API_KEY: METERED });

  expect(out.get("authorization")).toBeNull();
  expect(out.get("x-api-key")).toBeNull();
});

test("the metered key never appears in outbound headers under any inbound shape", () => {
  // Belt-and-braces sweep: whatever the caller sends, ANTHROPIC_API_KEY must not
  // leak into the request. Catches a future re-introduction on any header name.
  const shapes = [
    new Headers(),
    new Headers({ authorization: OAUTH }),
    new Headers({ "x-api-key": "caller-supplied-key" }),
    new Headers({ "authorization": OAUTH, "x-api-key": "caller-supplied-key" }),
  ];
  for (const inbound of shapes) {
    const out = headersFor(inbound, { ANTHROPIC_API_KEY: METERED });
    const values = [...out.values()];
    expect(values).not.toContain(METERED);
  }
});

test("explicit bearer auth STILL uses the env key (the opt-in path is intact)", () => {
  // The fix must not break the deliberate case: `auth = "bearer:ANTHROPIC_API_KEY"`
  // is how someone knowingly pays per token. Non-vacuity for the sweep above —
  // it proves the env key CAN reach a request when explicitly asked for.
  const explicit = { ...ANTHROPIC, auth: { kind: "bearer", envKey: "ANTHROPIC_API_KEY" } };
  const out = rewriteHeaders(
    { upstream: "anthropic", model: "passthrough" } as never,
    new Headers(),
    { ANTHROPIC_API_KEY: METERED },
    { anthropic: explicit } as never,
  );
  expect(out.get("authorization")).toBe(`Bearer ${METERED}`);
});
