import { z } from "zod";

import type { LoadedDocument } from "../types/index.js";
import {
  findDocumentById,
  getStringArrayMetadata,
  getStringMetadata,
} from "./document-utils.js";

export const getSaiketsuInputSchema = z.object({
  id: z.string().trim().min(1),
});

export const getSaiketsuOutputSchema = z.object({
  source_type: z.literal("saiketsu"),
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

export type GetSaiketsuInput = z.infer<typeof getSaiketsuInputSchema>;
export type GetSaiketsuOutput = z.infer<typeof getSaiketsuOutputSchema>;

export async function buildGetSaiketsuResult({
  input,
  documents,
}: {
  input: GetSaiketsuInput;
  documents: LoadedDocument[];
}): Promise<GetSaiketsuOutput> {
  const matched = findDocumentById({
    documents,
    sourceType: "saiketsu",
    id: input.id,
  });

  if (!matched) {
    throw new Error(`裁決事例が見つかりません: ${input.id}`);
  }

  return {
    source_type: "saiketsu",
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
