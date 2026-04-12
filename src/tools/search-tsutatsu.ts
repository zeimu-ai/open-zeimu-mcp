import { z } from "zod";

import type { LexicalIndex } from "../search/lexical-index.js";
import type { SemanticSearchEngine } from "../search/semantic-engine.js";
import type { LoadedDocument } from "../types/index.js";
import { findSearchDocumentOrThrow, getStringMetadata } from "./document-utils.js";
import { runSourceSearch, searchModeSchema } from "./search-common.js";

export const searchTsutatsuInputSchema = z.object({
  query: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  search_mode: searchModeSchema,
});

export const searchTsutatsuOutputSchema = z.object({
  source_type: z.literal("tsutatsu"),
  query: z.string(),
  total_count: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      id: z.string(),
      source_type: z.literal("tsutatsu"),
      title: z.string(),
      category: z.string().nullable(),
      canonical_url: z.string().url(),
      citation: z.string().nullable(),
      score: z.number(),
      snippet: z.string(),
      updated_at: z.string().nullable(),
      license: z.string().nullable(),
    }),
  ),
});

export type SearchTsutatsuInput = z.infer<typeof searchTsutatsuInputSchema>;
export type SearchTsutatsuOutput = z.infer<typeof searchTsutatsuOutputSchema>;

export async function buildSearchTsutatsuResult({
  lexicalIndex,
  semanticEngine,
  documents,
  input,
}: {
  lexicalIndex: LexicalIndex;
  semanticEngine: SemanticSearchEngine;
  documents: LoadedDocument[];
  input: SearchTsutatsuInput;
}): Promise<SearchTsutatsuOutput> {
  const result = await runSourceSearch({
    lexicalIndex,
    semanticEngine,
    input,
    sourceType: "tsutatsu",
  });

  return {
    source_type: "tsutatsu",
    query: input.query,
    total_count: result.hits.length,
    results: result.hits.map((hit) => {
      const document = findSearchDocumentOrThrow({
        documents,
        sourceType: "tsutatsu",
        id: hit.id,
        label: "通達",
      });

      return {
        id: hit.id,
        source_type: "tsutatsu" as const,
        title: hit.title,
        category: document.category,
        canonical_url: document.canonicalUrl,
        citation: getStringMetadata(document, "citation"),
        score: hit.score,
        snippet: hit.snippet,
        updated_at: document.updatedAt,
        license: document.license,
      };
    }),
  };
}
