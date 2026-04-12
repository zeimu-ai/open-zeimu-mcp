import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

import type { LexicalSearchHit } from "./lexical-index.js";
import { buildChunkSnippet } from "./semantic-chunks.js";
import { SOURCE_TYPES, type LoadedDocument, type SourceType } from "../types/index.js";

type SemanticIndexChunkRecord = {
  id: string;
  chunk_id: number;
  chunk_offset: number;
};

type SemanticIndexManifest = {
  version: string;
  source_type: SourceType;
  dimensions: number;
  chunk_size?: number;
  chunk_overlap?: number;
  chunk_count: number;
  chunks: SemanticIndexChunkRecord[];
};

type LoadedSemanticChunk = {
  id: string;
  source_type: SourceType;
  title: string;
  category: string | null;
  chunk_id: number;
  chunk_offset: number;
  snippet: string;
  vector: Float32Array;
};

export type SemanticSearchHit = LexicalSearchHit & {
  chunk_id: number;
  chunk_offset: number;
};

export type SemanticIndexer = {
  dimensions: number | null;
  chunkCount: number;
  totalBytes: number;
  loadedSources: SourceType[];
  searchSemantic: (input: {
    query: Float32Array;
    limit: number;
    sourceType?: SourceType;
    category?: string;
  }) => SemanticSearchHit[];
};

export async function loadSemanticIndexer({
  rootDir,
  version,
  documents,
}: {
  rootDir: string;
  version: string;
  documents: LoadedDocument[];
}): Promise<SemanticIndexer> {
  const versionDir = join(rootDir, version);
  const documentMap = new Map(
    documents.map((document) => [`${document.sourceType}:${document.id}`, document] as const),
  );

  const chunks: LoadedSemanticChunk[] = [];
  const loadedSources: SourceType[] = [];
  let dimensions: number | null = null;
  let totalBytes = 0;

  for (const sourceType of SOURCE_TYPES) {
    const binPath = join(versionDir, `${sourceType}-vectors-${version}.bin`);
    const indexPath = join(versionDir, `${sourceType}-vectors-${version}.index.json`);
    const [binExists, indexExists] = await Promise.all([pathExists(binPath), pathExists(indexPath)]);

    if (!binExists || !indexExists) {
      continue;
    }

    const [rawBuffer, rawIndex] = await Promise.all([readFile(binPath), readFile(indexPath, "utf8")]);
    const manifest = JSON.parse(rawIndex) as SemanticIndexManifest;
    const vectorData = new Float32Array(
      rawBuffer.buffer,
      rawBuffer.byteOffset,
      rawBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );

    if (dimensions === null) {
      dimensions = manifest.dimensions;
    } else if (dimensions !== manifest.dimensions) {
      throw new Error(
        `Semantic vector dimensions must match across sources: ${dimensions} !== ${manifest.dimensions}`,
      );
    }

    if (vectorData.length !== manifest.chunks.length * manifest.dimensions) {
      throw new Error(
        `Semantic vector binary size mismatch for ${sourceType}: expected ${manifest.chunks.length * manifest.dimensions} floats, received ${vectorData.length}`,
      );
    }

    loadedSources.push(sourceType);
    totalBytes += rawBuffer.byteLength;

    manifest.chunks.forEach((record, index) => {
      const document = documentMap.get(`${sourceType}:${record.id}`);
      if (!document) {
        return;
      }

      const start = index * manifest.dimensions;
      const end = start + manifest.dimensions;
      const vector = normalizeVector(vectorData.slice(start, end));
      const rawSnippet = document.body.slice(
        record.chunk_offset,
        record.chunk_offset + (manifest.chunk_size ?? 120),
      );

      chunks.push({
        id: record.id,
        source_type: sourceType,
        title: document.title,
        category: document.category,
        chunk_id: record.chunk_id,
        chunk_offset: record.chunk_offset,
        snippet: buildChunkSnippet(rawSnippet || document.body),
        vector,
      });
    });
  }

  return {
    dimensions,
    chunkCount: chunks.length,
    totalBytes,
    loadedSources,
    searchSemantic({ query, limit, sourceType, category }) {
      if (chunks.length === 0) {
        return [];
      }

      const normalizedQuery = normalizeVector(query);
      const bestByDocument = new Map<string, SemanticSearchHit>();

      for (const chunk of chunks) {
        if (sourceType && chunk.source_type !== sourceType) {
          continue;
        }

        if (category && chunk.category !== category) {
          continue;
        }

        const score = dot(normalizedQuery, chunk.vector);
        const key = `${chunk.source_type}:${chunk.id}`;
        const current = bestByDocument.get(key);

        if (!current || score > current.score) {
          bestByDocument.set(key, {
            id: chunk.id,
            source_type: chunk.source_type,
            title: chunk.title,
            score,
            snippet: chunk.snippet,
            match_offset: chunk.chunk_offset,
            chunk_id: chunk.chunk_id,
            chunk_offset: chunk.chunk_offset,
          });
        }
      }

      return [...bestByDocument.values()]
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
    },
  };
}

export function normalizeVector(input: Float32Array) {
  const output = new Float32Array(input);
  let sumSquares = 0;
  for (const value of output) {
    sumSquares += value * value;
  }

  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    return output;
  }

  for (let index = 0; index < output.length; index += 1) {
    output[index] /= norm;
  }

  return output;
}

function dot(left: Float32Array, right: Float32Array) {
  const limit = Math.min(left.length, right.length);
  let sum = 0;
  for (let index = 0; index < limit; index += 1) {
    sum += left[index] * right[index];
  }
  return sum;
}

async function pathExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
