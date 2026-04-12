const ALLOWLIST_HOSTS = new Set(["www.nta.go.jp"]);
const ALLOWLIST_PATH_PREFIXES = ["/law/tsutatsu/kihon/", "/law/tsutatsu/kobetsu/"];

export function assertAllowedTsutatsuUrl(input: string): URL {
  const url = new URL(input);

  assertAllowedHost(url);

  if (
    !ALLOWLIST_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    url.pathname.includes("/kaisei/")
  ) {
    throw new Error(`Disallowed path: ${url.pathname}`);
  }

  return url;
}

export function toAbsoluteTsutatsuUrl(href: string, base: string): string {
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
