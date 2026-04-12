import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

import type { Env } from "../config/env.js";

const VECTOR_RUNTIME_PACKAGE = "onnxruntime-node";

export type VectorAssetsState = {
  backend: Env["embeddingBackend"];
  status: "disabled" | "missing_assets" | "ready" | "stub";
  root_dir: string;
  version_dir: string;
  runtime_package: string;
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
  const modelFileName = env.onnxModelFileName;
  const vectorFileName = `tax-answer-vectors-${version}.bin`;

  const modelExists = await pathExists(join(versionDir, modelFileName));
  const vectorExists = await pathExists(join(versionDir, vectorFileName));

  if (env.embeddingBackend === "none") {
    return {
      backend: "none",
      status: "disabled",
      root_dir: env.vectorsCacheDir,
      version_dir: versionDir,
      runtime_package: VECTOR_RUNTIME_PACKAGE,
      model_asset: {
        file_name: modelFileName,
        exists: modelExists,
      },
      vector_asset: {
        file_name: vectorFileName,
        exists: vectorExists,
      },
      ready: false,
      missing: [],
      reason: "EMBEDDING_BACKEND=none",
    };
  }

  if (env.embeddingBackend === "supabase") {
    return {
      backend: "supabase",
      status: "stub",
      root_dir: env.vectorsCacheDir,
      version_dir: versionDir,
      runtime_package: VECTOR_RUNTIME_PACKAGE,
      model_asset: {
        file_name: modelFileName,
        exists: modelExists,
      },
      vector_asset: {
        file_name: vectorFileName,
        exists: vectorExists,
      },
      ready: false,
      missing: [],
      reason: "supabase_backend_pending_v1",
    };
  }

  const missing = [
    ...(modelExists ? [] : [modelFileName]),
    ...(vectorExists ? [] : [vectorFileName]),
  ];

  return {
    backend: "local",
    status: missing.length === 0 ? "ready" : "missing_assets",
    root_dir: env.vectorsCacheDir,
    version_dir: versionDir,
    runtime_package: VECTOR_RUNTIME_PACKAGE,
    model_asset: {
      file_name: modelFileName,
      exists: modelExists,
    },
    vector_asset: {
      file_name: vectorFileName,
      exists: vectorExists,
    },
    ready: missing.length === 0,
    missing,
    reason: missing.length === 0 ? "assets_present" : "release_assets_missing",
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
