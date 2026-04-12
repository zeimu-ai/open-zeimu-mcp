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

  let body = lawData.content;

  if (input.article) {
    const filtered = extractArticleSection(body, input.article, input.paragraph);
    if (filtered !== null) {
      body = filtered;
    }
  }

  const content = input.format === "toc" ? buildToc(body) : body;

  return {
    source_type: "law",
    law_name: lawData.law_name,
    article: input.article ?? null,
    canonical_url: `https://laws.e-gov.go.jp/law/${matched.law_id}`,
    content,
    retrieved_at: lawData.retrieved_at,
  };
}

const KANJI_DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/**
 * アラビア数字 → 法令用漢数字変換（1〜999対応）
 * "1" → "一", "10" → "十", "23" → "二十三", "100" → "百", "123" → "百二十三"
 */
function toKanjiNum(n: string): string {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) return n;

  const parts: string[] = [];
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;

  if (hundreds > 0) {
    parts.push(hundreds > 1 ? KANJI_DIGITS[hundreds] : "", "百");
  }
  if (tens > 0) {
    parts.push(tens > 1 ? KANJI_DIGITS[tens] : "", "十");
  }
  if (ones > 0) {
    parts.push(KANJI_DIGITS[ones]);
  }

  return parts.join("") || n;
}

/**
 * Markdown 本文から指定条の内容を抽出する
 * article: "1" → "第一条" を探す
 * paragraph: 1 → 該当項のみ返す（段落は条の中で1始まりの連番）
 * 見つからない場合は null（全体返却にフォールバック）
 */
function extractArticleSection(
  markdown: string,
  article: string,
  paragraph?: number,
): string | null {
  const kanjiArticle = `第${toKanjiNum(article)}条`;
  const lines = markdown.split("\n");

  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ") && line.includes(kanjiArticle)) {
      sectionStart = i;
    } else if (sectionStart >= 0 && line.startsWith("## ")) {
      sectionEnd = i;
      break;
    }
  }

  if (sectionStart < 0) {
    return null;
  }

  const sectionLines = lines.slice(sectionStart, sectionEnd);

  if (paragraph === undefined) {
    return sectionLines.join("\n").trim();
  }

  // 段落フィルタリング: 条見出し + 指定項の段落テキスト
  const heading = sectionLines[0];
  const contentLines = sectionLines.slice(1).join("\n").trim().split("\n\n");
  const paraText = contentLines[paragraph - 1];

  if (!paraText) {
    return sectionLines.join("\n").trim();
  }

  return `${heading}\n\n${paraText}`.trim();
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
