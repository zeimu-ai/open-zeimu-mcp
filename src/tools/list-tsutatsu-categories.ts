import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";
import { buildCategorySummaries } from "./document-utils.js";

export const listTsutatsuCategoriesInputSchema = z.object({});

export const listTsutatsuCategoriesOutputSchema = z.object({
  source_type: z.literal("tsutatsu"),
  total_count: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      category: z.string(),
      document_count: z.number().int().positive(),
      latest_crawled_at: z.string().nullable(),
    }),
  ),
});

export type ListTsutatsuCategoriesOutput = z.infer<typeof listTsutatsuCategoriesOutputSchema>;

export function buildListTsutatsuCategoriesResult({
  documents,
}: {
  documents: LoadedDocument[];
}): ListTsutatsuCategoriesOutput {
  const categories = buildCategorySummaries({
    documents,
    sourceType: "tsutatsu",
  });

  return {
    source_type: "tsutatsu",
    total_count: categories.length,
    categories,
  };
}
