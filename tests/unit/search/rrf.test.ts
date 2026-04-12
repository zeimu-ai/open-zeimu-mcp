import { describe, expect, it } from "vitest";

import { reciprocalRankFusion } from "../../../src/search/rrf.js";

describe("reciprocalRankFusion", () => {
  it("merges lexical and semantic rankings by document id", () => {
    const results = reciprocalRankFusion({
      lexicalHits: [
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
          score: 10,
          snippet: "lexical snippet",
        },
        {
          id: "2200",
          source_type: "tax_answer",
          title: "配偶者控除",
          score: 9,
          snippet: "lexical second",
        },
      ],
      semanticHits: [
        {
          id: "2200",
          source_type: "tax_answer",
          title: "配偶者控除",
          score: 0.99,
          snippet: "semantic first",
          match_offset: 12,
        },
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
          score: 0.95,
          snippet: "semantic second",
        },
      ],
      limit: 5,
      k: 60,
    });

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(
      expect.objectContaining({
        id: "2200",
        source_type: "tax_answer",
        snippet: "lexical second",
      }),
    );
    expect(results).toContainEqual(
      expect.objectContaining({
        id: "1200",
        source_type: "tax_answer",
        snippet: "lexical snippet",
      }),
    );
  });

  it("falls back to semantic snippet when lexical side is absent", () => {
    const results = reciprocalRankFusion({
      lexicalHits: [],
      semanticHits: [
        {
          id: "qa-001",
          source_type: "qa_case",
          title: "交際費の判定に関する質疑応答事例",
          score: 0.91,
          snippet: "semantic snippet",
          match_offset: 24,
        },
      ],
      limit: 5,
    });

    expect(results).toEqual([
      {
        id: "qa-001",
        source_type: "qa_case",
        title: "交際費の判定に関する質疑応答事例",
        score: expect.any(Number),
        snippet: "semantic snippet",
        match_offset: 24,
      },
    ]);
  });
});
