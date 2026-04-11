import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import type { Env } from "../config/env.js";
import { SOURCE_TYPES, type SourceStat } from "../types/index.js";

const sourceStatSchema = z.object({
  count: z.number().int().nonnegative(),
  latest_crawled_at: z.string().datetime().nullable(),
});

export const statsInputSchema = z.object({});

export const statsOutputSchema = z.object({
  source_types: z.object(
    Object.fromEntries(
      SOURCE_TYPES.map((sourceType) => [sourceType, sourceStatSchema]),
    ) as Record<(typeof SOURCE_TYPES)[number], typeof sourceStatSchema>,
  ),
  lexical_index: z.object({
    size: z.number().int().nonnegative(),
    built_at: z.string().datetime().nullable(),
  }),
  semantic: z.object({
    backend: z.enum(["none", "local", "supabase"]),
    vectors_loaded: z.boolean(),
  }),
});

export type StatsResult = z.infer<typeof statsOutputSchema>;

export async function buildStatsResult({
  env,
}: {
  env: Env;
}): Promise<StatsResult> {
  const sourceTypes = Object.fromEntries(
    await Promise.all(
      SOURCE_TYPES.map(async (sourceType) => {
        const directory = join(env.dataDir, sourceType);
        return [sourceType, await collectSourceStat(directory)] as const;
      }),
    ),
  ) as Record<(typeof SOURCE_TYPES)[number], SourceStat>;

  return {
    source_types: sourceTypes,
    lexical_index: {
      size: 0,
      built_at: null,
    },
    semantic: {
      backend: env.embeddingBackend,
      vectors_loaded:
        env.embeddingBackend === "none"
          ? false
          : await directoryHasFiles(env.vectorsCacheDir),
    },
  };
}

async function collectSourceStat(directory: string): Promise<SourceStat> {
  const files = await listFiles(directory);

  if (files.length === 0) {
    return {
      count: 0,
      latest_crawled_at: null,
    };
  }

  let latestTimestamp = 0;

  for (const file of files) {
    const metadata = await stat(file);
    const modifiedAt = metadata.mtime.getTime();

    if (modifiedAt > latestTimestamp) {
      latestTimestamp = modifiedAt;
    }
  }

  return {
    count: files.length,
    latest_crawled_at:
      latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null,
  };
}

async function directoryHasFiles(directory: string): Promise<boolean> {
  const files = await listFiles(directory);
  return files.length > 0;
}

async function listFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(directory, entry.name);

        if (entry.isDirectory()) {
          return listFiles(entryPath);
        }

        if (entry.isFile()) {
          return [entryPath];
        }

        return [];
      }),
    );

    return files.flat();
  } catch {
    return [];
  }
}
