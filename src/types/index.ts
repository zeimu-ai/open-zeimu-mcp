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

export type DocumentRecord = {
  id: string;
  sourceType: SourceType;
  title: string;
  path: string;
  updatedAt: string | null;
};
