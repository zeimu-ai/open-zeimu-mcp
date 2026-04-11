import { describe, expect, it } from "vitest";

import { buildListTsutatsuCategoriesResult } from "../../../src/tools/list-tsutatsu-categories.js";
import type { LoadedDocument } from "../../../src/types/index.js";

const documents: LoadedDocument[] = [
  {
    id: "tsu-001",
    sourceType: "tsutatsu",
    title: "消費税の仕入税額控除に関する通達",
    category: "shohi",
    canonicalUrl: "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/001.htm",
    path: "/tmp/data/tsutatsu/001/001.md",
    metadataPath: "/tmp/data/tsutatsu/001/001.meta.json",
    body: "本文です。",
    headings: ["消費税の仕入税額控除に関する通達"],
    aliases: [],
    metadata: {},
    crawledAt: "2026-04-12T00:10:00Z",
    updatedAt: null,
    publishedAt: null,
    contentHash: null,
    license: "public_data",
    version: 1,
    pageOffsets: [],
    pageCount: 0,
  },
  {
    id: "202401",
    sourceType: "written_answer",
    title: "別ソース",
    category: "hyoka",
    canonicalUrl: "https://example.com/written",
    path: "/tmp/data/written_answer/202401/202401.md",
    metadataPath: "/tmp/data/written_answer/202401/202401.meta.json",
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

describe("buildListTsutatsuCategoriesResult", () => {
  it("aggregates tsutatsu categories only", () => {
    expect(
      buildListTsutatsuCategoriesResult({
        documents,
      }),
    ).toEqual({
      source_type: "tsutatsu",
      total_count: 1,
      categories: [
        {
          category: "shohi",
          document_count: 1,
          latest_crawled_at: "2026-04-12T00:10:00Z",
        },
      ],
    });
  });
});
