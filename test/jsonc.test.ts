import { expect, test } from "bun:test";
import { parseJsonc } from "../src/jsonc.ts";

test("strips line and block comments and trailing commas", () => {
  const text = `{
    // a line comment
    "a": 1, /* inline */ "b": "x",
    "c": [1, 2,], // trailing comma in array
  }`;
  expect(parseJsonc(text)).toEqual({ a: 1, b: "x", c: [1, 2] });
});

test("does not corrupt // inside strings", () => {
  expect(parseJsonc("{\"url\":\"https://openrouter.ai/api\"}")).toEqual({
    url: "https://openrouter.ai/api",
  });
});

test("does not corrupt comma-brace sequences inside strings", () => {
  expect(parseJsonc("{\"a\":\",]\"}")).toEqual({ a: ",]" });
  expect(parseJsonc("{\"a\":\"x, ]\"}")).toEqual({ a: "x, ]" });
});
