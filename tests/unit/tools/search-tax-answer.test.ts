import { describe, expect, it } from "vitest";

import { buildSearchTaxAnswerResult } from "../../../src/tools/search-tax-answer.js";
import type { LexicalIndex } from "../../../src/search/lexical-index.js";

const lexicalIndex: LexicalIndex = {
  size: 2,
  builtAt: "2026-04-12T00:00:00.000Z",
  search({ query, sourceTypes, limit }) {
    expect(query).toBe("基礎控除");
    expect(sourceTypes).toEqual(["tax_answer"]);
    expect(limit).toBe(5);

    return {
      hits: [
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
          score: 42.1,
          snippet: "所得税の基礎控除は、一定額を所得から差し引く制度です。",
        },
      ],
    };
  },
};

describe("buildSearchTaxAnswerResult", () => {
  it("forces tax_answer source filtering and returns total_count", () => {
    const result = buildSearchTaxAnswerResult({
      lexicalIndex,
      input: {
        query: "基礎控除",
        limit: 5,
      },
    });

    expect(result).toEqual({
      source_type: "tax_answer",
      query: "基礎控除",
      total_count: 1,
      results: [
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
          score: 42.1,
          snippet: "所得税の基礎控除は、一定額を所得から差し引く制度です。",
        },
      ],
    });
  });
});
