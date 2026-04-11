import { describe, expect, it } from "vitest";

import { buildGetTaxAnswerResult } from "../../../src/tools/get-tax-answer.js";
import type { LoadedDocument } from "../../../src/types/index.js";

const taxAnswerDocument: LoadedDocument = {
  id: "1200",
  sourceType: "tax_answer",
  title: "所得税の基礎控除",
  category: "所得税",
  canonicalUrl: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm",
  path: "/tmp/data/tax_answer/1200/1200.md",
  metadataPath: "/tmp/data/tax_answer/1200/1200.meta.json",
  body: "所得税の基礎控除は、一定額を所得から差し引く制度です。",
  headings: ["所得税の基礎控除", "概要"],
  aliases: ["基礎控除"],
  metadata: {
    citation: "タックスアンサーNo.1200",
    section: "shotoku",
    tags: ["所得税", "控除"],
  },
  crawledAt: "2026-04-11T19:00:00Z",
  updatedAt: "2026-04-01",
  publishedAt: "2026-01-01",
  contentHash: "hash-1200",
  license: "CC-BY-4.0",
  version: 1,
  pageOffsets: [],
  pageCount: 0,
};

describe("buildGetTaxAnswerResult", () => {
  it("returns a tax answer document by id", async () => {
    const result = await buildGetTaxAnswerResult({
      input: { id: "1200" },
      documents: [taxAnswerDocument],
    });

    expect(result).toEqual({
      source_type: "tax_answer",
      id: "1200",
      title: "所得税の基礎控除",
      category: "所得税",
      canonical_url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm",
      citation: "タックスアンサーNo.1200",
      content: "所得税の基礎控除は、一定額を所得から差し引く制度です。",
      headings: ["所得税の基礎控除", "概要"],
      aliases: ["基礎控除"],
      tags: ["所得税", "控除"],
      updated_at: "2026-04-01",
      published_at: "2026-01-01",
      crawled_at: "2026-04-11T19:00:00Z",
    });
  });

  it("throws when the tax answer document does not exist", async () => {
    await expect(
      buildGetTaxAnswerResult({
        input: { id: "9999" },
        documents: [taxAnswerDocument],
      }),
    ).rejects.toThrow("タックスアンサーが見つかりません: 9999");
  });
});
