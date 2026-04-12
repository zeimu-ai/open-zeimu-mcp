import { join } from "node:path";

import type { Env } from "../config/env.js";
import { createBgeM3Runtime, type QueryEmbeddingRuntime } from "../embeddings/bge-m3-runtime.js";
import type { LexicalIndex, LexicalSearchHit } from "./lexical-index.js";
import { reciprocalRankFusion } from "./rrf.js";
import { inspectVectorAssets } from "./semantic-assets.js";
import { loadSemanticIndexer, type SemanticIndexer } from "./semantic-indexer.js";
import type { LoadedDocument, SourceType } from "../types/index.js";

export const SEARCH_MODES = ["lexical", "semantic", "hybrid"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export type SemanticSearchEngine = {
  backend: Env["embeddingBackend"];
  ready: boolean;
  reason: string;
  runtime_available: boolean;
  vectors_loaded: boolean;
  chunk_count: number;
  total_bytes: number;
  loaded_sources: SourceType[];
  search: (input: {
    query: string;
    sourceType: SourceType;
    category?: string;
    limit: number;
  }) => Promise<LexicalSearchHit[]>;
};

export async function createSemanticSearchEngine({
  env,
  version,
  documents,
  createQueryRuntime = defaultCreateQueryRuntime,
}: {
  env: Env;
  version: string;
  documents: LoadedDocument[];
  createQueryRuntime?: (input: {
    env: Env;
    version: string;
  }) => Promise<QueryEmbeddingRuntime>;
}): Promise<SemanticSearchEngine> {
  const assets = await inspectVectorAssets({ env, version });

  if (env.embeddingBackend === "none") {
    return buildDisabledEngine({
      backend: "none",
      reason: "backend_disabled",
    });
  }

  if (env.embeddingBackend === "supabase") {
    return buildDisabledEngine({
      backend: "supabase",
      reason: "not_implemented",
      runtime_available: false,
    });
  }

  if (!assets.ready) {
    return buildDisabledEngine({
      backend: "local",
      reason: assets.reason,
    });
  }

  const indexer = await loadSemanticIndexer({
    rootDir: env.vectorsCacheDir,
    version,
    documents,
  });

  if (indexer.chunkCount === 0) {
    return buildDisabledEngine({
      backend: "local",
      reason: "vector_indexes_missing",
      runtime_available: assets.runtime_available,
    });
  }

  const queryRuntime = await createQueryRuntime({ env, version });

  return {
    backend: "local",
    ready: true,
    reason: "local_backend_ready",
    runtime_available: true,
    vectors_loaded: true,
    chunk_count: indexer.chunkCount,
    total_bytes: indexer.totalBytes,
    loaded_sources: indexer.loadedSources,
    async search({ query, sourceType, category, limit }) {
      const embedded = await queryRuntime.encodeQuery(query);
      return indexer.searchSemantic({
        query: embedded,
        limit,
        sourceType,
        category,
      });
    },
  };
}

export async function runSearchWithMode({
  lexicalIndex,
  semanticEngine,
  query,
  sourceType,
  category,
  limit,
  searchMode,
}: {
  lexicalIndex: LexicalIndex;
  semanticEngine: SemanticSearchEngine;
  query: string;
  sourceType: SourceType;
  category?: string;
  limit: number;
  searchMode: SearchMode;
}) {
  const lexicalHits = lexicalIndex.search({
    query,
    sourceTypes: [sourceType],
    category,
    limit,
  }).hits;

  if (searchMode === "lexical") {
    return {
      hits: lexicalHits,
      warning: null,
    };
  }

  if (!semanticEngine.ready) {
    return {
      hits: lexicalHits,
      warning: `semantic search unavailable: ${semanticEngine.reason}`,
    };
  }

  if (!semanticEngine.loaded_sources.includes(sourceType)) {
    return {
      hits: lexicalHits,
      warning: `semantic vectors unavailable for source_type=${sourceType}`,
    };
  }

  const semanticHits = await semanticEngine.search({
    query,
    sourceType,
    category,
    limit,
  });

  if (searchMode === "semantic") {
    return {
      hits: semanticHits,
      warning: null,
    };
  }

  return {
    hits: reciprocalRankFusion({
      lexicalHits,
      semanticHits,
      limit,
    }),
    warning: null,
  };
}

async function defaultCreateQueryRuntime({
  env,
  version,
}: {
  env: Env;
  version: string;
}) {
  const versionDir = join(env.vectorsCacheDir, version);
  return createBgeM3Runtime({
    modelPath: join(versionDir, env.onnxModelFileName ?? "bge-m3-int8.onnx.tar.gz"),
    tokenizerPath: join(versionDir, env.tokenizerFileName ?? "tokenizer.json"),
    tokenizerConfigPath: join(
      versionDir,
      env.tokenizerConfigFileName ?? "tokenizer_config.json",
    ),
    maxTokens: env.embeddingMaxTokens ?? 512,
  });
}

function buildDisabledEngine({
  backend,
  reason,
  runtime_available = false,
}: {
  backend: Env["embeddingBackend"];
  reason: string;
  runtime_available?: boolean;
}): SemanticSearchEngine {
  return {
    backend,
    ready: false,
    reason,
    runtime_available,
    vectors_loaded: false,
    chunk_count: 0,
    total_bytes: 0,
    loaded_sources: [],
    async search() {
      return [];
    },
  };
}
