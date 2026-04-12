import { describe, expect, it } from "vitest";

import { buildGetSaiketsuResult } from "../../../src/tools/get-saiketsu.js";
import type { LoadedDocument } from "../../../src/types/index.js";

const saiketsuDocument: LoadedDocument = {
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
  metadata: {
    citation: "裁決事例集139-01",
    document_number: "139-01",
    tags: ["所得税", "譲渡所得", "立退料"],
  },
  crawledAt: "2026-04-12T01:00:00Z",
  updatedAt: "2026-03-31",
  publishedAt: "2026-01-15",
  contentHash: "hash-saiketsu-001",
  license: "public_data",
  version: 1,
  pageOffsets: [],
  pageCount: 0,
};

describe("buildGetSaiketsuResult", () => {
  it("returns a saiketsu document by id", async () => {
    await expect(
      buildGetSaiketsuResult({
        input: { id: "sai-001" },
        documents: [saiketsuDocument],
      }),
    ).resolves.toEqual({
      source_type: "saiketsu",
      id: "sai-001",
      title: "立退料の所得区分に関する裁決事例",
      category: "shotoku",
      canonical_url: "https://www.kfs.go.jp/service/JP/139/01/index.html",
      citation: "裁決事例集139-01",
      document_number: "139-01",
      content: "立退料が譲渡所得に該当するかを判断した裁決事例です。",
      headings: ["立退料の所得区分に関する裁決事例"],
      aliases: ["立退料裁決"],
      tags: ["所得税", "譲渡所得", "立退料"],
      updated_at: "2026-03-31",
      published_at: "2026-01-15",
      crawled_at: "2026-04-12T01:00:00Z",
      license: "public_data",
    });
  });

  it("throws when the saiketsu document does not exist", async () => {
    await expect(
      buildGetSaiketsuResult({
        input: { id: "404" },
        documents: [saiketsuDocument],
      }),
    ).rejects.toThrow("裁決事例が見つかりません: 404");
  });
});
