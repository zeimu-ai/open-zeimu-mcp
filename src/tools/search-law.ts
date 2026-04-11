import { z } from "zod";

import { EgovRepository, type FetchLike } from "../repository/egov-repository.js";

export const searchLawInputSchema = z.object({
  query: z.string().min(1),
  law_type: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

export const searchLawOutputSchema = z.object({
  source_type: z.literal("law"),
  query: z.string(),
  total_count: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      law_id: z.string(),
      law_name: z.string(),
      law_num: z.string(),
      law_type: z.string(),
      promulgation_date: z.string(),
      canonical_url: z.string().url(),
    }),
  ),
});

export type SearchLawInput = z.infer<typeof searchLawInputSchema>;
export type SearchLawOutput = z.infer<typeof searchLawOutputSchema>;

type BuildSearchLawResultOptions = {
  input: SearchLawInput;
  repo: EgovRepository;
  fetch?: FetchLike;
};

/**
 * search_law — キーワードで法令を検索する
 *
 * e-Gov API: GET /api/2/laws?keyword=...&limit=...
 */
export async function buildSearchLawResult({
  input,
  repo,
  fetch,
}: BuildSearchLawResultOptions): Promise<SearchLawOutput> {
  const searchResult = await repo.searchLaws(input.query, {
    limit: input.limit,
    fetch,
  });

  const results = searchResult.laws
    .filter((l) => !input.law_type || l.law_type === input.law_type)
    .map((l) => ({
      law_id: l.law_id,
      law_name: l.law_name,
      law_num: l.law_num,
      law_type: l.law_type,
      promulgation_date: l.promulgation_date,
      canonical_url: `https://laws.e-gov.go.jp/law/${l.law_id}`,
    }));

  return {
    source_type: "law",
    query: input.query,
    total_count: searchResult.total_count,
    results,
  };
}
