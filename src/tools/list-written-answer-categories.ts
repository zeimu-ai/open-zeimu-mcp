import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";
import { buildCategorySummaries } from "./document-utils.js";

export const listWrittenAnswerCategoriesInputSchema = z.object({});

export const listWrittenAnswerCategoriesOutputSchema = z.object({
  source_type: z.literal("written_answer"),
  total_count: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      category: z.string(),
      document_count: z.number().int().positive(),
      latest_crawled_at: z.string().nullable(),
    }),
  ),
});

export type ListWrittenAnswerCategoriesOutput = z.infer<
  typeof listWrittenAnswerCategoriesOutputSchema
>;

export function buildListWrittenAnswerCategoriesResult({
  documents,
}: {
  documents: LoadedDocument[];
}): ListWrittenAnswerCategoriesOutput {
  const categories = buildCategorySummaries({
    documents,
    sourceType: "written_answer",
  });

  return {
    source_type: "written_answer",
    total_count: categories.length,
    categories,
  };
}
