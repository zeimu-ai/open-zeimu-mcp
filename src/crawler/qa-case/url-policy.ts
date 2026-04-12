const ALLOWLIST_HOSTS = new Set(["www.nta.go.jp"]);

export function assertAllowedQaCaseUrl(input: string): URL {
  const url = new URL(input);

  if (!ALLOWLIST_HOSTS.has(url.hostname)) {
    throw new Error(`Disallowed host: ${url.hostname}`);
  }

  if (!url.pathname.startsWith("/law/shitsugi/")) {
    throw new Error(`Disallowed path: ${url.pathname}`);
  }

  return url;
}

export function toAbsoluteQaCaseUrl(href: string, base: string) {
  const url = new URL(href, base);
  return assertAllowedQaCaseUrl(url.toString()).toString();
}
