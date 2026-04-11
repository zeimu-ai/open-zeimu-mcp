import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { buildGetLawResult, getLawInputSchema } from "../../../src/tools/get-law.js";
import { EgovRepository } from "../../../src/repository/egov-repository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../fixtures/egov");

const lawListFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, "law-list.json"), "utf-8"));
const lawDataFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, "law-data.json"), "utf-8"));

function makeFetch(lawListUrl: unknown, lawDataUrl: unknown) {
  return vi.fn(async (url: string) => {
    if (url.includes("/law_data/")) {
      return { ok: true, status: 200, json: async () => lawDataUrl };
    }
    if (url.includes("/laws?")) {
      return { ok: true, status: 200, json: async () => lawListUrl };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

describe("getLawInputSchema", () => {
  it("accepts valid input with law_name", () => {
    const result = getLawInputSchema.safeParse({ law_name: "印紙税法" });
    expect(result.success).toBe(true);
  });

  it("accepts input with optional article", () => {
    const result = getLawInputSchema.safeParse({ law_name: "印紙税法", article: "1" });
    expect(result.success).toBe(true);
  });

  it("defaults format to markdown", () => {
    const result = getLawInputSchema.safeParse({ law_name: "印紙税法" });
    expect(result.success && result.data.format).toBe("markdown");
  });

  it("rejects empty law_name", () => {
    const result = getLawInputSchema.safeParse({ law_name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts toc format", () => {
    const result = getLawInputSchema.safeParse({ law_name: "印紙税法", format: "toc" });
    expect(result.success).toBe(true);
  });
});

describe("buildGetLawResult", () => {
  it("returns law content with correct shape", async () => {
    const fetch = makeFetch(lawListFixture, lawDataFixture);
    const repo = new EgovRepository();

    const result = await buildGetLawResult({
      input: getLawInputSchema.parse({ law_name: "印紙税法" }),
      repo,
      fetch,
    });

    expect(result.source_type).toBe("law");
    expect(result.law_name).toBe("印紙税法");
    expect(result.canonical_url).toContain("342AC0000000023");
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
    expect(typeof result.retrieved_at).toBe("string");
  });

  it("article field is null when not specified", async () => {
    const fetch = makeFetch(lawListFixture, lawDataFixture);
    const repo = new EgovRepository();

    const result = await buildGetLawResult({
      input: getLawInputSchema.parse({ law_name: "印紙税法" }),
      repo,
      fetch,
    });

    expect(result.article).toBeNull();
  });

  it("article field reflects input when specified", async () => {
    const fetch = makeFetch(lawListFixture, lawDataFixture);
    const repo = new EgovRepository();

    const result = await buildGetLawResult({
      input: getLawInputSchema.parse({ law_name: "印紙税法", article: "1" }),
      repo,
      fetch,
    });

    expect(result.article).toBe("1");
  });

  it("toc format returns table of contents", async () => {
    const fetch = makeFetch(lawListFixture, lawDataFixture);
    const repo = new EgovRepository();

    const result = await buildGetLawResult({
      input: getLawInputSchema.parse({ law_name: "印紙税法", format: "toc" }),
      repo,
      fetch,
    });

    expect(result.content).toContain("第一条");
    expect(result.content.length).toBeGreaterThan(0);
  });

  it("throws when law_name not found in search results", async () => {
    const emptyList = { total_count: 0, offset: 0, limit: 10, laws: [] };
    const fetch = makeFetch(emptyList, lawDataFixture);
    const repo = new EgovRepository();

    await expect(
      buildGetLawResult({
        input: getLawInputSchema.parse({ law_name: "存在しない法令" }),
        repo,
        fetch,
      }),
    ).rejects.toThrow();
  });
});
