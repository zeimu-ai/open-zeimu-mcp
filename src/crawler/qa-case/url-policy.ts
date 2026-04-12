const ALLOWLIST_HOSTS = new Set(["www.nta.go.jp"]);
const ALLOWLIST_PATH_PREFIXES = ["/law/shitsugi/", "/taxes/sake/qa/"];

export function assertAllowedQaCaseUrl(input: string): URL {
  const url = new URL(input);

  if (!ALLOWLIST_HOSTS.has(url.hostname)) {
    throw new Error(`Disallowed host: ${url.hostname}`);
  }

  if (!ALLOWLIST_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    throw new Error(`Disallowed path: ${url.pathname}`);
  }

  return url;
}

export function toAbsoluteQaCaseUrl(href: string, base: string) {
  const url = new URL(href, base);
  return assertAllowedQaCaseUrl(url.toString()).toString();
}
