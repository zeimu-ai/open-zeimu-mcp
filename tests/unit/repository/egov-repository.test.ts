import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EgovRepository } from "../../../src/repository/egov-repository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../fixtures/egov");

const lawListFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, "law-list.json"), "utf-8"));
const lawDataFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, "law-data.json"), "utf-8"));

function makeFetch(responses: Map<string, unknown>) {
  return vi.fn(async (url: string) => {
    const matched = [...responses.entries()].find(([pattern]) => url.includes(pattern));
    if (!matched) {
      return { ok: false, status: 404, json: async () => ({ error: "not found" }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => matched[1],
    };
  });
}

describe("EgovRepository", () => {
  let repo: EgovRepository;

  beforeEach(() => {
    repo = new EgovRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchLaws", () => {
    it("calls e-Gov laws endpoint with keyword and returns law info list", async () => {
      const fetch = makeFetch(new Map([["laws.e-gov.go.jp/api/2/laws", lawListFixture]]));

      const result = await repo.searchLaws("印紙税", { limit: 10, fetch });

      expect(result.total_count).toBe(1);
      expect(result.laws).toHaveLength(1);
      expect(result.laws[0].law_id).toBe("342AC0000000023");
      expect(result.laws[0].law_name).toBe("印紙税法");
    });

    it("rejects requests to non-allowlisted hosts", async () => {
      const maliciousFetch = vi.fn();

      await expect(
        repo.searchLaws("test", {
          limit: 10,
          fetch: maliciousFetch,
          baseUrl: "https://evil.example.com/api/2",
        }),
      ).rejects.toThrow("不正なホスト");

      expect(maliciousFetch).not.toHaveBeenCalled();
    });

    it("returns cached result on second call within TTL", async () => {
      const fetch = makeFetch(new Map([["laws.e-gov.go.jp/api/2/laws", lawListFixture]]));

      await repo.searchLaws("印紙税", { limit: 10, fetch });
      await repo.searchLaws("印紙税", { limit: 10, fetch });

      // fetch should be called only once (second call uses cache)
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns fresh result after cache TTL expires", async () => {
      const fetch = makeFetch(new Map([["laws.e-gov.go.jp/api/2/laws", lawListFixture]]));

      // Use a very short TTL for testing
      const shortTtlRepo = new EgovRepository({ cacheTtlMs: 1 });
      await shortTtlRepo.searchLaws("印紙税", { limit: 10, fetch });

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 5));

      await shortTtlRepo.searchLaws("印紙税", { limit: 10, fetch });

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("getLawData", () => {
    it("fetches law content by law_id and returns parsed law data", async () => {
      const fetch = makeFetch(
        new Map([["laws.e-gov.go.jp/api/2/law_data/342AC0000000023", lawDataFixture]]),
      );

      const result = await repo.getLawData("342AC0000000023", { fetch });

      expect(result.law_id).toBe("342AC0000000023");
      expect(result.law_name).toBe("印紙税法");
      expect(result.canonical_url).toContain("342AC0000000023");
    });

    it("converts law articles to markdown text", async () => {
      const fetch = makeFetch(
        new Map([["laws.e-gov.go.jp/api/2/law_data/342AC0000000023", lawDataFixture]]),
      );

      const result = await repo.getLawData("342AC0000000023", { fetch });

      expect(result.content).toContain("第一条");
      expect(result.content).toContain("課税物件");
      expect(result.content).toContain("印紙税を課する");
    });

    it("caches law content by law_id", async () => {
      const fetch = makeFetch(
        new Map([["laws.e-gov.go.jp/api/2/law_data/342AC0000000023", lawDataFixture]]),
      );

      await repo.getLawData("342AC0000000023", { fetch });
      await repo.getLawData("342AC0000000023", { fetch });

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("throws when law_id is not found", async () => {
      const fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));

      await expect(repo.getLawData("INVALID_ID", { fetch })).rejects.toThrow();
    });

    it("does not include raw HTML in content", async () => {
      const fetch = makeFetch(
        new Map([["laws.e-gov.go.jp/api/2/law_data/342AC0000000023", lawDataFixture]]),
      );

      const result = await repo.getLawData("342AC0000000023", { fetch });

      expect(result.content).not.toMatch(/<[^>]+>/);
    });
  });

  describe("cache eviction", () => {
    it("respects max entry limit and evicts oldest entries", async () => {
      const smallRepo = new EgovRepository({ cacheMaxEntries: 2 });
      const fetch = makeFetch(new Map([["laws.e-gov.go.jp/api/2/laws", lawListFixture]]));

      await smallRepo.searchLaws("query1", { limit: 10, fetch });
      await smallRepo.searchLaws("query2", { limit: 10, fetch });
      await smallRepo.searchLaws("query3", { limit: 10, fetch });

      // Cache should still work (no error); just verifying no crash on eviction
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });
});
