import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import type { Env } from "../config/env.js";
import type { LexicalIndex } from "../search/lexical-index.js";
import { inspectVectorAssets } from "../search/semantic-assets.js";
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
    semantic_ready: z.boolean(),
    vectors_loaded: z.boolean(),
    loaded_sources: z.array(z.enum(["law", "tax_answer", "tsutatsu", "qa_case", "written_answer", "saiketsu"])),
    total_chunks: z.number().int().nonnegative(),
    total_bytes: z.number().int().nonnegative(),
  }),
});

export type StatsResult = z.infer<typeof statsOutputSchema>;

export async function buildStatsResult({
  env,
  lexicalIndex,
  version = "0.0.0",
}: {
  env: Env;
  lexicalIndex?: LexicalIndex;
  version?: string;
}): Promise<StatsResult> {
  const sourceTypes = Object.fromEntries(
    await Promise.all(
      SOURCE_TYPES.map(async (sourceType) => {
        const directory = join(env.dataDir, sourceType);
        return [sourceType, await collectSourceStat(directory)] as const;
      }),
    ),
  ) as Record<(typeof SOURCE_TYPES)[number], SourceStat>;

  const vectorAssets = await inspectVectorAssets({ env, version });

  return {
    source_types: sourceTypes,
    lexical_index: {
      size: lexicalIndex?.size ?? 0,
      built_at: lexicalIndex?.builtAt ?? null,
    },
    semantic: {
      backend: env.embeddingBackend,
      semantic_ready: env.embeddingBackend === "local" ? vectorAssets.ready : false,
      vectors_loaded: env.embeddingBackend === "local" ? vectorAssets.total_chunks > 0 : false,
      loaded_sources: vectorAssets.loaded_sources,
      total_chunks: vectorAssets.total_chunks,
      total_bytes: vectorAssets.total_bytes,
    },
  };
}

async function collectSourceStat(directory: string): Promise<SourceStat> {
  const files = await listFiles(directory, {
    extensions: [".md"],
  });

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

async function listFiles(
  directory: string,
  options?: {
    extensions?: string[];
  },
): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(directory, entry.name);

        if (entry.isDirectory()) {
          return listFiles(entryPath, options);
        }

        if (entry.isFile()) {
          if (
            options?.extensions?.length &&
            !options.extensions.some((extension) => entry.name.endsWith(extension))
          ) {
            return [];
          }

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
