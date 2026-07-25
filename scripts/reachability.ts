// `bun run reachability` — the IMPL->WIRED oracle, with its denominator checked.
//
// knip answers "is every file reachable from a production entrypoint?" and exits
// 0 when it is. The problem is that it ALSO exits 0 when it scanned nothing:
// point `project` at a glob that matches no files and knip emits a hint and
// still returns 0. A clean run and an empty run are the same exit code and,
// on a healthy tree, the same (silent) output.
//
// So this wrapper adds the term knip cannot supply — the POPULATION it actually
// walked — and refuses to report success over an empty or implausibly small set.
// Three checks, in the order they fail:
//
//   1. PRINT THE MEASUREMENT, not the interpretation. It reports the file count
//      and the entrypoints, so a wrong denominator is visible rather than implied.
//   2. VERIFY THE INSTRUMENT. Every declared entrypoint must exist on disk — an
//      `entry` naming a file that was renamed away leaves knip walking from
//      nothing, which looks identical to a clean tree.
//   3. FLOOR THE POPULATION. Under FLOOR matched files, exit 2 (distinct from
//      knip's own 1) rather than pass. A verdict measured correctly over nothing
//      is the worst failure available, because every component is individually
//      correct and there is nothing in the output to distrust.
//
// Exit codes:  0 = reachable-clean over a verified population
//              1 = knip found unreachable files (a real finding)
//              2 = the check itself could not be trusted (empty/short population,
//                  or a missing entrypoint) — NOT a pass, NOT a knip finding.
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

interface KnipConfig { entry: string[]; project: string[] }

// Deliberately below the current count (~17) but far above zero: the floor is a
// "did the walk see the tree at all" guard, not a target to keep bumping.
const FLOOR = 10;

export function matchedFiles(patterns: string[]): string[] {
  const seen = new Set<string>();
  for (const p of patterns) {
    for (const f of new Bun.Glob(p).scanSync({ cwd: ".", onlyFiles: true }))
      seen.add(f);
  }
  return [...seen].sort();
}

export function missingEntries(entry: string[]): string[] {
  // An entry may be a literal path or a glob; a glob that matches nothing is as
  // broken as a literal that does not exist.
  return entry.filter(e =>
    (/[*?[\]{}]/.test(e) ? matchedFiles([e]).length === 0 : !existsSync(e)),
  );
}

export async function run(configPath = "knip.json"): Promise<number> {
  const cfg = JSON.parse(readFileSync(configPath, "utf8")) as KnipConfig;

  const missing = missingEntries(cfg.entry);
  if (missing.length > 0) {
    console.error(`reachability: ENTRYPOINT MISSING -> ${missing.join(", ")}`);
    console.error("reachability: knip would walk from nothing and still exit 0. Refusing to report a result.");
    return 2;
  }

  const files = matchedFiles(cfg.project);
  console.log(`reachability: population ${files.length} file(s) under ${cfg.project.length} project pattern(s); entrypoints: ${cfg.entry.join(", ")}`);
  if (files.length < FLOOR) {
    console.error(`reachability: POPULATION FLOOR -> ${files.length} < ${FLOOR}. The walk did not see the tree; a clean result here would be meaningless.`);
    return 2;
  }

  const proc = Bun.spawnSync(["./node_modules/.bin/knip", "--include", "files"], { stdout: "inherit", stderr: "inherit" });
  if (proc.exitCode !== 0) {
    console.error(`reachability: knip reported unreachable file(s) (exit ${proc.exitCode}).`);
    return 1;
  }
  console.log(`reachability: OK — ${files.length} file(s) walked, all reachable from a production entrypoint.`);
  return 0;
}

if (import.meta.main)
  process.exit(await run());
