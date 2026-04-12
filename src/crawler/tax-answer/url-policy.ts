const ALLOWLIST_HOSTS = new Set(["www.nta.go.jp", "www.keisan.nta.go.jp", "www.mof.go.jp"]);

export function assertAllowedTaxAnswerUrl(input: string): URL {
  const url = new URL(input);

  assertAllowedHost(url);

  if (!url.pathname.startsWith("/taxes/shiraberu/taxanswer/")) {
    throw new Error(`Disallowed path: ${url.pathname}`);
  }

  return url;
}

export function toAbsoluteTaxAnswerUrl(href: string, base: string): string {
  const url = new URL(href, base);
  assertAllowedHost(url);
  return url.toString();
}

function assertAllowedHost(url: URL) {
  if (!ALLOWLIST_HOSTS.has(url.hostname)) {
    throw new Error(`Disallowed host: ${url.hostname}`);
  }

  return url;
}
