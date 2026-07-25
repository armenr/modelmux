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
