import { describe, expect, it } from "vitest";

import { buildListQaCaseCategoriesResult } from "../../../src/tools/list-qa-case-categories.js";
import type { LoadedDocument } from "../../../src/types/index.js";

const documents: LoadedDocument[] = [
  {
    id: "qa-001",
    sourceType: "qa_case",
    title: "交際費の判定に関する質疑応答事例",
    category: "hojin",
    canonicalUrl: "https://www.nta.go.jp/law/shitsugi/hojin/001.htm",
    path: "/tmp/data/qa_case/001/001.md",
    metadataPath: "/tmp/data/qa_case/001/001.meta.json",
    body: "本文です。",
    headings: ["交際費の判定に関する質疑応答事例"],
    aliases: [],
    metadata: {},
    crawledAt: "2026-04-12T00:20:00Z",
    updatedAt: null,
    publishedAt: null,
    contentHash: null,
    license: "public_data",
    version: 1,
    pageOffsets: [],
    pageCount: 0,
  },
  {
    id: "1200",
    sourceType: "tax_answer",
    title: "別ソース",
    category: "shotoku",
    canonicalUrl: "https://example.com/tax",
    path: "/tmp/data/tax_answer/1200/1200.md",
    metadataPath: "/tmp/data/tax_answer/1200/1200.meta.json",
    body: "本文です。",
    headings: ["別ソース"],
    aliases: [],
    metadata: {},
    crawledAt: "2026-04-11T19:00:00Z",
    updatedAt: null,
    publishedAt: null,
    contentHash: null,
    license: null,
    version: 1,
    pageOffsets: [],
    pageCount: 0,
  },
];

describe("buildListQaCaseCategoriesResult", () => {
  it("aggregates qa_case categories only", () => {
    expect(
      buildListQaCaseCategoriesResult({
        documents,
      }),
    ).toEqual({
      source_type: "qa_case",
      total_count: 1,
      categories: [
        {
          category: "hojin",
          document_count: 1,
          latest_crawled_at: "2026-04-12T00:20:00Z",
        },
      ],
    });
  });
});
