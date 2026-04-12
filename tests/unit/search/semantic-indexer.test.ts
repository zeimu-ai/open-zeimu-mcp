import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadSemanticIndexer } from "../../../src/search/semantic-indexer.js";
import type { LoadedDocument } from "../../../src/types/index.js";

describe("loadSemanticIndexer", () => {
  it("loads precomputed vectors and returns cosine-ranked hits", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-semantic-indexer-"));
    const version = "0.1.0-test";
    const versionDir = join(rootDir, version);
    await mkdir(versionDir, { recursive: true });

    const documents = [
      createDocument({
        id: "1200",
        sourceType: "tax_answer",
        title: "所得税の基礎控除",
        category: "shotoku",
        body: "基礎控除に関する説明です。所得税の負担軽減を扱います。",
      }),
      createDocument({
        id: "2200",
        sourceType: "tax_answer",
        title: "配偶者控除",
        category: "shotoku",
        body: "配偶者控除に関する説明です。",
      }),
      createDocument({
        id: "qa-001",
        sourceType: "qa_case",
        title: "交際費の判定に関する質疑応答事例",
        category: "hojin",
        body: "交際費の損金算入の可否を扱います。",
      }),
    ];

    await writeVectorFixture({
      versionDir,
      sourceType: "tax_answer",
      version,
      dimensions: 3,
      chunks: [
        { id: "1200", chunk_id: 0, chunk_offset: 0, vector: [1, 0, 0] },
        { id: "2200", chunk_id: 0, chunk_offset: 0, vector: [0.8, 0.2, 0] },
      ],
    });
    await writeVectorFixture({
      versionDir,
      sourceType: "qa_case",
      version,
      dimensions: 3,
      chunks: [{ id: "qa-001", chunk_id: 0, chunk_offset: 0, vector: [0, 1, 0] }],
    });

    const indexer = await loadSemanticIndexer({
      rootDir,
      version,
      documents,
    });

    const hits = indexer.searchSemantic({
      query: new Float32Array([1, 0, 0]),
      limit: 3,
      sourceType: "tax_answer",
      category: "shotoku",
    });

    expect(hits.map((hit) => hit.id)).toEqual(["1200", "2200"]);
    expect(hits[0]).toMatchObject({
      source_type: "tax_answer",
      title: "所得税の基礎控除",
      snippet: expect.stringContaining("基礎控除"),
      match_offset: 0,
    });
  });
});

function createDocument({
  id,
  sourceType,
  title,
  category,
  body,
}: {
  id: string;
  sourceType: LoadedDocument["sourceType"];
  title: string;
  category: string | null;
  body: string;
}): LoadedDocument {
  return {
    id,
    sourceType,
    title,
    category,
    canonicalUrl: `https://example.com/${sourceType}/${id}`,
    path: `/tmp/${sourceType}/${id}.md`,
    metadataPath: null,
    body,
    headings: [title],
    aliases: [],
    metadata: {},
    crawledAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
    publishedAt: "2026-04-12T00:00:00.000Z",
    contentHash: null,
    license: "public_data",
    version: 1,
    pageOffsets: [],
    pageCount: 0,
  };
}

async function writeVectorFixture({
  versionDir,
  sourceType,
  version,
  dimensions,
  chunks,
}: {
  versionDir: string;
  sourceType: string;
  version: string;
  dimensions: number;
  chunks: Array<{
    id: string;
    chunk_id: number;
    chunk_offset: number;
    vector: number[];
  }>;
}) {
  const bin = new Float32Array(chunks.flatMap((chunk) => chunk.vector));
  await writeFile(
    join(versionDir, `${sourceType}-vectors-${version}.bin`),
    Buffer.from(bin.buffer),
  );
  await writeFile(
    join(versionDir, `${sourceType}-vectors-${version}.index.json`),
    JSON.stringify({
      version,
      source_type: sourceType,
      dimensions,
      chunk_count: chunks.length,
      chunks: chunks.map(({ vector: _vector, ...chunk }) => chunk),
    }),
    "utf8",
  );
}
