import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Env } from "../../../src/config/env.js";
import { buildStatsResult } from "../../../src/tools/stats.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("buildStatsResult", () => {
  it("returns zeroed stats when data directory is missing", async () => {
    const root = await makeTempDir();
    const env = makeEnv({
      dataDir: join(root, "missing-data"),
    });

    const result = await buildStatsResult({ env });

    expect(result.source_types.tax_answer).toEqual({
      count: 0,
      latest_crawled_at: null,
    });
    expect(result.lexical_index).toEqual({
      size: 0,
      built_at: null,
    });
    expect(result.semantic).toEqual({
      backend: "none",
      vectors_loaded: false,
    });
  });

  it("counts files per source type and latest crawl timestamp", async () => {
    const root = await makeTempDir();
    const dataDir = join(root, "data");
    const env = makeEnv({ dataDir });

    const older = new Date("2026-04-01T00:00:00.000Z");
    const newer = new Date("2026-04-02T12:00:00.000Z");

    await writeFixture(join(dataDir, "tax_answer", "001.md"), older);
    await writeFixture(join(dataDir, "tax_answer", "nested", "002.md"), newer);
    await writeFixture(join(dataDir, "tsutatsu", "001.md"), older);

    const result = await buildStatsResult({ env });

    expect(result.source_types.tax_answer).toEqual({
      count: 2,
      latest_crawled_at: newer.toISOString(),
    });
    expect(result.source_types.tsutatsu).toEqual({
      count: 1,
      latest_crawled_at: older.toISOString(),
    });
    expect(result.source_types.qa_case.count).toBe(0);
    expect(result.lexical_index).toEqual({
      size: 0,
      built_at: null,
    });
  });

  it("reports vectors_loaded when local embeddings have cached files", async () => {
    const root = await makeTempDir();
    const env = makeEnv({
      embeddingBackend: "local",
      dataDir: join(root, "data"),
      vectorsCacheDir: join(root, "vectors"),
    });

    await mkdir(env.dataDir, { recursive: true });
    await writeFixture(join(env.vectorsCacheDir, "embeddings.json"), new Date());

    const result = await buildStatsResult({ env });

    expect(result.semantic).toEqual({
      backend: "local",
      vectors_loaded: true,
    });
  });

  it("includes lexical index metadata when an index is available", async () => {
    const env = makeEnv();

    const result = await buildStatsResult({
      env,
      lexicalIndex: {
        size: 12,
        builtAt: "2026-04-11T11:22:33.000Z",
        search: () => ({ hits: [] }),
      },
    });

    expect(result.lexical_index).toEqual({
      size: 12,
      built_at: "2026-04-11T11:22:33.000Z",
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
  const dir = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-stats-"));
  createdDirs.push(dir);
  return dir;
}

async function writeFixture(path: string, modifiedAt: Date) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, "fixture", "utf8");
  await import("node:fs/promises").then(({ utimes }) =>
    utimes(path, modifiedAt, modifiedAt),
  );
}
