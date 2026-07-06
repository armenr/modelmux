import { expect, test } from "bun:test";
import { analyzeModels, familyStem, fetchModelIds } from "../scripts/check-latest.ts";

test("familyStem strips version suffixes to a vendor stem", () => {
  expect(familyStem("z-ai/glm-5.2")).toBe("z-ai/glm");
  expect(familyStem("qwen/qwen3.7-max")).toBe("qwen/qwen");
});

test("analyzeModels marks present vs missing and suggests same-family ids", () => {
  const configured = [
    { alias: "flagship", slug: "z-ai/glm-5.2" },
    { alias: "cheap", slug: "deepseek/deepseek-v4-flash" },
  ];
  const live = ["z-ai/glm-5.2", "z-ai/glm-6", "deepseek/deepseek-v3"];
  const rows = analyzeModels(configured, live);

  const flagship = rows.find(r => r.alias === "flagship")!;
  expect(flagship.present).toBe(true);
  expect(flagship.candidates).toContain("z-ai/glm-6");

  const cheap = rows.find(r => r.alias === "cheap")!;
  expect(cheap.present).toBe(false);
  expect(cheap.candidates).toContain("deepseek/deepseek-v3");
});

test("fetchModelIds extracts string ids from the catalog payload", async () => {
  const fakeFetch = (async () => ({
    ok: true,
    json: async () => ({ data: [{ id: "a/b" }, { id: "c/d" }, { notid: 1 }] }),
  })) as unknown as typeof fetch;
  expect(await fetchModelIds(fakeFetch, "http://x")).toEqual(["a/b", "c/d"]);
});

test("fetchModelIds throws on a non-OK response", async () => {
  const fakeFetch = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
  await expect(fetchModelIds(fakeFetch, "http://x")).rejects.toThrow("HTTP 503");
});
