const ALLOWLIST_HOSTS = new Set(["www.kfs.go.jp"]);

export function assertAllowedSaiketsuUrl(input: string): URL {
  const url = new URL(input);

  if (!ALLOWLIST_HOSTS.has(url.hostname)) {
    throw new Error(`Disallowed host: ${url.hostname}`);
  }

  if (
    !url.pathname.startsWith("/service/MP/01/") &&
    !url.pathname.startsWith("/service/JP/")
  ) {
    throw new Error(`Disallowed path: ${url.pathname}`);
  }

  return url;
}

export function toAbsoluteSaiketsuUrl(href: string, base: string) {
  const url = new URL(href, base);
  return assertAllowedSaiketsuUrl(url.toString()).toString();
}
