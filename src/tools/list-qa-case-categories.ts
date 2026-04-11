import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";
import { buildCategorySummaries } from "./document-utils.js";

export const listQaCaseCategoriesInputSchema = z.object({});

export const listQaCaseCategoriesOutputSchema = z.object({
  source_type: z.literal("qa_case"),
  total_count: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      category: z.string(),
      document_count: z.number().int().positive(),
      latest_crawled_at: z.string().nullable(),
    }),
  ),
});

export type ListQaCaseCategoriesOutput = z.infer<typeof listQaCaseCategoriesOutputSchema>;

export function buildListQaCaseCategoriesResult({
  documents,
}: {
  documents: LoadedDocument[];
}): ListQaCaseCategoriesOutput {
  const categories = buildCategorySummaries({
    documents,
    sourceType: "qa_case",
  });

  return {
    source_type: "qa_case",
    total_count: categories.length,
    categories,
  };
}
