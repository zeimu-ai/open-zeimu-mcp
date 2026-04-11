import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";

export const getTaxAnswerInputSchema = z.object({
  id: z.string().trim().min(1),
});

export const getTaxAnswerOutputSchema = z.object({
  source_type: z.literal("tax_answer"),
  id: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  canonical_url: z.string().url(),
  citation: z.string().nullable(),
  content: z.string(),
  headings: z.array(z.string()),
  aliases: z.array(z.string()),
  tags: z.array(z.string()),
  updated_at: z.string().nullable(),
  published_at: z.string().nullable(),
  crawled_at: z.string().nullable(),
});

export type GetTaxAnswerInput = z.infer<typeof getTaxAnswerInputSchema>;
export type GetTaxAnswerOutput = z.infer<typeof getTaxAnswerOutputSchema>;

export async function buildGetTaxAnswerResult({
  input,
  documents,
}: {
  input: GetTaxAnswerInput;
  documents: LoadedDocument[];
}): Promise<GetTaxAnswerOutput> {
  const matched = documents.find(
    (document) => document.sourceType === "tax_answer" && document.id === input.id,
  );

  if (!matched) {
    throw new Error(`タックスアンサーが見つかりません: ${input.id}`);
  }

  return {
    source_type: "tax_answer",
    id: matched.id,
    title: matched.title,
    category: matched.category,
    canonical_url: matched.canonicalUrl,
    citation: getStringMetadata(matched, "citation"),
    content: matched.body,
    headings: matched.headings,
    aliases: matched.aliases,
    tags: getStringArrayMetadata(matched, "tags"),
    updated_at: matched.updatedAt,
    published_at: matched.publishedAt,
    crawled_at: matched.crawledAt,
  };
}

function getStringMetadata(document: LoadedDocument, key: string) {
  const value = document.metadata[key];
  return typeof value === "string" ? value : null;
}

function getStringArrayMetadata(document: LoadedDocument, key: string) {
  const value = document.metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
