import { describe, expect, it } from "vitest";

import type { LexicalIndex } from "../../../src/search/lexical-index.js";
import type { SemanticSearchEngine } from "../../../src/search/semantic-engine.js";
import { buildSearchWrittenAnswerResult } from "../../../src/tools/search-written-answer.js";

const lexicalIndex: LexicalIndex = {
  size: 2,
  builtAt: "2026-04-12T00:00:00.000Z",
  search({ query, sourceTypes, category, limit }) {
    expect(query).toBe("第2ページ");
    expect(sourceTypes).toEqual(["written_answer"]);
    expect(category).toBe("hyoka");
    expect(limit).toBe(5);

    return {
      hits: [
        {
          id: "202401",
          source_type: "written_answer",
          title: "非上場株式の評価に関する文書回答事例",
          score: 39.8,
          snippet: "第2ページ本文です。",
          match_offset: 12,
        },
      ],
    };
  },
};

const semanticEngine: SemanticSearchEngine = {
  backend: "none",
  ready: false,
  reason: "backend_disabled",
  runtime_available: false,
  vectors_loaded: false,
  chunk_count: 0,
  total_bytes: 0,
  loaded_sources: [],
  async search() {
    return [];
  },
};

describe("buildSearchWrittenAnswerResult", () => {
  it("forces written_answer filtering and derives page hints", async () => {
    const result = await buildSearchWrittenAnswerResult({
      lexicalIndex,
      semanticEngine,
      documents: [
        {
          id: "202401",
          sourceType: "written_answer",
          title: "非上場株式の評価に関する文書回答事例",
          category: "hyoka",
          canonicalUrl: "https://www.nta.go.jp/law/bunshokaito/hyoka/240101/01.htm",
          path: "/tmp/data/written_answer/202401/202401.md",
          metadataPath: "/tmp/data/written_answer/202401/202401.meta.json",
          body: "第1ページ本文です。\n\n第2ページ本文です。",
          headings: ["非上場株式の評価に関する文書回答事例"],
          aliases: [],
          metadata: {
            citation: "文書回答事例 202401",
          },
          crawledAt: "2026-04-11T19:00:00Z",
          updatedAt: "2026-04-01",
          publishedAt: "2026-01-01",
          contentHash: "hash-202401",
          license: "public_data",
          version: 4,
          pageOffsets: [0, 12],
          pageCount: 2,
        },
      ],
      input: {
        query: "第2ページ",
        category: "hyoka",
        limit: 5,
        search_mode: "lexical",
      },
    });

    expect(result).toEqual({
      source_type: "written_answer",
      query: "第2ページ",
      total_count: 1,
      results: [
        {
          id: "202401",
          source_type: "written_answer",
          title: "非上場株式の評価に関する文書回答事例",
          category: "hyoka",
          canonical_url: "https://www.nta.go.jp/law/bunshokaito/hyoka/240101/01.htm",
          citation: "文書回答事例 202401",
          score: 39.8,
          snippet: "第2ページ本文です。",
          updated_at: "2026-04-01",
          license: "public_data",
          page_hint: "p.2",
        },
      ],
    });
  });
});
