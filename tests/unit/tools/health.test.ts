import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Env } from "../../../src/config/env.js";
import { buildHealthResult } from "../../../src/tools/health.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => {
      await import("node:fs/promises").then(({ rm }) =>
        rm(dir, { recursive: true, force: true }),
      );
    }),
  );
});

describe("buildHealthResult", () => {
  it("reports ok with disabled vectors when embedding is none", async () => {
    const root = await makeTempDir();
    const env = makeEnv({
      dataDir: join(root, "data"),
    });

    await mkdir(env.dataDir, { recursive: true });

    const result = await buildHealthResult({
      env,
      version: "0.0.0",
      startedAt: 1000,
      now: () => 7000,
    });

    expect(result).toEqual({
      status: "ok",
      version: "0.0.0",
      uptime: 6,
      checks: {
        data_dir: true,
        vectors: "disabled",
      },
    });
  });

  it("checks vector directory when embeddings are enabled", async () => {
    const root = await makeTempDir();
    const env = makeEnv({
      embeddingBackend: "local",
      dataDir: join(root, "data"),
      vectorsCacheDir: join(root, "vectors"),
    });

    await mkdir(env.dataDir, { recursive: true });
    await mkdir(env.vectorsCacheDir, { recursive: true });

    const result = await buildHealthResult({
      env,
      version: "0.1.0",
      startedAt: 500,
      now: () => 3500,
    });

    expect(result.checks).toEqual({
      data_dir: true,
      vectors: true,
    });
    expect(result.uptime).toBe(3);
  });

  it("returns false checks when directories are missing", async () => {
    const root = await makeTempDir();
    const env = makeEnv({
      embeddingBackend: "supabase",
      dataDir: join(root, "missing-data"),
      vectorsCacheDir: join(root, "missing-vectors"),
    });

    const result = await buildHealthResult({
      env,
      version: "0.1.0",
      startedAt: 0,
      now: () => 1200,
    });

    expect(result.checks).toEqual({
      data_dir: false,
      vectors: false,
    });
  });
});

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    embeddingBackend: "none",
    logLevel: "info",
    dataDir: "./data",
    vectorsCacheDir: "~/.cache/open-zeimu-mcp/vectors",
    ...overrides,
  };
}

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-health-"));
  createdDirs.push(dir);
  return dir;
}
