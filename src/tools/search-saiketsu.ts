import { z } from "zod";

import type { LexicalIndex } from "../search/lexical-index.js";
import type { SemanticSearchEngine } from "../search/semantic-engine.js";
import type { LoadedDocument } from "../types/index.js";
import { findSearchDocumentOrThrow, getStringMetadata } from "./document-utils.js";
import { runSourceSearch, searchModeSchema } from "./search-common.js";

export const searchSaiketsuInputSchema = z.object({
  query: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  search_mode: searchModeSchema,
});

export const searchSaiketsuOutputSchema = z.object({
  source_type: z.literal("saiketsu"),
  query: z.string(),
  total_count: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      id: z.string(),
      source_type: z.literal("saiketsu"),
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

export type SearchSaiketsuInput = z.infer<typeof searchSaiketsuInputSchema>;
export type SearchSaiketsuOutput = z.infer<typeof searchSaiketsuOutputSchema>;

export async function buildSearchSaiketsuResult({
  lexicalIndex,
  semanticEngine,
  documents,
  input,
}: {
  lexicalIndex: LexicalIndex;
  semanticEngine: SemanticSearchEngine;
  documents: LoadedDocument[];
  input: SearchSaiketsuInput;
}): Promise<SearchSaiketsuOutput> {
  const result = await runSourceSearch({
    lexicalIndex,
    semanticEngine,
    input,
    sourceType: "saiketsu",
  });

  return {
    source_type: "saiketsu",
    query: input.query,
    total_count: result.hits.length,
    results: result.hits.map((hit) => {
      const document = findSearchDocumentOrThrow({
        documents,
        sourceType: "saiketsu",
        id: hit.id,
        label: "裁決事例",
      });

      return {
        id: hit.id,
        source_type: "saiketsu" as const,
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
