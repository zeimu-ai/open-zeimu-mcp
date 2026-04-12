import { assertAllowedTsutatsuUrl } from "./url-policy.js";

const CATEGORY_INDEX_PATTERN =
  /https:\/\/www\.nta\.go\.jp\/law\/tsutatsu\/kihon\/[a-z0-9_-]+\/01\.htm/giu;
const DOCUMENT_PAGE_PATTERN =
  /https:\/\/www\.nta\.go\.jp\/law\/tsutatsu\/kihon\/([a-z0-9_-]+)\/(.+?)\.htm/giu;

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

  for (const match of html.matchAll(/href="([^"]+)"/giu)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl);
      url.hash = "";
      const value = url.toString();

      if (
        DOCUMENT_PAGE_PATTERN.test(value) &&
        !value.match(/\/law\/tsutatsu\/kihon\/[a-z0-9_-]+\/01\.htm$/iu)
      ) {
        urls.add(assertAllowedTsutatsuUrl(value).toString());
      }

      DOCUMENT_PAGE_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}
