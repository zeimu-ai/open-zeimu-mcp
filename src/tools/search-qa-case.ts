import { z } from "zod";

import type { LexicalIndex } from "../search/lexical-index.js";
import type { LoadedDocument } from "../types/index.js";
import { findSearchDocumentOrThrow, getStringMetadata } from "./document-utils.js";

export const searchQaCaseInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export const searchQaCaseOutputSchema = z.object({
  source_type: z.literal("qa_case"),
  query: z.string(),
  total_count: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      id: z.string(),
      source_type: z.literal("qa_case"),
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

export type SearchQaCaseInput = z.infer<typeof searchQaCaseInputSchema>;
export type SearchQaCaseOutput = z.infer<typeof searchQaCaseOutputSchema>;

export function buildSearchQaCaseResult({
  lexicalIndex,
  documents,
  input,
}: {
  lexicalIndex: LexicalIndex;
  documents: LoadedDocument[];
  input: SearchQaCaseInput;
}): SearchQaCaseOutput {
  const result = lexicalIndex.search({
    query: input.query,
    sourceTypes: ["qa_case"],
    limit: input.limit,
  });

  return {
    source_type: "qa_case",
    query: input.query,
    total_count: result.hits.length,
    results: result.hits.map((hit) => {
      const document = findSearchDocumentOrThrow({
        documents,
        sourceType: "qa_case",
        id: hit.id,
        label: "質疑応答事例",
      });

      return {
        id: hit.id,
        source_type: "qa_case" as const,
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
