import { z } from "zod";

import { EgovRepository, type FetchLike } from "../repository/egov-repository.js";

export const getLawInputSchema = z.object({
  law_name: z.string().min(1),
  article: z.string().optional(),
  paragraph: z.number().int().positive().optional(),
  item: z.number().int().positive().optional(),
  format: z.enum(["markdown", "toc"]).default("markdown"),
});

export const getLawOutputSchema = z.object({
  source_type: z.literal("law"),
  law_name: z.string(),
  article: z.string().nullable(),
  canonical_url: z.string().url(),
  content: z.string(),
  retrieved_at: z.string(),
});

export type GetLawInput = z.infer<typeof getLawInputSchema>;
export type GetLawOutput = z.infer<typeof getLawOutputSchema>;

type BuildGetLawResultOptions = {
  input: GetLawInput;
  repo: EgovRepository;
  fetch?: FetchLike;
};

/**
 * get_law — 法令名から本文を取得する
 *
 * 1. e-Gov API でキーワード検索 → law_id を取得
 * 2. law_id で法令本文を取得
 * 3. format に応じて markdown / toc を返す
 */
export async function buildGetLawResult({
  input,
  repo,
  fetch,
}: BuildGetLawResultOptions): Promise<GetLawOutput> {
  const searchResult = await repo.searchLaws(input.law_name, { limit: 10, fetch });

  if (searchResult.laws.length === 0) {
    throw new Error(`法令が見つかりません: ${input.law_name}`);
  }

  // 完全一致優先、なければ先頭
  const matched =
    searchResult.laws.find((l) => l.law_name === input.law_name) ?? searchResult.laws[0];

  const lawData = await repo.getLawData(matched.law_id, { fetch });

  const content =
    input.format === "toc" ? buildToc(lawData.content) : lawData.content;

  return {
    source_type: "law",
    law_name: lawData.law_name,
    article: input.article ?? null,
    canonical_url: `https://laws.e-gov.go.jp/law/${matched.law_id}`,
    content,
    retrieved_at: lawData.retrieved_at,
  };
}

/**
 * Markdown 本文から見出し行だけを抽出して目次を生成する
 */
function buildToc(markdown: string): string {
  const headings = markdown
    .split("\n")
    .filter((line) => line.startsWith("#"))
    .join("\n");
  return headings || markdown;
}
