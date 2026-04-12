import { assertAllowedWrittenAnswerUrl } from "./url-policy.js";

const CATEGORY_INDEX_PATTERN =
  /https:\/\/www\.nta\.go\.jp\/law\/bunshokaito\/[a-z0-9-]+\/\d{1,2}\.htm$/giu;
const DOCUMENT_PAGE_PATTERN =
  /https:\/\/www\.nta\.go\.jp\/law\/bunshokaito\/([a-z0-9-]+)\/(.+?)\.htm$/giu;

export async function discoverWrittenAnswerIndexPages({
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
        urls.add(assertAllowedWrittenAnswerUrl(value).toString());
      }

      CATEGORY_INDEX_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}

export function extractWrittenAnswerLinks(html: string, baseUrl: string) {
  const urls = new Set<string>();
  const category = extractCategoryFromBaseUrl(baseUrl);

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
        new URL(value).pathname.startsWith(`/law/bunshokaito/${category}/`) &&
        !isCategoryIndexPath(new URL(value).pathname) &&
        !value.includes("/besshi") &&
        !value.includes("/tokusetsu")
      ) {
        urls.add(assertAllowedWrittenAnswerUrl(value).toString());
      }

      DOCUMENT_PAGE_PATTERN.lastIndex = 0;
    } catch {
      continue;
    }
  }

  return [...urls].sort((left, right) => left.localeCompare(right, "ja"));
}

function isCategoryIndexPath(pathname: string) {
  return /^\/law\/bunshokaito\/[a-z0-9-]+\/\d{1,2}(?:_1)?\.htm$/iu.test(pathname);
}

function extractCategoryFromBaseUrl(baseUrl: string) {
  const match = new URL(baseUrl).pathname.match(/^\/law\/bunshokaito\/([a-z0-9-]+)\//iu);

  if (!match) {
    throw new Error(`Unexpected written_answer category baseUrl: ${baseUrl}`);
  }

  return match[1];
}
