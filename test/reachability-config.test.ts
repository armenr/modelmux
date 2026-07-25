import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { matchedFiles, missingEntries } from "../scripts/reachability.ts";

// The reachability oracle (`bun run reachability`) answers IMPL->WIRED: is this
// file reachable from a REAL production entrypoint? It is only meaningful while
// test files are NOT entrypoints.
//
// DERIVED, not assumed (2026-07-25). Planting a module imported ONLY by a test:
//   tests NOT in `entry` -> flagged unused, knip exits 1
//   tests IN  `entry`    -> the same orphan goes silent, knip exits 0
// Every src/*.ts here has a test importing it, so admitting tests as entrypoints
// makes the whole tree look reachable and the oracle reports clean forever —
// coverage-shaped output that checks nothing.
//
// This test is the standing guard on that. It fails loudly if someone widens
// `entry` to include tests, which is the single edit that silently disarms the
// oracle without changing its exit code on a healthy tree.

const config = JSON.parse(readFileSync("knip.json", "utf8")) as {
  entry: string[];
  project: string[];
};

test("the reachability oracle does not admit test files as entrypoints", () => {
  const testish = config.entry.filter(e => /(?:^|\/)test\//.test(e) || /\.(?:test|spec)\./.test(e));
  expect(testish).toEqual([]);
});

test("the reachability oracle still names the real production entrypoints", () => {
  // The mirror failure: an `entry` list that is empty or wrong reports a clean
  // tree for the opposite reason — nothing to walk from.
  expect(config.entry).toContain("src/main.ts");
  expect(config.entry.length).toBeGreaterThan(0);
  expect(config.project.some(p => p.startsWith("src/"))).toBe(true);
});

// ── the wrapper's own guards (scripts/reachability.ts) ───────────────────────
//
// knip exits 0 whether it found nothing wrong OR walked nothing at all — a clean
// run and an empty run are the same exit code and the same silent output. These
// guard the two terms knip cannot supply: does the population exist, and do the
// declared entrypoints exist.

test("missingEntries catches an entrypoint that no longer exists", () => {
  expect(missingEntries(["src/main.ts"])).toEqual([]);
  expect(missingEntries(["src/main.ts", "src/DEFINITELY_GONE.ts"])).toEqual(["src/DEFINITELY_GONE.ts"]);
  // a GLOB that matches nothing is as broken as a missing literal — knip would
  // walk from nothing and still report success
  expect(missingEntries(["nonexistent/**/*.ts"])).toEqual(["nonexistent/**/*.ts"]);
});

test("matchedFiles reports the real population, and zero for a dead glob", () => {
  expect(matchedFiles(["nonexistent/**/*.ts"])).toEqual([]);
  const real = matchedFiles(config.project);
  expect(real.length).toBeGreaterThan(10); // the floor the wrapper enforces
  expect(real).toContain("src/main.ts");
});

test("every declared entrypoint actually exists on disk", () => {
  // The live version of the check — this is what fails if someone renames an
  // entrypoint and forgets knip.json.
  expect(missingEntries(config.entry)).toEqual([]);
});
