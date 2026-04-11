import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { buildSearchLawResult, searchLawInputSchema } from "../../../src/tools/search-law.js";
import { EgovRepository } from "../../../src/repository/egov-repository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../fixtures/egov");

const lawListFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, "law-list.json"), "utf-8"));

function makeFetch(response: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => response,
  }));
}

describe("searchLawInputSchema", () => {
  it("accepts valid query", () => {
    const result = searchLawInputSchema.safeParse({ query: "印紙税" });
    expect(result.success).toBe(true);
  });

  it("defaults limit to 10", () => {
    const result = searchLawInputSchema.safeParse({ query: "印紙税" });
    expect(result.success && result.data.limit).toBe(10);
  });

  it("rejects limit greater than 20", () => {
    const result = searchLawInputSchema.safeParse({ query: "印紙税", limit: 21 });
    expect(result.success).toBe(false);
  });

  it("rejects empty query", () => {
    const result = searchLawInputSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional law_type filter", () => {
    const result = searchLawInputSchema.safeParse({ query: "印紙税", law_type: "Act" });
    expect(result.success).toBe(true);
  });
});

describe("buildSearchLawResult", () => {
  it("returns search results with correct shape", async () => {
    const fetch = makeFetch(lawListFixture);
    const repo = new EgovRepository();

    const result = await buildSearchLawResult({
      input: searchLawInputSchema.parse({ query: "印紙税" }),
      repo,
      fetch,
    });

    expect(result.source_type).toBe("law");
    expect(result.query).toBe("印紙税");
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.total_count).toBe(1);
  });

  it("each result has required fields", async () => {
    const fetch = makeFetch(lawListFixture);
    const repo = new EgovRepository();

    const result = await buildSearchLawResult({
      input: searchLawInputSchema.parse({ query: "印紙税" }),
      repo,
      fetch,
    });

    const item = result.results[0];
    expect(item.law_id).toBe("342AC0000000023");
    expect(item.law_name).toBe("印紙税法");
    expect(item.law_num).toBe("昭和四十二年法律第二十三号");
    expect(item.canonical_url).toContain("342AC0000000023");
    expect(typeof item.promulgation_date).toBe("string");
  });

  it("returns empty results when no laws found", async () => {
    const emptyResponse = { total_count: 0, offset: 0, limit: 10, laws: [] };
    const fetch = makeFetch(emptyResponse);
    const repo = new EgovRepository();

    const result = await buildSearchLawResult({
      input: searchLawInputSchema.parse({ query: "存在しないキーワード" }),
      repo,
      fetch,
    });

    expect(result.results).toHaveLength(0);
    expect(result.total_count).toBe(0);
  });

  it("respects limit parameter", async () => {
    const fetch = makeFetch(lawListFixture);
    const repo = new EgovRepository();

    const result = await buildSearchLawResult({
      input: searchLawInputSchema.parse({ query: "印紙税", limit: 5 }),
      repo,
      fetch,
    });

    // fetch was called with limit=5 in query params
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("limit=5");
    expect(result.results.length).toBeLessThanOrEqual(5);
  });
});
