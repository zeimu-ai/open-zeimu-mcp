import { describe, expect, it } from "vitest";

import type { LexicalIndex } from "../../../src/search/lexical-index.js";
import { buildSearchTsutatsuResult } from "../../../src/tools/search-tsutatsu.js";

const lexicalIndex: LexicalIndex = {
  size: 4,
  builtAt: "2026-04-12T00:00:00.000Z",
  search({ query, sourceTypes, limit }) {
    expect(query).toBe("仕入税額控除");
    expect(sourceTypes).toEqual(["tsutatsu"]);
    expect(limit).toBe(5);

    return {
      hits: [
        {
          id: "tsu-001",
          source_type: "tsutatsu",
          title: "消費税の仕入税額控除に関する通達",
          score: 25.5,
          snippet: "適格請求書等保存方式における仕入税額控除の考え方を整理した通達です。",
        },
      ],
    };
  },
};

describe("buildSearchTsutatsuResult", () => {
  it("forces tsutatsu filtering and returns enriched results", () => {
    const result = buildSearchTsutatsuResult({
      lexicalIndex,
      documents: [
        {
          id: "tsu-001",
          sourceType: "tsutatsu",
          title: "消費税の仕入税額控除に関する通達",
          category: "shohi",
          canonicalUrl: "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/001.htm",
          path: "/tmp/data/tsutatsu/001/001.md",
          metadataPath: "/tmp/data/tsutatsu/001/001.meta.json",
          body: "適格請求書等保存方式における仕入税額控除の考え方を整理した通達です。",
          headings: ["消費税の仕入税額控除に関する通達"],
          aliases: ["仕入税額控除通達"],
          metadata: {
            citation: "消費税基本通達11-6-1",
          },
          crawledAt: "2026-04-12T00:10:00Z",
          updatedAt: null,
          publishedAt: null,
          contentHash: "hash-001",
          license: "public_data",
          version: 1,
          pageOffsets: [],
          pageCount: 0,
        },
      ],
      input: {
        query: "仕入税額控除",
        limit: 5,
      },
    });

    expect(result).toEqual({
      source_type: "tsutatsu",
      query: "仕入税額控除",
      total_count: 1,
      results: [
        {
          id: "tsu-001",
          source_type: "tsutatsu",
          title: "消費税の仕入税額控除に関する通達",
          category: "shohi",
          canonical_url: "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/001.htm",
          citation: "消費税基本通達11-6-1",
          score: 25.5,
          snippet: "適格請求書等保存方式における仕入税額控除の考え方を整理した通達です。",
          updated_at: null,
          license: "public_data",
        },
      ],
    });
  });
});
