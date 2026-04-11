import { z } from "zod";

import type { LexicalIndex, LexicalSearchResult } from "../search/lexical-index.js";
import { SOURCE_TYPES } from "../types/index.js";

export const lexicalSearchInputSchema = z.object({
  query: z.string().trim().min(1),
  source_types: z.array(z.enum(SOURCE_TYPES)).optional(),
  limit: z.number().int().positive().max(50).default(20),
});

export const lexicalSearchOutputSchema = z.object({
  hits: z.array(
    z.object({
      id: z.string(),
      source_type: z.enum(SOURCE_TYPES),
      title: z.string(),
      score: z.number(),
      snippet: z.string(),
    }),
  ),
});

export function buildLexicalSearchResult(result: LexicalSearchResult) {
  return result;
}

export function runLexicalSearch({
  lexicalIndex,
  input,
}: {
  lexicalIndex: LexicalIndex;
  input: z.infer<typeof lexicalSearchInputSchema>;
}) {
  return buildLexicalSearchResult(
    lexicalIndex.search({
      query: input.query,
      sourceTypes: input.source_types,
      limit: input.limit,
    }),
  );
}
