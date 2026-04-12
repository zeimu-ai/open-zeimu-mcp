import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { z } from "zod";

import type { Env } from "../config/env.js";
import { inspectVectorAssets } from "../search/semantic-assets.js";

export const healthInputSchema = z.object({});

export const healthOutputSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  uptime: z.number().int().nonnegative(),
  checks: z.object({
    data_dir: z.boolean(),
    vectors: z.union([z.boolean(), z.literal("disabled")]),
  }),
  vector_assets: z.object({
    backend: z.enum(["none", "local", "supabase"]),
    status: z.enum(["disabled", "missing_assets", "ready", "stub"]),
    root_dir: z.string(),
    version_dir: z.string(),
    runtime_package: z.string(),
    tokenizer_asset: z.object({
      file_name: z.string(),
      exists: z.boolean(),
    }),
    tokenizer_config_asset: z.object({
      file_name: z.string(),
      exists: z.boolean(),
    }),
    model_asset: z.object({
      file_name: z.string(),
      exists: z.boolean(),
    }),
    vector_asset: z.object({
      file_name: z.string(),
      exists: z.boolean(),
    }),
    ready: z.boolean(),
    missing: z.array(z.string()),
    reason: z.string(),
    runtime_available: z.boolean(),
    latest_version: z.string().nullable(),
    total_chunks: z.number().int().nonnegative(),
    total_bytes: z.number().int().nonnegative(),
    loaded_sources: z.array(z.enum(["law", "tax_answer", "tsutatsu", "qa_case", "written_answer", "saiketsu"])),
    vector_indexes: z.array(
      z.object({
        source_type: z.enum(["law", "tax_answer", "tsutatsu", "qa_case", "written_answer", "saiketsu"]),
        file_name: z.string(),
        index_file_name: z.string(),
        exists: z.boolean(),
        index_exists: z.boolean(),
        chunk_count: z.number().int().nonnegative(),
        bytes: z.number().int().nonnegative(),
      }),
    ),
  }),
});

export type HealthResult = z.infer<typeof healthOutputSchema>;

type BuildHealthResultOptions = {
  env: Env;
  version: string;
  startedAt: number;
  now?: () => number;
};

export async function buildHealthResult({
  env,
  version,
  startedAt,
  now = Date.now,
}: BuildHealthResultOptions): Promise<HealthResult> {
  const vectorAssets = await inspectVectorAssets({ env, version });
  const checks = {
    data_dir: await pathExists(env.dataDir),
    vectors:
      env.embeddingBackend === "none"
        ? "disabled"
        : vectorAssets.ready,
  } as const;

  return {
    status: "ok",
    version,
    uptime: Math.max(0, Math.floor((now() - startedAt) / 1000)),
    checks,
    vector_assets: vectorAssets,
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
