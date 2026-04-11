import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";
import { findDocumentById, getStringMetadata } from "./document-utils.js";

export const getWrittenAnswerInputSchema = z.object({
  id: z.string().trim().min(1),
});

export const getWrittenAnswerOutputSchema = z.object({
  source_type: z.literal("written_answer"),
  id: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  canonical_url: z.string().url(),
  citation: z.string().nullable(),
  document_number: z.string().nullable(),
  content: z.string(),
  headings: z.array(z.string()),
  updated_at: z.string().nullable(),
  published_at: z.string().nullable(),
  crawled_at: z.string().nullable(),
  license: z.string().nullable(),
  page_count: z.number().int().nonnegative(),
});

export type GetWrittenAnswerInput = z.infer<typeof getWrittenAnswerInputSchema>;
export type GetWrittenAnswerOutput = z.infer<typeof getWrittenAnswerOutputSchema>;

export async function buildGetWrittenAnswerResult({
  input,
  documents,
}: {
  input: GetWrittenAnswerInput;
  documents: LoadedDocument[];
}): Promise<GetWrittenAnswerOutput> {
  const matched = findDocumentById({
    documents,
    sourceType: "written_answer",
    id: input.id,
  });

  if (!matched) {
    throw new Error(`文書回答事例が見つかりません: ${input.id}`);
  }

  return {
    source_type: "written_answer",
    id: matched.id,
    title: matched.title,
    category: matched.category,
    canonical_url: matched.canonicalUrl,
    citation: getStringMetadata(matched, "citation"),
    document_number: getStringMetadata(matched, "document_number"),
    content: matched.body,
    headings: matched.headings,
    updated_at: matched.updatedAt,
    published_at: matched.publishedAt,
    crawled_at: matched.crawledAt,
    license: matched.license,
    page_count: matched.pageCount,
  };
}
