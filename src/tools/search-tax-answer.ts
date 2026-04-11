import { z } from "zod";

import type { LexicalIndex } from "../search/lexical-index.js";

export const searchTaxAnswerInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export const searchTaxAnswerOutputSchema = z.object({
  source_type: z.literal("tax_answer"),
  query: z.string(),
  total_count: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      id: z.string(),
      source_type: z.literal("tax_answer"),
      title: z.string(),
      score: z.number(),
      snippet: z.string(),
    }),
  ),
});

export type SearchTaxAnswerInput = z.infer<typeof searchTaxAnswerInputSchema>;
export type SearchTaxAnswerOutput = z.infer<typeof searchTaxAnswerOutputSchema>;

export function buildSearchTaxAnswerResult({
  lexicalIndex,
  input,
}: {
  lexicalIndex: LexicalIndex;
  input: SearchTaxAnswerInput;
}): SearchTaxAnswerOutput {
  const result = lexicalIndex.search({
    query: input.query,
    sourceTypes: ["tax_answer"],
    limit: input.limit,
  });

  return {
    source_type: "tax_answer",
    query: input.query,
    total_count: result.hits.length,
    results: result.hits.map((hit) => ({
      id: hit.id,
      source_type: "tax_answer",
      title: hit.title,
      score: hit.score,
      snippet: hit.snippet,
    })),
  };
}
