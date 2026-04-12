import { assertAllowedSaiketsuUrl } from "./url-policy.js";

const SECTION_PAGE_PATTERN = /https:\/\/www\.kfs\.go\.jp\/service\/MP\/01\/\d{10}\.html/gu;
const DOCUMENT_PAGE_PATTERN = /https:\/\/www\.kfs\.go\.jp\/service\/JP\/\d+\/\d+\/index\.html/gu;

export type SaiketsuDocumentLink = {
  url: string;
  citation: string;
  category: string;
  categoryCode: string;
};

export function discoverSaiketsuIndexPages({
  html,
  baseUrl,
}: {
  html: string;
  baseUrl: string;
}) {
  const urls = new Set<string>();

  for (const match of html.matchAll(/href="([^"]+)"/giu)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl);
      const value = url.toString();

      if (SECTION_PAGE_PATTERN.test(value)) {
        urls.add(assertAllowedSaiketsuUrl(value).toString());
      }

      SECTION_PAGE_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}

export function extractSaiketsuDocumentLinks({
  html,
  baseUrl,
  category,
  categoryCode,
}: {
  html: string;
  baseUrl: string;
  category: string;
  categoryCode: string;
}): SaiketsuDocumentLink[] {
  const documents = new Map<string, SaiketsuDocumentLink>();

  for (const match of html.matchAll(
    /<p[^>]*class="article_point"[^>]*>\s*(?:▼\s*)?<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/p>/giu,
  )) {
    const href = match[1];
    const citation = normalizeText(stripAllTags(match[2] ?? ""));

    if (!href || !citation) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl).toString();

      if (!DOCUMENT_PAGE_PATTERN.test(url)) {
        continue;
      }

      documents.set(url, {
        url: assertAllowedSaiketsuUrl(url).toString(),
        citation,
        category,
        categoryCode,
      });
      DOCUMENT_PAGE_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...documents.values()];
}

function stripAllTags(html: string) {
  return html.replace(/<[^>]+>/gu, "");
}

function normalizeText(value: string) {
  return value.replace(/\u00a0/gu, " ").replace(/[ \t]+/gu, " ").trim();
}
