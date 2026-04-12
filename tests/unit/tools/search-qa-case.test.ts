import { describe, expect, it } from "vitest";

import type { LexicalIndex } from "../../../src/search/lexical-index.js";
import { buildSearchQaCaseResult } from "../../../src/tools/search-qa-case.js";

const lexicalIndex: LexicalIndex = {
  size: 4,
  builtAt: "2026-04-12T00:00:00.000Z",
  search({ query, sourceTypes, category, limit }) {
    expect(query).toBe("交際費");
    expect(sourceTypes).toEqual(["qa_case"]);
    expect(category).toBe("hojin");
    expect(limit).toBe(5);

    return {
      hits: [
        {
          id: "qa-001",
          source_type: "qa_case",
          title: "交際費の判定に関する質疑応答事例",
          score: 24.7,
          snippet: "得意先に対する飲食費が交際費等に該当するかを解説する質疑応答事例です。",
        },
      ],
    };
  },
};

describe("buildSearchQaCaseResult", () => {
  it("forces qa_case filtering and returns enriched results", () => {
    const result = buildSearchQaCaseResult({
      lexicalIndex,
      documents: [
        {
          id: "qa-001",
          sourceType: "qa_case",
          title: "交際費の判定に関する質疑応答事例",
          category: "hojin",
          canonicalUrl: "https://www.nta.go.jp/law/shitsugi/hojin/001.htm",
          path: "/tmp/data/qa_case/001/001.md",
          metadataPath: "/tmp/data/qa_case/001/001.meta.json",
          body: "得意先に対する飲食費が交際費等に該当するかを解説する質疑応答事例です。",
          headings: ["交際費の判定に関する質疑応答事例"],
          aliases: ["交際費Q&A"],
          metadata: {
            citation: "質疑応答事例 法人税 交際費",
          },
          crawledAt: "2026-04-12T00:20:00Z",
          updatedAt: null,
          publishedAt: null,
          contentHash: "hash-qa-001",
          license: "public_data",
          version: 1,
          pageOffsets: [],
          pageCount: 0,
        },
      ],
      input: {
        query: "交際費",
        category: "hojin",
        limit: 5,
      },
    });

    expect(result).toEqual({
      source_type: "qa_case",
      query: "交際費",
      total_count: 1,
      results: [
        {
          id: "qa-001",
          source_type: "qa_case",
          title: "交際費の判定に関する質疑応答事例",
          category: "hojin",
          canonical_url: "https://www.nta.go.jp/law/shitsugi/hojin/001.htm",
          citation: "質疑応答事例 法人税 交際費",
          score: 24.7,
          snippet: "得意先に対する飲食費が交際費等に該当するかを解説する質疑応答事例です。",
          updated_at: null,
          license: "public_data",
        },
      ],
    });
  });
});
