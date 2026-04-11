import { describe, expect, it } from "vitest";

import { buildGetQaCaseResult } from "../../../src/tools/get-qa-case.js";
import type { LoadedDocument } from "../../../src/types/index.js";

const qaCaseDocument: LoadedDocument = {
  id: "qa-001",
  sourceType: "qa_case",
  title: "交際費の判定に関する質疑応答事例",
  category: "hojin",
  canonicalUrl: "https://www.nta.go.jp/law/shitsugi/hojin/001.htm",
  path: "/tmp/data/qa_case/001/001.md",
  metadataPath: "/tmp/data/qa_case/001/001.meta.json",
  body: "得意先に対する飲食費が交際費等に該当するかを解説する質疑応答事例です。",
  headings: ["交際費の判定に関する質疑応答事例", "回答"],
  aliases: ["交際費Q&A"],
  metadata: {
    citation: "質疑応答事例 法人税 交際費",
    document_number: "法人税QA-001",
    tags: ["法人税", "交際費"],
  },
  crawledAt: "2026-04-12T00:20:00Z",
  updatedAt: null,
  publishedAt: null,
  contentHash: "hash-qa-001",
  license: "public_data",
  version: 1,
  pageOffsets: [],
  pageCount: 0,
};

describe("buildGetQaCaseResult", () => {
  it("returns a qa_case document by id", async () => {
    const result = await buildGetQaCaseResult({
      input: { id: "qa-001" },
      documents: [qaCaseDocument],
    });

    expect(result).toEqual({
      source_type: "qa_case",
      id: "qa-001",
      title: "交際費の判定に関する質疑応答事例",
      category: "hojin",
      canonical_url: "https://www.nta.go.jp/law/shitsugi/hojin/001.htm",
      citation: "質疑応答事例 法人税 交際費",
      document_number: "法人税QA-001",
      content: "得意先に対する飲食費が交際費等に該当するかを解説する質疑応答事例です。",
      headings: ["交際費の判定に関する質疑応答事例", "回答"],
      aliases: ["交際費Q&A"],
      tags: ["法人税", "交際費"],
      updated_at: null,
      published_at: null,
      crawled_at: "2026-04-12T00:20:00Z",
      license: "public_data",
    });
  });

  it("throws when the qa_case document does not exist", async () => {
    await expect(
      buildGetQaCaseResult({
        input: { id: "404" },
        documents: [qaCaseDocument],
      }),
    ).rejects.toThrow("質疑応答事例が見つかりません: 404");
  });
});
