import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

import type { Env } from "../config/env.js";
import { SOURCE_TYPES, type SourceType } from "../types/index.js";

const VECTOR_RUNTIME_PACKAGE = "onnxruntime-node";

export type VectorAssetsState = {
  backend: Env["embeddingBackend"];
  status: "disabled" | "missing_assets" | "ready" | "stub";
  root_dir: string;
  version_dir: string;
  runtime_package: string;
  tokenizer_asset: {
    file_name: string;
    exists: boolean;
  };
  tokenizer_config_asset: {
    file_name: string;
    exists: boolean;
  };
  model_asset: {
    file_name: string;
    exists: boolean;
  };
  vector_asset: {
    file_name: string;
    exists: boolean;
  };
  ready: boolean;
  missing: string[];
  reason: string;
  runtime_available: boolean;
  latest_version: string | null;
  total_chunks: number;
  total_bytes: number;
  vector_indexes: Array<{
    source_type: SourceType;
    file_name: string;
    index_file_name: string;
    exists: boolean;
    index_exists: boolean;
    chunk_count: number;
    bytes: number;
  }>;
  loaded_sources: SourceType[];
};

export type SemanticBackendState = {
  backend: Env["embeddingBackend"];
  status: "disabled" | "fallback" | "ready" | "stub";
  reason: string;
  runtime_available: boolean;
  assets: VectorAssetsState;
};

export async function inspectVectorAssets({
  env,
  version,
}: {
  env: Env;
  version: string;
}): Promise<VectorAssetsState> {
  const versionDir = join(env.vectorsCacheDir, version);
  const modelFileName = env.onnxModelFileName ?? "bge-m3-int8.onnx.tar.gz";
  const tokenizerFileName = env.tokenizerFileName ?? "tokenizer.json";
  const tokenizerConfigFileName = env.tokenizerConfigFileName ?? "tokenizer_config.json";
  const vectorFileName = `tax_answer-vectors-${version}.bin`;

  const modelExists = await pathExists(join(versionDir, modelFileName));
  const tokenizerExists = await pathExists(join(versionDir, tokenizerFileName));
  const tokenizerConfigExists = await pathExists(join(versionDir, tokenizerConfigFileName));
  const vectorIndexStates = await Promise.all(
    SOURCE_TYPES.map(async (sourceType) => inspectSourceVectorAsset({ versionDir, version, sourceType })),
  );
  const taxAnswerAsset = vectorIndexStates.find((asset) => asset.source_type === "tax_answer");
  const runtime = await loadRuntimePackage();
  const totalChunks = vectorIndexStates.reduce((sum, asset) => sum + asset.chunk_count, 0);
  const totalBytes = vectorIndexStates.reduce((sum, asset) => sum + asset.bytes, 0);
  const loadedSources = vectorIndexStates.filter((asset) => asset.exists && asset.index_exists).map((asset) => asset.source_type);

  if (env.embeddingBackend === "none") {
    return {
      backend: "none",
      status: "disabled",
      root_dir: env.vectorsCacheDir,
      version_dir: versionDir,
      runtime_package: VECTOR_RUNTIME_PACKAGE,
      tokenizer_asset: {
        file_name: tokenizerFileName,
        exists: tokenizerExists,
      },
      tokenizer_config_asset: {
        file_name: tokenizerConfigFileName,
        exists: tokenizerConfigExists,
      },
      model_asset: {
        file_name: modelFileName,
        exists: modelExists,
      },
      vector_asset: {
        file_name: vectorFileName,
        exists: taxAnswerAsset?.exists ?? false,
      },
      ready: false,
      missing: [],
      reason: "EMBEDDING_BACKEND=none",
      runtime_available: runtime.available,
      latest_version: version,
      total_chunks: totalChunks,
      total_bytes: totalBytes,
      vector_indexes: vectorIndexStates,
      loaded_sources: loadedSources,
    };
  }

  if (env.embeddingBackend === "supabase") {
    return {
      backend: "supabase",
      status: "stub",
      root_dir: env.vectorsCacheDir,
      version_dir: versionDir,
      runtime_package: VECTOR_RUNTIME_PACKAGE,
      tokenizer_asset: {
        file_name: tokenizerFileName,
        exists: tokenizerExists,
      },
      tokenizer_config_asset: {
        file_name: tokenizerConfigFileName,
        exists: tokenizerConfigExists,
      },
      model_asset: {
        file_name: modelFileName,
        exists: modelExists,
      },
      vector_asset: {
        file_name: vectorFileName,
        exists: taxAnswerAsset?.exists ?? false,
      },
      ready: false,
      missing: [],
      reason: "supabase_backend_pending_v1",
      runtime_available: runtime.available,
      latest_version: version,
      total_chunks: totalChunks,
      total_bytes: totalBytes,
      vector_indexes: vectorIndexStates,
      loaded_sources: loadedSources,
    };
  }

  const missing = [
    ...(modelExists ? [] : [modelFileName]),
    ...(tokenizerExists ? [] : [tokenizerFileName]),
    ...(tokenizerConfigExists ? [] : [tokenizerConfigFileName]),
    ...(loadedSources.length > 0 ? [] : ["<no-precomputed-vectors>"]),
  ];

  return {
    backend: "local",
    status: missing.length === 0 ? "ready" : "missing_assets",
    root_dir: env.vectorsCacheDir,
    version_dir: versionDir,
    runtime_package: VECTOR_RUNTIME_PACKAGE,
    tokenizer_asset: {
      file_name: tokenizerFileName,
      exists: tokenizerExists,
    },
    tokenizer_config_asset: {
      file_name: tokenizerConfigFileName,
      exists: tokenizerConfigExists,
    },
    model_asset: {
      file_name: modelFileName,
      exists: modelExists,
    },
    vector_asset: {
      file_name: vectorFileName,
      exists: taxAnswerAsset?.exists ?? false,
    },
    ready: missing.length === 0,
    missing,
    reason: missing.length === 0 ? "assets_present" : "release_assets_missing",
    runtime_available: runtime.available,
    latest_version: version,
    total_chunks: totalChunks,
    total_bytes: totalBytes,
    vector_indexes: vectorIndexStates,
    loaded_sources: loadedSources,
  };
}

export async function loadSemanticBackend({
  env,
  version,
}: {
  env: Env;
  version: string;
}): Promise<SemanticBackendState> {
  const assets = await inspectVectorAssets({ env, version });

  if (env.embeddingBackend === "none") {
    return {
      backend: "none",
      status: "disabled",
      reason: "backend_disabled",
      runtime_available: false,
      assets,
    };
  }

  if (env.embeddingBackend === "supabase") {
    return {
      backend: "supabase",
      status: "stub",
      reason: "not_implemented",
      runtime_available: false,
      assets,
    };
  }

  if (!assets.ready) {
    return {
      backend: "local",
      status: "fallback",
      reason: "missing_assets",
      runtime_available: false,
      assets,
    };
  }

  const runtime = await loadRuntimePackage();
  if (!runtime.available) {
    return {
      backend: "local",
      status: "fallback",
      reason: "runtime_unavailable",
      runtime_available: false,
      assets,
    };
  }

  return {
    backend: "local",
    status: "ready",
    reason: "local_backend_ready",
    runtime_available: true,
    assets,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadRuntimePackage() {
  try {
    await import(VECTOR_RUNTIME_PACKAGE);
    return { available: true as const };
  } catch {
    return { available: false as const };
  }
}

async function inspectSourceVectorAsset({
  versionDir,
  version,
  sourceType,
}: {
  versionDir: string;
  version: string;
  sourceType: SourceType;
}) {
  const fileName = `${sourceType}-vectors-${version}.bin`;
  const indexFileName = `${sourceType}-vectors-${version}.index.json`;
  const vectorPath = join(versionDir, fileName);
  const indexPath = join(versionDir, indexFileName);
  const [exists, indexExists] = await Promise.all([pathExists(vectorPath), pathExists(indexPath)]);

  let chunkCount = 0;
  let bytes = 0;
  if (exists) {
    const file = await import("node:fs/promises").then((fs) => fs.stat(vectorPath));
    bytes = file.size;
  }

  if (indexExists) {
    try {
      const indexRaw = await import("node:fs/promises").then((fs) => fs.readFile(indexPath, "utf8"));
      const parsed = JSON.parse(indexRaw) as { chunk_count?: number; chunks?: unknown[] };
      chunkCount = parsed.chunk_count ?? parsed.chunks?.length ?? 0;
    } catch {
      chunkCount = 0;
    }
  }

  return {
    source_type: sourceType,
    file_name: fileName,
    index_file_name: indexFileName,
    exists,
    index_exists: indexExists,
    chunk_count: chunkCount,
    bytes,
  };
}
