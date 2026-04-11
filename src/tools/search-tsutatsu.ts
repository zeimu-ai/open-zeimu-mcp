import { z } from "zod";

import type { LexicalIndex } from "../search/lexical-index.js";
import type { LoadedDocument } from "../types/index.js";
import { findSearchDocumentOrThrow, getStringMetadata } from "./document-utils.js";

export const searchTsutatsuInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(50).default(20),
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

export function buildSearchTsutatsuResult({
  lexicalIndex,
  documents,
  input,
}: {
  lexicalIndex: LexicalIndex;
  documents: LoadedDocument[];
  input: SearchTsutatsuInput;
}): SearchTsutatsuOutput {
  const result = lexicalIndex.search({
    query: input.query,
    sourceTypes: ["tsutatsu"],
    limit: input.limit,
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
