import { describe, expect, it } from "vitest";

import { buildGetTsutatsuResult } from "../../../src/tools/get-tsutatsu.js";
import type { LoadedDocument } from "../../../src/types/index.js";

const tsutatsuDocument: LoadedDocument = {
  id: "tsu-001",
  sourceType: "tsutatsu",
  title: "消費税の仕入税額控除に関する通達",
  category: "shohi",
  canonicalUrl: "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/001.htm",
  path: "/tmp/data/tsutatsu/001/001.md",
  metadataPath: "/tmp/data/tsutatsu/001/001.meta.json",
  body: "適格請求書等保存方式における仕入税額控除の考え方を整理した通達です。",
  headings: ["消費税の仕入税額控除に関する通達", "取扱い"],
  aliases: ["仕入税額控除通達"],
  metadata: {
    citation: "消費税基本通達11-6-1",
    document_number: "課消2-1",
    tags: ["消費税", "インボイス"],
  },
  crawledAt: "2026-04-12T00:10:00Z",
  updatedAt: null,
  publishedAt: null,
  contentHash: "hash-001",
  license: "public_data",
  version: 1,
  pageOffsets: [],
  pageCount: 0,
};

describe("buildGetTsutatsuResult", () => {
  it("returns a tsutatsu document by id", async () => {
    const result = await buildGetTsutatsuResult({
      input: { id: "tsu-001" },
      documents: [tsutatsuDocument],
    });

    expect(result).toEqual({
      source_type: "tsutatsu",
      id: "tsu-001",
      title: "消費税の仕入税額控除に関する通達",
      category: "shohi",
      canonical_url: "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/001.htm",
      citation: "消費税基本通達11-6-1",
      document_number: "課消2-1",
      content: "適格請求書等保存方式における仕入税額控除の考え方を整理した通達です。",
      headings: ["消費税の仕入税額控除に関する通達", "取扱い"],
      aliases: ["仕入税額控除通達"],
      tags: ["消費税", "インボイス"],
      updated_at: null,
      published_at: null,
      crawled_at: "2026-04-12T00:10:00Z",
      license: "public_data",
    });
  });

  it("throws when the tsutatsu document does not exist", async () => {
    await expect(
      buildGetTsutatsuResult({
        input: { id: "404" },
        documents: [tsutatsuDocument],
      }),
    ).rejects.toThrow("通達が見つかりません: 404");
  });
});
