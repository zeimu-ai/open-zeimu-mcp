import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { createServer } from "../../src/server.js";

describe("semantic search integration", () => {
  it("serves semantic and hybrid modes with fixture vectors", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-semantic-server-"));
    const dataDir = join(sandbox, "data");
    const vectorsCacheDir = join(sandbox, "vectors");
    const version = "0.1.0-test";
    const versionDir = join(vectorsCacheDir, version);

    await cp(join(process.cwd(), "tests/fixtures/data"), dataDir, { recursive: true });
    await mkdir(versionDir, { recursive: true });
    await writeFile(join(versionDir, "bge-m3-int8.onnx.tar.gz"), "model", "utf8");
    await writeFile(join(versionDir, "tokenizer.json"), "tokenizer", "utf8");
    await writeFile(join(versionDir, "tokenizer_config.json"), "{}", "utf8");

    await writeVectorFixture({
      versionDir,
      sourceType: "tax_answer",
      version,
      dimensions: 3,
      chunks: [
        { id: "1200", chunk_id: 0, chunk_offset: 0, vector: [1, 0, 0] },
        { id: "2200", chunk_id: 0, chunk_offset: 0, vector: [0.2, 1, 0] },
      ],
    });

    const app = await createServer({
      env: {
        embeddingBackend: "local",
        logLevel: "info",
        dataDir,
        vectorsCacheDir,
        onnxModelFileName: "bge-m3-int8.onnx.tar.gz",
        tokenizerFileName: "tokenizer.json",
        tokenizerConfigFileName: "tokenizer_config.json",
        embeddingChunkSize: 512,
        embeddingChunkOverlap: 64,
        embeddingMaxTokens: 512,
      },
      version,
      semantic: {
        createQueryRuntime: async () => ({
          encodeQuery(query: string) {
            if (query === "控除の考え方を意味検索") {
              return Promise.resolve(new Float32Array([1, 0, 0]));
            }
            return Promise.resolve(new Float32Array([0.9, 0.1, 0]));
          },
        }),
      },
    });

    const client = new Client(
      { name: "open-zeimu-mcp-semantic-test-client", version: "0.0.0" },
      { capabilities: {} },
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), app.start(serverTransport)]);

    const stats = await client.callTool({ name: "stats", arguments: {} });
    expect(stats.structuredContent).toMatchObject({
      semantic: {
        backend: "local",
        semantic_ready: true,
        vectors_loaded: true,
        loaded_sources: ["tax_answer"],
      },
    });

    const semantic = await client.callTool({
      name: "search_tax_answer",
      arguments: { query: "控除の考え方を意味検索", limit: 5, search_mode: "semantic" },
    });
    expect(semantic.structuredContent).toMatchObject({
      source_type: "tax_answer",
      query: "控除の考え方を意味検索",
      total_count: 1,
      results: [
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
        },
      ],
    });

    const hybrid = await client.callTool({
      name: "search_tax_answer",
      arguments: { query: "基礎控除", limit: 5, search_mode: "hybrid" },
    });
    expect(hybrid.structuredContent).toMatchObject({
      source_type: "tax_answer",
      query: "基礎控除",
      total_count: 1,
      results: [
        {
          id: "1200",
          source_type: "tax_answer",
          title: "所得税の基礎控除",
        },
      ],
    });

    await Promise.all([client.close(), app.close()]);
  });
});

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
