import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { CONFIG_VERBS, needsConfig, runCli, USAGE, VERSION } from "../src/cli.ts";

// `modelmux --version` used to print the usage banner and EXIT 0. Two defects in
// one line: there was no way to learn which version you had installed, and an
// unrecognised command reported SUCCESS — so a typo in a script exited clean and
// the script carried on as though the command had run. Silent success is the
// failure mode this repo keeps paying for; these are its falsifiers.

/** Run a verb, capturing stdout/stderr so an assertion can read what it printed. */
async function capture(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const log = console.log;
  const error = console.error;
  let out = "";
  let err = "";
  console.log = (...a: unknown[]) => {
    out += `${a.join(" ")}\n`;
  };
  console.error = (...a: unknown[]) => {
    err += `${a.join(" ")}\n`;
  };
  try {
    return { code: await runCli(argv), out, err };
  }
  finally {
    console.log = log;
    console.error = error;
  }
}

// ── the version is REPORTED, and reported from the single source ─────────────

test("VERSION is derived from package.json, not transcribed", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  expect(VERSION).toBe(pkg.version);
});

test("VERSION is non-empty and semver-shaped (non-vacuity)", () => {
  // A VERSION that came back "" would make the equality above pass against an
  // equally-empty package.json field while telling a user nothing.
  expect(VERSION.length).toBeGreaterThan(0);
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});

test.each([["version"], ["--version"], ["-v"]])(
  "`%s` prints the version and exits 0",
  async (verb) => {
    const { code, out } = await capture([verb]);
    expect(code).toBe(0);
    expect(out.trim()).toBe(VERSION);
  },
);

// ── an unrecognised command FAILS, and says so in the exit code ──────────────

test.each([["bogus"], ["--nope"], ["chek-latest"]])(
  "unrecognised command `%s` exits NON-ZERO",
  async (verb) => {
    const { code } = await capture([verb]);
    expect(code).toBe(1);
  },
);

test("an unrecognised command names itself and goes to stderr, not stdout", async () => {
  const { out, err } = await capture(["bogus"]);
  expect(err).toContain("bogus");
  expect(err).toContain(USAGE);
  expect(out).toBe(""); // a diagnostic on stdout would corrupt a piped `models` consumer
});

// ── explicit help and bare invocation are SUCCESS, not failure ───────────────

test.each([["help"], ["--help"], ["-h"]])(
  "`%s` prints usage and exits 0 (asking for help is not an error)",
  async (verb) => {
    const { code, out } = await capture([verb]);
    expect(code).toBe(0);
    expect(out).toContain(USAGE);
  },
);

test("bare invocation prints usage on stdout and exits 0", async () => {
  const { code, out, err } = await capture([]);
  expect(code).toBe(0);
  expect(out).toContain(USAGE);
  expect(err).toBe("");
});

// ── which invocations may bootstrap a routes.toml ────────────────────────────
//
// main.ts writes a default routes.toml when one is missing. That is correct for
// the verbs that go on to READ it and wrong for the ones that do not: asking the
// binary its version, or fat-fingering a verb, should not litter the cwd. This
// was found by running the COMPILED binary — every unit test was green while the
// real binary still wrote the file.

test("CONFIG_VERBS is derived from USAGE, not transcribed (non-vacuity)", () => {
  // An empty set would make every needsConfig() assertion below vacuously false.
  expect(CONFIG_VERBS.size).toBeGreaterThanOrEqual(5);
  expect([...CONFIG_VERBS].sort()).toEqual(
    USAGE.split("|")
      .map(s => s.trim().split(/\s+/)[0]!)
      .filter(v => v !== "version" && v !== "help")
      .sort(),
  );
});

test.each([[undefined], [""], ["serve"], ["models"], ["set"], ["check-latest"]])(
  "needsConfig(%p) is true — it reads the config",
  (verb) => {
    expect(needsConfig(verb as string | undefined)).toBe(true);
  },
);

test.each([["version"], ["--version"], ["-v"], ["help"], ["--help"], ["-h"], ["bogus"], ["--nope"]])(
  "needsConfig(%p) is FALSE — self-answering or unrecognised, so no routes.toml",
  (verb) => {
    expect(needsConfig(verb)).toBe(false);
  },
);
