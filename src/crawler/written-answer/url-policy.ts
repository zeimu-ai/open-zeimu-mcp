const ALLOWLIST_HOSTS = new Set(["www.nta.go.jp"]);

export function assertAllowedWrittenAnswerUrl(input: string): URL {
  const url = new URL(input);

  if (!ALLOWLIST_HOSTS.has(url.hostname)) {
    throw new Error(`Disallowed host: ${url.hostname}`);
  }

  if (!url.pathname.startsWith("/law/bunshokaito/")) {
    throw new Error(`Disallowed path: ${url.pathname}`);
  }

  return url;
}

export function toAbsoluteWrittenAnswerUrl(href: string, base: string) {
  const url = new URL(href, base);
  return assertAllowedWrittenAnswerUrl(url.toString()).toString();
}
