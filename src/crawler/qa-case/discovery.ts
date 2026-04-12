import { assertAllowedQaCaseUrl } from "./url-policy.js";

const CATEGORY_INDEX_PATTERNS = [
  /^https:\/\/www\.nta\.go\.jp\/law\/shitsugi\/[a-z0-9_-]+\/01\.htm$/u,
  /^https:\/\/www\.nta\.go\.jp\/taxes\/sake\/qa\/01\.htm$/u,
];

const CASE_PAGE_PATTERNS = [
  /^https:\/\/www\.nta\.go\.jp\/law\/shitsugi\/[a-z0-9_-]+\/[0-9]{2}\/[0-9]{2}\.htm$/u,
  /^https:\/\/www\.nta\.go\.jp\/law\/shitsugi\/hotei\/[0-9]{1,2}\/[0-9]{2}\.htm$/u,
  /^https:\/\/www\.nta\.go\.jp\/taxes\/sake\/qa\/[0-9]{2}\/[0-9]{2}\.htm$/u,
];

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
      const value = `${url.origin}${url.pathname}`;

      if (CATEGORY_INDEX_PATTERNS.some((pattern) => pattern.test(value))) {
        urls.add(assertAllowedQaCaseUrl(value).toString());
      }
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
      const value = `${url.origin}${url.pathname}`;

      if (CASE_PAGE_PATTERNS.some((pattern) => pattern.test(value))) {
        urls.add(assertAllowedQaCaseUrl(value).toString());
      }
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}
