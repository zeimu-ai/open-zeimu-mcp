import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";
import { buildCategorySummaries } from "./document-utils.js";

export const listSaiketsuCategoriesInputSchema = z.object({});

export const listSaiketsuCategoriesOutputSchema = z.object({
  source_type: z.literal("saiketsu"),
  total_count: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      category: z.string(),
      document_count: z.number().int().positive(),
      latest_crawled_at: z.string().nullable(),
    }),
  ),
});

export type ListSaiketsuCategoriesOutput = z.infer<typeof listSaiketsuCategoriesOutputSchema>;

export function buildListSaiketsuCategoriesResult({
  documents,
}: {
  documents: LoadedDocument[];
}): ListSaiketsuCategoriesOutput {
  const categories = buildCategorySummaries({
    documents,
    sourceType: "saiketsu",
  });

  return {
    source_type: "saiketsu",
    total_count: categories.length,
    categories,
  };
}
