import { mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { watchConfig } from "../src/config.ts";

// OQ-020. `watch(file)` follows the INODE, so a temp-file + rename() — what vim,
// VS Code and most safe-writing tooling do — leaves the watcher holding an
// unlinked inode. It then never fires again, silently, while the file on disk is
// correct and the process serves a stale config.
//
// Case 3 is the one that matters and the one a naive fix still fails: after a
// replace, does the watcher survive to see the NEXT edit? Measured on the live
// service before the fix, it did not — which is what proved the watcher was dead
// rather than merely stale.

function routes(alias: string): string {
  return `default = "${alias}"\n[models]\n${alias} = "anthropic:passthrough"\n`;
}

function setup(): { path: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "mux-watch-"));
  const path = join(dir, "routes.toml");
  writeFileSync(path, routes("first"));
  return { path, dir };
}

// Write THROUGH the existing inode (what `printf >>` and an in-place rewrite do).
function editInPlace(path: string, alias: string): void {
  writeFileSync(path, routes(alias), { flag: "r+" });
}

// Write a temp file and rename it over the target — what a safe-writing editor
// does, and the operation that killed the watcher.
function replaceAtomically(path: string, alias: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, routes(alias));
  renameSync(tmp, path);
}

async function settle(ms = 150): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

async function waitForDefault(holder: { current: { default: string } }, want: string, ms = 4000): Promise<string> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (holder.current.default === want)
      return holder.current.default;
    await new Promise(r => setTimeout(r, 20));
  }
  return holder.current.default;
}

test("CASE 1 — an IN-PLACE edit reloads (this always worked; it is the control)", async () => {
  const { path } = setup();
  const holder = watchConfig(path, {});
  // Arming an fs watch is ASYNCHRONOUS. Mutating immediately can beat the
  // registration and the event is simply never delivered — which looks exactly
  // like the defect under test. Settle first so a pass means the fix works and
  // a failure means the fix does not.
  await settle();
  try {
    expect(holder.current.default).toBe("first");
    editInPlace(path, "inplace");
    expect(await waitForDefault(holder, "inplace")).toBe("inplace");
  }
  finally { holder.close?.(); }
});

test("CASE 2 — an ATOMIC REPLACE reloads (this is the defect)", async () => {
  const { path } = setup();
  const holder = watchConfig(path, {});
  // Arming an fs watch is ASYNCHRONOUS. Mutating immediately can beat the
  // registration and the event is simply never delivered — which looks exactly
  // like the defect under test. Settle first so a pass means the fix works and
  // a failure means the fix does not.
  await settle();
  try {
    expect(holder.current.default).toBe("first");
    replaceAtomically(path, "replaced");
    expect(await waitForDefault(holder, "replaced")).toBe("replaced");
  }
  finally { holder.close?.(); }
});

test("CASE 3 — the watcher SURVIVES a replace and still sees the NEXT edit", async () => {
  const { path } = setup();
  const holder = watchConfig(path, {});
  // Arming an fs watch is ASYNCHRONOUS. Mutating immediately can beat the
  // registration and the event is simply never delivered — which looks exactly
  // like the defect under test. Settle first so a pass means the fix works and
  // a failure means the fix does not.
  await settle();
  try {
    replaceAtomically(path, "replaced");
    expect(await waitForDefault(holder, "replaced")).toBe("replaced");

    // The decisive assertion. A file-watcher is dead by now; a naive fix that only
    // re-establishes the watch once can also fail here.
    editInPlace(path, "after");
    expect(await waitForDefault(holder, "after")).toBe("after");

    // And it survives a SECOND replace too — one rename must not be a one-shot.
    replaceAtomically(path, "again");
    expect(await waitForDefault(holder, "again")).toBe("again");
  }
  finally { holder.close?.(); }
});

test("a SIBLING file's churn does not trigger a reload — the decision log lives beside routes.toml", async () => {
  const { path, dir } = setup();
  const holder = watchConfig(path, {});
  // Arming an fs watch is ASYNCHRONOUS. Mutating immediately can beat the
  // registration and the event is simply never delivered — which looks exactly
  // like the defect under test. Settle first so a pass means the fix works and
  // a failure means the fix does not.
  await settle();
  try {
    const log = join(dir, "decisions.jsonl");

    let reloads = 0;
    const orig = holder.current;
    // Appending to a sibling must not re-parse the config. Detect by identity:
    // a reload replaces the object.
    for (let i = 0; i < 20; i++)
      writeFileSync(log, `{"n":${i}}\n`, { flag: "a" });
    await new Promise(r => setTimeout(r, 400));
    if (holder.current !== orig)
      reloads++;
    expect(reloads).toBe(0);
  }
  finally { holder.close?.(); }
});

test("a BROKEN config keeps the previous one live rather than swapping in garbage", async () => {
  const { path } = setup();
  const holder = watchConfig(path, {});
  // Arming an fs watch is ASYNCHRONOUS. Mutating immediately can beat the
  // registration and the event is simply never delivered — which looks exactly
  // like the defect under test. Settle first so a pass means the fix works and
  // a failure means the fix does not.
  await settle();
  try {
    expect(holder.current.default).toBe("first");

    replaceAtomically(path, "good");
    expect(await waitForDefault(holder, "good")).toBe("good");

    writeFileSync(`${path}.tmp`, "this is not valid toml = = =\n");
    renameSync(`${path}.tmp`, path);
    await new Promise(r => setTimeout(r, 400));
    expect(holder.current.default).toBe("good");

    // ...and it RECOVERS once the file is valid again — a failed parse must not
    // poison the watcher any more than a rename does.
    replaceAtomically(path, "recovered");
    expect(await waitForDefault(holder, "recovered")).toBe("recovered");
  }
  finally { holder.close?.(); }
});
