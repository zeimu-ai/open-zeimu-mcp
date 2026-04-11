import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";

export const listTaxAnswerCategoriesInputSchema = z.object({});

export const listTaxAnswerCategoriesOutputSchema = z.object({
  source_type: z.literal("tax_answer"),
  total_count: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      category: z.string(),
      document_count: z.number().int().positive(),
      latest_crawled_at: z.string().nullable(),
    }),
  ),
});

export type ListTaxAnswerCategoriesOutput = z.infer<typeof listTaxAnswerCategoriesOutputSchema>;

export function buildListTaxAnswerCategoriesResult({
  documents,
}: {
  documents: LoadedDocument[];
}): ListTaxAnswerCategoriesOutput {
  const categories = new Map<
    string,
    {
      category: string;
      document_count: number;
      latest_crawled_at: string | null;
    }
  >();

  for (const document of documents) {
    if (document.sourceType !== "tax_answer" || !document.category) {
      continue;
    }

    const current = categories.get(document.category) ?? {
      category: document.category,
      document_count: 0,
      latest_crawled_at: null,
    };

    current.document_count += 1;
    if (
      document.crawledAt &&
      (!current.latest_crawled_at || document.crawledAt > current.latest_crawled_at)
    ) {
      current.latest_crawled_at = document.crawledAt;
    }

    categories.set(document.category, current);
  }

  return {
    source_type: "tax_answer",
    total_count: categories.size,
    categories: [...categories.values()].sort((left, right) =>
      left.category.localeCompare(right.category, "ja"),
    ),
  };
}
