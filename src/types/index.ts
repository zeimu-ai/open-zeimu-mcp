export const SOURCE_TYPES = [
  "law",
  "tax_answer",
  "tsutatsu",
  "qa_case",
  "written_answer",
  "saiketsu",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export type SourceStat = {
  count: number;
  latest_crawled_at: string | null;
};

export type MetadataRecord = Record<string, unknown>;

export type DocumentRecord = {
  id: string;
  sourceType: SourceType;
  title: string;
  path: string;
  updatedAt: string | null;
};

export type LoadedDocument = {
  id: string;
  sourceType: SourceType;
  title: string;
  category: string | null;
  canonicalUrl: string;
  path: string;
  metadataPath: string | null;
  body: string;
  headings: string[];
  aliases: string[];
  metadata: MetadataRecord;
  crawledAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  contentHash: string | null;
  license: string | null;
  version: number | null;
  pageOffsets: number[];
  pageCount: number;
};
