import { describe, expect, it } from "vitest";

import { buildListSaiketsuCategoriesResult } from "../../../src/tools/list-saiketsu-categories.js";
import type { LoadedDocument } from "../../../src/types/index.js";

describe("buildListSaiketsuCategoriesResult", () => {
  it("summarizes saiketsu categories only", () => {
    const documents: LoadedDocument[] = [
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
        metadata: {},
        crawledAt: "2026-04-12T01:00:00Z",
        updatedAt: "2026-03-31",
        publishedAt: "2026-01-15",
        contentHash: "hash-001",
        license: "public_data",
        version: 1,
        pageOffsets: [],
        pageCount: 0,
      },
      {
        id: "qa-001",
        sourceType: "qa_case",
        title: "交際費の判定に関する質疑応答事例",
        category: "hojin",
        canonicalUrl: "https://example.com/qa/001",
        path: "/tmp/data/qa_case/001/001.md",
        metadataPath: null,
        body: "本文",
        headings: ["交際費の判定に関する質疑応答事例"],
        aliases: [],
        metadata: {},
        crawledAt: "2026-04-12T00:00:00Z",
        updatedAt: null,
        publishedAt: null,
        contentHash: "hash-qa-001",
        license: "public_data",
        version: 1,
        pageOffsets: [],
        pageCount: 0,
      },
    ];

    expect(buildListSaiketsuCategoriesResult({ documents })).toEqual({
      source_type: "saiketsu",
      total_count: 1,
      categories: [
        {
          category: "shotoku",
          document_count: 1,
          latest_crawled_at: "2026-04-12T01:00:00Z",
        },
      ],
    });
  });
});
