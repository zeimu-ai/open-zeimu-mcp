import { describe, expect, it } from "vitest";

import { buildListWrittenAnswerCategoriesResult } from "../../../src/tools/list-written-answer-categories.js";
import type { LoadedDocument } from "../../../src/types/index.js";

describe("buildListWrittenAnswerCategoriesResult", () => {
  it("summarizes written_answer categories only", () => {
    const documents: LoadedDocument[] = [
      {
        id: "202401",
        sourceType: "written_answer",
        title: "非上場株式の評価に関する文書回答事例",
        category: "hyoka",
        canonicalUrl: "https://example.com/written/202401",
        path: "/tmp/data/written_answer/202401/202401.md",
        metadataPath: "/tmp/data/written_answer/202401/202401.meta.json",
        body: "第1ページ本文です。",
        headings: ["非上場株式の評価に関する文書回答事例"],
        aliases: [],
        metadata: {},
        crawledAt: "2026-04-11T19:00:00Z",
        updatedAt: null,
        publishedAt: null,
        contentHash: "hash-202401",
        license: "public_data",
        version: 1,
        pageOffsets: [0],
        pageCount: 1,
      },
      {
        id: "202402",
        sourceType: "written_answer",
        title: "相続税の申告期限に関する文書回答事例",
        category: "sozoku",
        canonicalUrl: "https://example.com/written/202402",
        path: "/tmp/data/written_answer/202402/202402.md",
        metadataPath: null,
        body: "本文",
        headings: ["相続税の申告期限に関する文書回答事例"],
        aliases: [],
        metadata: {},
        crawledAt: "2026-04-12T01:00:00Z",
        updatedAt: null,
        publishedAt: null,
        contentHash: "hash-202402",
        license: "public_data",
        version: 1,
        pageOffsets: [0],
        pageCount: 1,
      },
      {
        id: "1200",
        sourceType: "tax_answer",
        title: "所得税の基礎控除",
        category: "shotoku",
        canonicalUrl: "https://example.com/tax/1200",
        path: "/tmp/data/tax_answer/1200.md",
        metadataPath: null,
        body: "本文",
        headings: ["所得税の基礎控除"],
        aliases: [],
        metadata: {},
        crawledAt: "2026-04-12T00:00:00Z",
        updatedAt: null,
        publishedAt: null,
        contentHash: "hash-1200",
        license: "public_data",
        version: 1,
        pageOffsets: [],
        pageCount: 0,
      },
    ];

    expect(buildListWrittenAnswerCategoriesResult({ documents })).toEqual({
      source_type: "written_answer",
      total_count: 2,
      categories: [
        {
          category: "hyoka",
          document_count: 1,
          latest_crawled_at: "2026-04-11T19:00:00Z",
        },
        {
          category: "sozoku",
          document_count: 1,
          latest_crawled_at: "2026-04-12T01:00:00Z",
        },
      ],
    });
  });
});
