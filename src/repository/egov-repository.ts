/**
 * EgovRepository — e-Gov 法令 API v2 クライアント + 24h in-memory cache
 *
 * セキュリティ設計:
 * - allowlist: laws.e-gov.go.jp のみ許可
 * - response は markdown/text のみ保持 (raw HTML 非保存)
 * - prompt injection 誘発文言なし (出典 metadata と本文を分離)
 * - cache は in-memory (メモリ使用量上限あり)
 */

const EGOV_API_BASE = "https://laws.e-gov.go.jp/api/2";
const EGOV_ALLOWED_HOST = "laws.e-gov.go.jp";
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_CACHE_MAX_ENTRIES = 500;

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class MemoryCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.entries.size >= this.maxEntries) {
      // Evict oldest entry (FIFO)
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }
}

// --- e-Gov API response types ---

type EgovLawInfo = {
  law_id: string;
  law_type: string;
  law_num: string;
  law_name: string;
  promulgation_date: string;
  updated_date: string;
};

type EgovLawsResponse = {
  total_count: number;
  offset: number;
  limit: number;
  laws: Array<{ law_info: EgovLawInfo }>;
};

type EgovParagraphSentence = {
  sentence: string | string[];
};

type EgovParagraph = {
  "@attributes"?: { num?: string };
  paragraph_num?: string;
  paragraph_sentence?: EgovParagraphSentence;
};

type EgovArticle = {
  "@attributes"?: { num?: string };
  article_title?: string;
  article_caption?: string;
  paragraph?: EgovParagraph | EgovParagraph[];
};

type EgovMainProvision = {
  article?: EgovArticle | EgovArticle[];
  chapter?: unknown;
};

type EgovLawBody = {
  law_title?: string;
  main_provision?: EgovMainProvision;
};

type EgovLawFullText = {
  "@attributes"?: {
    law_id?: string;
    law_type?: string;
    era?: string;
    year?: string;
    num?: string;
    promulgation_date?: string;
  };
  law_body?: EgovLawBody;
};

type EgovLawDataResponse = {
  law_full_text?: EgovLawFullText;
};

// --- Public output types ---

export type EgovLawSummary = {
  law_id: string;
  law_type: string;
  law_num: string;
  law_name: string;
  promulgation_date: string;
  updated_date: string;
  canonical_url: string;
};

export type EgovSearchResult = {
  total_count: number;
  laws: EgovLawSummary[];
};

export type EgovLawContent = {
  law_id: string;
  law_name: string;
  canonical_url: string;
  content: string;
  retrieved_at: string;
};

// --- Repository ---

export type EgovRepositoryOptions = {
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
};

type SearchOptions = {
  limit: number;
  fetch?: FetchLike;
  baseUrl?: string;
};

type GetLawOptions = {
  fetch?: FetchLike;
  baseUrl?: string;
};

export class EgovRepository {
  private readonly cacheTtlMs: number;
  private readonly searchCache: MemoryCache<EgovSearchResult>;
  private readonly lawCache: MemoryCache<EgovLawContent>;

  constructor(options: EgovRepositoryOptions = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const maxEntries = options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES;
    this.searchCache = new MemoryCache<EgovSearchResult>(maxEntries);
    this.lawCache = new MemoryCache<EgovLawContent>(maxEntries);
  }

  /**
   * 法令リストをキーワード検索する
   * e-Gov API: GET /api/2/laws?keyword=...&limit=...
   */
  async searchLaws(keyword: string, options: SearchOptions): Promise<EgovSearchResult> {
    const { limit, fetch: fetchFn = fetch, baseUrl = EGOV_API_BASE } = options;

    validateHost(baseUrl);

    const cacheKey = `search:${keyword}:${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const url = `${baseUrl}/laws?${new URLSearchParams({ keyword, limit: String(limit) })}`;
    const response = await fetchFn(url);

    if (!response.ok) {
      throw new Error(`e-Gov API エラー: ${response.status} (keyword=${keyword})`);
    }

    const raw = (await response.json()) as EgovLawsResponse;
    const result: EgovSearchResult = {
      total_count: raw.total_count ?? 0,
      laws: (raw.laws ?? []).map(({ law_info }) => ({
        law_id: law_info.law_id,
        law_type: law_info.law_type,
        law_num: law_info.law_num,
        law_name: law_info.law_name,
        promulgation_date: law_info.promulgation_date,
        updated_date: law_info.updated_date,
        canonical_url: `${EGOV_API_BASE}/law_data/${law_info.law_id}`,
      })),
    };

    this.searchCache.set(cacheKey, result, this.cacheTtlMs);
    return result;
  }

  /**
   * law_id で法令本文を取得する
   * e-Gov API: GET /api/2/law_data/{law_id}
   */
  async getLawData(lawId: string, options: GetLawOptions): Promise<EgovLawContent> {
    const { fetch: fetchFn = fetch, baseUrl = EGOV_API_BASE } = options;

    validateHost(baseUrl);

    const cached = this.lawCache.get(lawId);
    if (cached) return cached;

    const url = `${baseUrl}/law_data/${encodeURIComponent(lawId)}`;
    const response = await fetchFn(url);

    if (!response.ok) {
      throw new Error(`e-Gov API エラー: ${response.status} (law_id=${lawId})`);
    }

    const raw = (await response.json()) as EgovLawDataResponse;
    const fullText = raw.law_full_text;
    if (!fullText) {
      throw new Error(`法令データが取得できませんでした (law_id=${lawId})`);
    }

    const lawName = fullText.law_body?.law_title ?? lawId;
    const content = extractMarkdown(fullText);

    const result: EgovLawContent = {
      law_id: fullText["@attributes"]?.law_id ?? lawId,
      law_name: lawName,
      canonical_url: `https://laws.e-gov.go.jp/law/${lawId}`,
      content,
      retrieved_at: new Date().toISOString(),
    };

    this.lawCache.set(lawId, result, this.cacheTtlMs);
    return result;
  }
}

// --- helpers ---

function validateHost(baseUrl: string): void {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname !== EGOV_ALLOWED_HOST) {
      throw new Error(`不正なホスト: ${parsed.hostname} (allowlist: ${EGOV_ALLOWED_HOST})`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("不正なホスト")) throw err;
    throw new Error(`不正なホスト: ${baseUrl}`);
  }
}

/**
 * e-Gov API レスポンスから法令本文を Markdown テキストに変換する
 * - raw HTML は出力しない
 * - prompt injection 誘発文言は含めない (構造化データのみ出力)
 */
function extractMarkdown(fullText: EgovLawFullText): string {
  const lawBody = fullText.law_body;
  if (!lawBody) return "";

  const lines: string[] = [];

  if (lawBody.law_title) {
    lines.push(`# ${lawBody.law_title}`, "");
  }

  const mainProvision = lawBody.main_provision;
  if (mainProvision) {
    const articles = normalizeArray(mainProvision.article);
    for (const article of articles) {
      const title = article.article_title ?? "";
      const caption = article.article_caption ?? "";
      lines.push(`## ${title}${caption ? `　${caption}` : ""}`, "");

      const paragraphs = normalizeArray(article.paragraph);
      for (const para of paragraphs) {
        const sentence = extractSentence(para.paragraph_sentence);
        if (sentence) {
          lines.push(sentence, "");
        }
      }
    }
  }

  return lines.join("\n").trim();
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractSentence(
  ps: EgovParagraphSentence | undefined,
): string {
  if (!ps?.sentence) return "";
  const s = ps.sentence;
  if (typeof s === "string") return s;
  if (Array.isArray(s)) return s.join("");
  return "";
}
