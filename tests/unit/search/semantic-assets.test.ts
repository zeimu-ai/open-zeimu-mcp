import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Env } from "../../../src/config/env.js";
import {
  inspectVectorAssets,
  loadSemanticBackend,
} from "../../../src/search/semantic-assets.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("semantic-assets", () => {
  it("reports disabled state when embeddings are off", async () => {
    const env = makeEnv();

    await expect(inspectVectorAssets({ env, version: "0.1.0-alpha.0" })).resolves.toEqual({
      backend: "none",
      status: "disabled",
      root_dir: env.vectorsCacheDir,
      version_dir: `${env.vectorsCacheDir}/0.1.0-alpha.0`,
      runtime_package: "onnxruntime-node",
      model_asset: {
        file_name: "bge-m3-int8.onnx.tar.gz",
        exists: false,
      },
      vector_asset: {
        file_name: "tax-answer-vectors-0.1.0-alpha.0.bin",
        exists: false,
      },
      ready: false,
      missing: [],
      reason: "EMBEDDING_BACKEND=none",
    });
  });

  it("reports missing local assets and runtime fallback", async () => {
    const root = await makeTempDir();
    const env = makeEnv({
      embeddingBackend: "local",
      vectorsCacheDir: join(root, "vectors"),
    });

    await mkdir(join(env.vectorsCacheDir, "0.1.0-alpha.0"), { recursive: true });

    const assets = await inspectVectorAssets({ env, version: "0.1.0-alpha.0" });
    expect(assets.status).toBe("missing_assets");
    expect(assets.missing).toEqual(["bge-m3-int8.onnx.tar.gz", "tax-answer-vectors-0.1.0-alpha.0.bin"]);

    const backend = await loadSemanticBackend({ env, version: "0.1.0-alpha.0" });
    expect(backend).toMatchObject({
      backend: "local",
      status: "fallback",
      reason: "missing_assets",
      runtime_available: false,
    });
    expect(backend.assets.ready).toBe(false);
  });

  it("reports stubbed supabase backend", async () => {
    const env = makeEnv({
      embeddingBackend: "supabase",
    });

    await expect(loadSemanticBackend({ env, version: "0.1.0-alpha.0" })).resolves.toMatchObject({
      backend: "supabase",
      status: "stub",
      reason: "not_implemented",
      runtime_available: false,
    });
  });

  it("marks local assets ready when both release artifacts exist", async () => {
    const root = await makeTempDir();
    const env = makeEnv({
      embeddingBackend: "local",
      vectorsCacheDir: join(root, "vectors"),
    });
    const versionDir = join(env.vectorsCacheDir, "0.1.0-alpha.0");

    await mkdir(versionDir, { recursive: true });
    await writeFile(join(versionDir, "bge-m3-int8.onnx.tar.gz"), "placeholder", "utf8");
    await writeFile(join(versionDir, "tax-answer-vectors-0.1.0-alpha.0.bin"), "placeholder", "utf8");

    await expect(inspectVectorAssets({ env, version: "0.1.0-alpha.0" })).resolves.toMatchObject({
      backend: "local",
      status: "ready",
      ready: true,
      missing: [],
    });
  });
});

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    embeddingBackend: "none",
    logLevel: "info",
    dataDir: "./data",
    vectorsCacheDir: "~/.cache/open-zeimu-mcp/vectors",
    onnxModelFileName: "bge-m3-int8.onnx.tar.gz",
    ...overrides,
  };
}

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-semantic-"));
  createdDirs.push(dir);
  return dir;
}
