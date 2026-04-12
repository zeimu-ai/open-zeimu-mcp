import { describe, expect, it } from "vitest";

import type { LexicalIndex } from "../../../src/search/lexical-index.js";
import type { SemanticSearchEngine } from "../../../src/search/semantic-engine.js";
import { buildSearchSaiketsuResult } from "../../../src/tools/search-saiketsu.js";

const lexicalIndex: LexicalIndex = {
  size: 5,
  builtAt: "2026-04-12T00:00:00.000Z",
  search({ query, sourceTypes, category, limit }) {
    expect(query).toBe("立退料");
    expect(sourceTypes).toEqual(["saiketsu"]);
    expect(category).toBe("shotoku");
    expect(limit).toBe(5);

    return {
      hits: [
        {
          id: "sai-001",
          source_type: "saiketsu",
          title: "立退料の所得区分に関する裁決事例",
          score: 28.1,
          snippet: "立退料が譲渡所得に該当するかを判断した裁決事例です。",
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

describe("buildSearchSaiketsuResult", () => {
  it("forces saiketsu filtering and returns enriched results", async () => {
    const result = await buildSearchSaiketsuResult({
      lexicalIndex,
      semanticEngine,
      documents: [
        {
          id: "sai-001",
          sourceType: "saiketsu",
          title: "立退料の所得区分に関する裁決事例",
          category: "shotoku",
          canonicalUrl: "https://www.kfs.go.jp/service/JP/139/01/index.html",
          path: "/tmp/data/saiketsu/001/001.md",
          metadataPath: "/tmp/data/saiketsu/001/001.meta.json",
          body: "立退料が譲渡所得に該当するかを判断した裁決事例です。",
          headings: ["立退料の所得区分に関する裁決事例"],
          aliases: ["立退料裁決"],
          metadata: {
            citation: "裁決事例集139-01",
          },
          crawledAt: "2026-04-12T01:00:00Z",
          updatedAt: "2026-03-31",
          publishedAt: "2026-01-15",
          contentHash: "hash-001",
          license: "public_data",
          version: 1,
          pageOffsets: [],
          pageCount: 0,
        },
      ],
      input: {
        query: "立退料",
        category: "shotoku",
        limit: 5,
        search_mode: "lexical",
      },
    });

    expect(result).toEqual({
      source_type: "saiketsu",
      query: "立退料",
      total_count: 1,
      results: [
        {
          id: "sai-001",
          source_type: "saiketsu",
          title: "立退料の所得区分に関する裁決事例",
          category: "shotoku",
          canonical_url: "https://www.kfs.go.jp/service/JP/139/01/index.html",
          citation: "裁決事例集139-01",
          score: 28.1,
          snippet: "立退料が譲渡所得に該当するかを判断した裁決事例です。",
          updated_at: "2026-03-31",
          license: "public_data",
        },
      ],
    });
  });
});
