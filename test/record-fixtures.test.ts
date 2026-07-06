import { expect, test } from "bun:test";
import { redactHeaders } from "../scripts/record-fixtures.ts";

test("redactHeaders masks credential headers, keeps the rest", () => {
  const out = redactHeaders({
    "authorization": "Bearer real-oauth-token",
    "x-api-key": "sk-ant-real",
    "cookie": "session=secret",
    "anthropic-version": "2023-06-01",
    "x-app": "cli",
  });
  expect(out.authorization).toBe("REDACTED");
  expect(out["x-api-key"]).toBe("REDACTED");
  expect(out.cookie).toBe("REDACTED");
  expect(out["anthropic-version"]).toBe("2023-06-01");
  expect(out["x-app"]).toBe("cli");
});

test("redactHeaders leaves a credential-free header set untouched", () => {
  const input = { "anthropic-version": "2023-06-01", "x-app": "cli-bg" };
  expect(redactHeaders(input)).toEqual(input);
});
