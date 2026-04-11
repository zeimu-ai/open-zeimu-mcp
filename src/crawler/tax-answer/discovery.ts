import { assertAllowedTaxAnswerUrl } from "./url-policy.js";

const TAX_ANSWER_PAGE_PATTERN =
  /https:\/\/www\.nta\.go\.jp\/taxes\/shiraberu\/taxanswer\/[^/]+\/[0-9][0-9-]*\.htm/gu;

export function extractTaxAnswerLinks(html: string, baseUrl: string) {
  const urls = new Set<string>();

  for (const match of html.matchAll(/href="([^"]+)"/giu)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl);

      if (TAX_ANSWER_PAGE_PATTERN.test(url.toString())) {
        urls.add(assertAllowedTaxAnswerUrl(url.toString()).toString());
      }

      TAX_ANSWER_PAGE_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}

export function extractTaxAnswerSeedPages(html: string, baseUrl: string) {
  const urls = new Set<string>([
    "https://www.nta.go.jp/taxes/shiraberu/taxanswer/code/index.htm",
  ]);

  for (const match of html.matchAll(/href="([^"]+)"/giu)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    const url = new URL(href, baseUrl);

    if (
      url.pathname.startsWith("/taxes/shiraberu/taxanswer/code/bunya-") &&
      url.pathname.endsWith(".htm")
    ) {
      urls.add(url.toString());
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}
