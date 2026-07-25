import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { USAGE } from "../src/cli.ts";

// The README documents the CLI verbs. It used to TRANSCRIBE them — a claim about
// a system the document has no link to, which is correct right up until someone
// adds a verb and forgets. That is a carrier failure, not a diligence failure:
// the only thing standing between the doc and drift was a human remembering.
//
// This gives it a carrier. The verbs are EXTRACTED from src/cli.ts's USAGE (the
// same string the binary prints), never re-typed here, so adding a verb fails
// this test until README.md documents it.

function verbs(): string[] {
  return USAGE.split("|").map(s => s.trim().split(/\s+/)[0]).filter(Boolean) as string[];
}

const readme = readFileSync("README.md", "utf8");

test("the extraction itself works (non-vacuity: it must find verbs)", () => {
  // A verb list that came back empty would make every assertion below vacuously
  // true — the population floor, applied to a doc check.
  expect(verbs().length).toBeGreaterThanOrEqual(5);
  expect(verbs()).toContain("serve");
});

test("every CLI verb the binary advertises is documented in README.md", () => {
  const undocumented = verbs().filter(
    v => !new RegExp(`modelmux ${v}|mux ${v}|\`${v}\``).test(readme),
  );
  expect(undocumented).toEqual([]);
});

test("the check can actually fail (a verb that does not exist is not documented)", () => {
  // Negative control: proves the regex above discriminates rather than matching
  // anything, which would make the real assertion meaningless.
  expect(/modelmux notaverb|mux notaverb|`notaverb`/.test(readme)).toBe(false);
});

// ── the upstream link: USAGE must match the ACTUAL dispatch ──────────────────
//
// The chain is dispatch -> USAGE -> README. The test above derives README from
// USAGE. This one derives USAGE from the dispatch, so no link in the chain is a
// frozen transcription.
//
// Without it, USAGE is a hand-typed copy of a verb table that lives in TWO files
// (src/main.ts handles `serve`; src/cli.ts handles the rest). Add a branch to
// the if-chain and the binary accepts a verb it never advertises — and the
// README test still passes, because it only walks USAGE forward.

function handledVerbs(): string[] {
  const cli = readFileSync("src/cli.ts", "utf8");
  const main = readFileSync("src/main.ts", "utf8");
  const found = new Set<string>();
  for (const src of [cli, main]) {
    for (const m of src.matchAll(/cmd === "([a-z-]+)"/g)) found.add(m[1]!);
  }
  return [...found].sort();
}

test("the dispatch extraction works (non-vacuity)", () => {
  // An empty match set would make the comparison below vacuously pass.
  const h = handledVerbs();
  expect(h.length).toBeGreaterThanOrEqual(5);
  expect(h).toContain("serve"); // handled in main.ts, not cli.ts
});

test("USAGE advertises exactly the verbs the dispatch handles", () => {
  // Both directions: an advertised-but-unhandled verb is a lie to the user; a
  // handled-but-unadvertised verb is an undiscoverable feature, and is the one
  // that drifts silently when someone adds a branch.
  expect(handledVerbs()).toEqual(verbs().sort());
});
