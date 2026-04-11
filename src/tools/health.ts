import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { z } from "zod";

import type { Env } from "../config/env.js";

export const healthInputSchema = z.object({});

export const healthOutputSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  uptime: z.number().int().nonnegative(),
  checks: z.object({
    data_dir: z.boolean(),
    vectors: z.union([z.boolean(), z.literal("disabled")]),
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
  const checks = {
    data_dir: await pathExists(env.dataDir),
    vectors:
      env.embeddingBackend === "none"
        ? "disabled"
        : await pathExists(env.vectorsCacheDir),
  } as const;

  return {
    status: "ok",
    version,
    uptime: Math.max(0, Math.floor((now() - startedAt) / 1000)),
    checks,
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
