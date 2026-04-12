import { z } from "zod";

import type { LexicalIndex } from "../search/lexical-index.js";
import type { LoadedDocument } from "../types/index.js";
import { findSearchDocumentOrThrow, getStringMetadata } from "./document-utils.js";

export const searchSaiketsuInputSchema = z.object({
  query: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(20),
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

export function buildSearchSaiketsuResult({
  lexicalIndex,
  documents,
  input,
}: {
  lexicalIndex: LexicalIndex;
  documents: LoadedDocument[];
  input: SearchSaiketsuInput;
}): SearchSaiketsuOutput {
  const result = lexicalIndex.search({
    query: input.query,
    sourceTypes: ["saiketsu"],
    category: input.category,
    limit: input.limit,
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
