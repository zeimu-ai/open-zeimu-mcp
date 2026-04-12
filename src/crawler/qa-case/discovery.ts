import { assertAllowedQaCaseUrl } from "./url-policy.js";

const CATEGORY_PAGE_PATTERN = /https:\/\/www\.nta\.go\.jp\/law\/shitsugi\/[a-z0-9_-]+\/01\.htm/gu;
const CASE_PAGE_PATTERN =
  /https:\/\/www\.nta\.go\.jp\/law\/shitsugi\/([a-z0-9_-]+)\/([0-9]{2})\/([0-9]{2})\.htm/gu;

export async function discoverQaCaseIndexPages({
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

      if (CATEGORY_PAGE_PATTERN.test(value) && !value.includes("/taxes/sake/qa/")) {
        urls.add(assertAllowedQaCaseUrl(value).toString());
      }

      CATEGORY_PAGE_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}

export function extractQaCaseLinks(html: string, baseUrl: string) {
  const urls = new Set<string>();

  for (const match of html.matchAll(/href="([^"]+)"/giu)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl);
      const value = url.toString();

      if (CASE_PAGE_PATTERN.test(value)) {
        urls.add(assertAllowedQaCaseUrl(value).toString());
      }

      CASE_PAGE_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}
