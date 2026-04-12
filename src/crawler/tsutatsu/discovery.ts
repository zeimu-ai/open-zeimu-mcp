import { assertAllowedTsutatsuUrl } from "./url-policy.js";

const CATEGORY_INDEX_PATTERN =
  /https:\/\/www\.nta\.go\.jp\/law\/tsutatsu\/kihon\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/(?:01|00|index|mokuji)\.htm$/iu;
const DOCUMENT_PAGE_PATTERN =
  /https:\/\/www\.nta\.go\.jp\/law\/tsutatsu\/kihon\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/.+?\.htm$/iu;

export async function discoverTsutatsuIndexPages({
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
      url.hash = "";
      const value = url.toString();

      if (CATEGORY_INDEX_PATTERN.test(value)) {
        urls.add(assertAllowedTsutatsuUrl(value).toString());
      }

      CATEGORY_INDEX_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}

export function extractTsutatsuLinks(html: string, baseUrl: string) {
  const urls = new Set<string>();
  const basePathname = new URL(baseUrl).pathname;

  for (const match of html.matchAll(/href="([^"]+)"/giu)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl);
      url.hash = "";
      const value = url.toString();

      if (DOCUMENT_PAGE_PATTERN.test(value) && url.pathname !== basePathname) {
        urls.add(assertAllowedTsutatsuUrl(value).toString());
      }

      DOCUMENT_PAGE_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}
