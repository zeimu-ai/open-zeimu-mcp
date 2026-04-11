import { describe, expect, it } from "vitest";

import {
  buildLexicalSearchResult,
  lexicalSearchInputSchema,
  lexicalSearchOutputSchema,
} from "../../../src/tools/lexical-search.js";

describe("lexical-search tool", () => {
  it("applies defaults and validates limit bounds", () => {
    expect(lexicalSearchInputSchema.parse({ query: "基礎控除" })).toEqual({
      query: "基礎控除",
      limit: 20,
    });

    expect(() =>
      lexicalSearchInputSchema.parse({ query: "基礎控除", limit: 51 }),
    ).toThrow(/50/);
  });

  it("returns output compatible with schema", () => {
    const result = buildLexicalSearchResult({
      hits: [
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
          score: 42,
          snippet: "所得税の基礎控除は、一定額を所得から差し引く制度です。",
        },
      ],
    });

    expect(lexicalSearchOutputSchema.parse(result)).toEqual(result);
  });
});
