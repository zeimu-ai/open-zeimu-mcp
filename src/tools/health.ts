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
