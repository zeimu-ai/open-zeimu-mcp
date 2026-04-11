import { describe, expect, it } from "vitest";

import { buildGetWrittenAnswerResult } from "../../../src/tools/get-written-answer.js";
import type { LoadedDocument } from "../../../src/types/index.js";

const writtenAnswerDocument: LoadedDocument = {
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
    document_number: "令和6年1月1日",
  },
  crawledAt: "2026-04-11T19:00:00Z",
  updatedAt: "2026-04-01",
  publishedAt: "2026-01-01",
  contentHash: "hash-202401",
  license: "public_data",
  version: 4,
  pageOffsets: [0, 12],
  pageCount: 2,
};

describe("buildGetWrittenAnswerResult", () => {
  it("returns a written_answer document by id", async () => {
    const result = await buildGetWrittenAnswerResult({
      input: { id: "202401" },
      documents: [writtenAnswerDocument],
    });

    expect(result).toEqual({
      source_type: "written_answer",
      id: "202401",
      title: "非上場株式の評価に関する文書回答事例",
      category: "hyoka",
      canonical_url: "https://www.nta.go.jp/law/bunshokaito/hyoka/240101/01.htm",
      citation: "文書回答事例 202401",
      document_number: "令和6年1月1日",
      content: "第1ページ本文です。\n\n第2ページ本文です。",
      headings: ["非上場株式の評価に関する文書回答事例"],
      updated_at: "2026-04-01",
      published_at: "2026-01-01",
      crawled_at: "2026-04-11T19:00:00Z",
      license: "public_data",
      page_count: 2,
    });
  });

  it("throws when the written_answer document does not exist", async () => {
    await expect(
      buildGetWrittenAnswerResult({
        input: { id: "404" },
        documents: [writtenAnswerDocument],
      }),
    ).rejects.toThrow("文書回答事例が見つかりません: 404");
  });
});
