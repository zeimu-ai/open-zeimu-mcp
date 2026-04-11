import { z } from "zod";

import type { LexicalIndex } from "../search/lexical-index.js";
import type { LoadedDocument } from "../types/index.js";
import { buildPageHint, getStringMetadata } from "./document-utils.js";

export const searchWrittenAnswerInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export const searchWrittenAnswerOutputSchema = z.object({
  source_type: z.literal("written_answer"),
  query: z.string(),
  total_count: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      id: z.string(),
      source_type: z.literal("written_answer"),
      title: z.string(),
      category: z.string().nullable(),
      canonical_url: z.string().url(),
      citation: z.string().nullable(),
      score: z.number(),
      snippet: z.string(),
      updated_at: z.string().nullable(),
      license: z.string().nullable(),
      page_hint: z.string().nullable(),
    }),
  ),
});

export type SearchWrittenAnswerInput = z.infer<typeof searchWrittenAnswerInputSchema>;
export type SearchWrittenAnswerOutput = z.infer<typeof searchWrittenAnswerOutputSchema>;

export function buildSearchWrittenAnswerResult({
  lexicalIndex,
  documents,
  input,
}: {
  lexicalIndex: LexicalIndex;
  documents: LoadedDocument[];
  input: SearchWrittenAnswerInput;
}): SearchWrittenAnswerOutput {
  const result = lexicalIndex.search({
    query: input.query,
    sourceTypes: ["written_answer"],
    limit: input.limit,
  });

  return {
    source_type: "written_answer",
    query: input.query,
    total_count: result.hits.length,
    results: result.hits.map((hit) => {
      const document = documents.find(
        (candidate) => candidate.sourceType === "written_answer" && candidate.id === hit.id,
      );

      if (!document) {
        throw new Error(`文書回答事例の検索結果が本文データと一致しません: ${hit.id}`);
      }

      return {
        id: hit.id,
        source_type: "written_answer" as const,
        title: hit.title,
        category: document.category,
        canonical_url: document.canonicalUrl,
        citation: getStringMetadata(document, "citation"),
        score: hit.score,
        snippet: hit.snippet,
        updated_at: document.updatedAt,
        license: document.license,
        page_hint: buildPageHint(document.pageOffsets, resolveMatchOffset(document, input.query, hit)),
      };
    }),
  };
}

function resolveMatchOffset(
  document: LoadedDocument,
  query: string,
  hit: { snippet: string; match_offset?: number },
) {
  const directQueryIndex = document.body.indexOf(query);
  if (directQueryIndex >= 0) {
    return directQueryIndex;
  }

  const normalizedSnippet = hit.snippet.replace(/\s+/gu, " ").trim();
  if (normalizedSnippet) {
    const directSnippetIndex = document.body.indexOf(normalizedSnippet);
    if (directSnippetIndex >= 0) {
      return directSnippetIndex;
    }
  }

  return hit.match_offset;
}
