import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";

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
