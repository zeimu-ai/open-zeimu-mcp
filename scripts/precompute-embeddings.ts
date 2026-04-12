import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { loadEnv } from "../src/config/env.js";
import { loadMarkdownDocuments } from "../src/data/md-loader.js";
import { createBgeM3Runtime } from "../src/embeddings/bge-m3-runtime.js";
import { splitIntoSemanticChunks } from "../src/search/semantic-chunks.js";
import { SOURCE_TYPES } from "../src/types/index.js";

async function main() {
  const env = loadEnv();
  const version = process.argv[2] ?? process.env.npm_package_version ?? "0.0.0";
  const outputRoot = resolve(process.argv[3] ?? env.vectorsCacheDir);
  const versionDir = join(outputRoot, version);

  const documents = await loadMarkdownDocuments({ dataDir: env.dataDir });
  const runtime = await createBgeM3Runtime({
    modelPath: join(versionDir, env.onnxModelFileName),
    tokenizerPath: join(versionDir, env.tokenizerFileName),
    tokenizerConfigPath: join(versionDir, env.tokenizerConfigFileName),
    maxTokens: env.embeddingMaxTokens,
  });

  await mkdir(versionDir, { recursive: true });

  for (const sourceType of SOURCE_TYPES) {
    const scopedDocuments = documents.filter((document) => document.sourceType === sourceType);
    if (scopedDocuments.length === 0) {
      continue;
    }

    const chunks = scopedDocuments.flatMap((document) =>
      splitIntoSemanticChunks({
        text: document.body,
        chunkSize: env.embeddingChunkSize,
        overlap: env.embeddingChunkOverlap,
      }).map((chunk) => ({
        id: document.id,
        chunk_id: chunk.chunk_id,
        chunk_offset: chunk.chunk_offset,
        text: chunk.text,
      })),
    );

    if (chunks.length === 0) {
      continue;
    }

    const encoded = await Promise.all(chunks.map((chunk) => runtime.encodeQuery(chunk.text)));
    const dimensions = encoded[0]?.length ?? 0;
    const flattened = new Float32Array(encoded.length * dimensions);

    encoded.forEach((vector, index) => {
      flattened.set(vector, index * dimensions);
    });

    const binPath = join(versionDir, `${sourceType}-vectors-${version}.bin`);
    const indexPath = join(versionDir, `${sourceType}-vectors-${version}.index.json`);

    await mkdir(dirname(binPath), { recursive: true });
    await writeFile(binPath, Buffer.from(flattened.buffer));
    await writeFile(
      indexPath,
      `${JSON.stringify(
        {
          version,
          source_type: sourceType,
          dimensions,
          chunk_size: env.embeddingChunkSize,
          chunk_overlap: env.embeddingChunkOverlap,
          chunk_count: chunks.length,
          chunks: chunks.map(({ text: _text, ...chunk }) => chunk),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    console.log(
      JSON.stringify({
        source_type: sourceType,
        chunk_count: chunks.length,
        dimensions,
        bin: binPath,
        index: indexPath,
      }),
    );
  }
}

main().catch((error) => {
  console.error("[precompute-embeddings] fatal:", error);
  process.exit(1);
});
