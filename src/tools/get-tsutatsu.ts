import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";
import {
  findDocumentById,
  getStringArrayMetadata,
  getStringMetadata,
} from "./document-utils.js";

export const getTsutatsuInputSchema = z.object({
  id: z.string().trim().min(1),
});

export const getTsutatsuOutputSchema = z.object({
  source_type: z.literal("tsutatsu"),
  id: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  canonical_url: z.string().url(),
  citation: z.string().nullable(),
  document_number: z.string().nullable(),
  content: z.string(),
  headings: z.array(z.string()),
  aliases: z.array(z.string()),
  tags: z.array(z.string()),
  updated_at: z.string().nullable(),
  published_at: z.string().nullable(),
  crawled_at: z.string().nullable(),
  license: z.string().nullable(),
});

export type GetTsutatsuInput = z.infer<typeof getTsutatsuInputSchema>;
export type GetTsutatsuOutput = z.infer<typeof getTsutatsuOutputSchema>;

export async function buildGetTsutatsuResult({
  input,
  documents,
}: {
  input: GetTsutatsuInput;
  documents: LoadedDocument[];
}): Promise<GetTsutatsuOutput> {
  const matched = findDocumentById({
    documents,
    sourceType: "tsutatsu",
    id: input.id,
  });

  if (!matched) {
    throw new Error(`通達が見つかりません: ${input.id}`);
  }

  return {
    source_type: "tsutatsu",
    id: matched.id,
    title: matched.title,
    category: matched.category,
    canonical_url: matched.canonicalUrl,
    citation: getStringMetadata(matched, "citation"),
    document_number: getStringMetadata(matched, "document_number"),
    content: matched.body,
    headings: matched.headings,
    aliases: matched.aliases,
    tags: getStringArrayMetadata(matched, "tags"),
    updated_at: matched.updatedAt,
    published_at: matched.publishedAt,
    crawled_at: matched.crawledAt,
    license: matched.license,
  };
}
