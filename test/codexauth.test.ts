import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { CodexAuthError, readCodexAuth } from "../src/upstreams.ts";

const TOKEN = "sk-secret-access-token-value";
const ACCOUNT = "11111111-2222-3333-4444-555555555555";

function codexHome(contents: unknown): string {
  const dir = join(mkdtempSync(join(tmpdir(), "mux-codex-")), ".codex");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), JSON.stringify(contents));
  return dir;
}

test("reads access_token + account_id from the Codex CLI's own file", () => {
  const dir = codexHome({ tokens: { access_token: TOKEN, account_id: ACCOUNT } });
  const creds = readCodexAuth(join(dir, "auth.json"), {});
  expect(creds.accessToken).toBe(TOKEN);
  expect(creds.accountId).toBe(ACCOUNT);
});

test("resolves under HOME with a platform-correct join, not a hardcoded slash", () => {
  const dir = codexHome({ tokens: { access_token: TOKEN, account_id: ACCOUNT } });
  const home = join(dir, ".."); // the fake home containing .codex/
  expect(readCodexAuth(undefined, { HOME: home }).accessToken).toBe(TOKEN);
});

test("honours CODEX_HOME over the home directory", () => {
  const dir = codexHome({ tokens: { access_token: TOKEN, account_id: ACCOUNT } });
  expect(readCodexAuth(undefined, { CODEX_HOME: dir, HOME: "/nonexistent-probe" }).accessToken).toBe(TOKEN);
});

test("falls back to USERPROFILE when HOME is unset (Windows)", () => {
  const dir = codexHome({ tokens: { access_token: TOKEN, account_id: ACCOUNT } });
  expect(readCodexAuth(undefined, { USERPROFILE: join(dir, "..") }).accessToken).toBe(TOKEN);
});

test("a missing file fails loud and names the fix", () => {
  expect(() => readCodexAuth("/nonexistent-probe/auth.json", {}))
    .toThrow(/codex login/);
});

test("a file with no account_id fails loud — dropping it yields a silent 401", () => {
  const dir = codexHome({ tokens: { access_token: TOKEN } });
  expect(() => readCodexAuth(join(dir, "auth.json"), {})).toThrow(CodexAuthError);
  expect(() => readCodexAuth(join(dir, "auth.json"), {})).toThrow(/account_id/);
});

test("NO error message ever contains the token value", () => {
  // Errors get logged and pasted into issues; a credential must not ride along.
  const cases: (() => unknown)[] = [
    () => readCodexAuth("/nonexistent-probe/auth.json", {}),
    () => readCodexAuth(join(codexHome({ tokens: { access_token: TOKEN } }), "auth.json"), {}),
    () => readCodexAuth(join(codexHome({ tokens: {} }), "auth.json"), {}),
    () => readCodexAuth(join(codexHome({ nope: 1 }), "auth.json"), {}),
  ];
  for (const fn of cases) {
    try {
      fn();
    }
    catch (e) {
      expect((e as Error).message).not.toContain(TOKEN);
    }
  }
});
