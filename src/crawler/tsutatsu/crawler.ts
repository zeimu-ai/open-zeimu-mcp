import { join, relative } from "node:path";

import { commitAndPushChanges } from "../git-commit.js";
import { detectTsutatsuChange } from "./change-detector.js";
import { discoverTsutatsuIndexPages, extractTsutatsuLinks } from "./discovery.js";
import { parseTsutatsuPage } from "./parser.js";
import { FixedRateLimiter } from "./rate-limit.js";
import { TsutatsuRobotsPolicy } from "./robots.js";
import { TsutatsuSafety } from "./safety.js";
import {
  listStoredTsutatsuIds,
  readStoredTsutatsuDocument,
  writeTsutatsuDocument,
} from "./storage.js";
import { assertAllowedTsutatsuUrl } from "./url-policy.js";

type FetchResponse = {
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type RateLimiter = Pick<FixedRateLimiter, "wait">;
const MAJOR_CATEGORIES = ["shotoku", "hojin"] as const;
type MajorCategory = (typeof MAJOR_CATEGORIES)[number];

export type TsutatsuCrawlerOptions = {
  dataDir: string;
  repoDir: string;
  apply: boolean;
  dryRun: boolean;
  limit: number | null;
  ids: string[];
  logger: Pick<Console, "info" | "warn" | "error">;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  limiter?: RateLimiter;
};

export async function crawlTsutatsu(options: TsutatsuCrawlerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const limiter: RateLimiter = options.limiter ?? new FixedRateLimiter({ intervalMs: 2_000 });
  const safety = new TsutatsuSafety(join(options.repoDir, ".crawler/tsutatsu-state.json"));
  const state = await safety.assertRunAllowed();
  const robots = await fetchRobots({ fetchImpl, limiter });
  const logger = options.logger;
  const discoveredUrls = await discoverTsutatsuUrls({
    fetchImpl,
    limiter,
    robots,
    limit: options.ids.length > 0 ? null : options.limit,
  });
  const requestedIds = new Set(options.ids);
  const selectedUrls =
    requestedIds.size === 0
      ? discoveredUrls
      : discoveredUrls.filter((url) => requestedIds.has(inferTsutatsuId(url)));

  logger.info(
    `[tsutatsu] planned_documents=${selectedUrls.length} estimated_disk_bytes=${estimateDiskUsage(selectedUrls.length)}`,
  );

  const results: Array<{
    id: string;
    url: string;
    changed: boolean;
    created: boolean;
    version: number;
    reason: string;
    markdownPath: string | null;
    metadataPath: string | null;
  }> = [];

  try {
    for (const url of selectedUrls) {
      assertAllowedTsutatsuUrl(url);
      const crawledAt = now().toISOString();
      await limiter.wait();
      const response = (await fetchImpl(url)) as FetchResponse;

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      const html = await decodeHtmlResponse(response);
      const parsed = parseTsutatsuPage({ html, url, crawledAt });
      const current = await readStoredTsutatsuDocument(options.dataDir, parsed.document.id);
      const change = detectTsutatsuChange({
        current:
          current === null
            ? null
            : {
                id: current.id,
                contentHash: current.contentHash,
                eTag: current.eTag,
                lastModified: current.lastModified,
                version: current.version,
              },
        next: {
          id: parsed.document.id,
          contentHash: parsed.meta.content_hash,
          eTag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
        },
      });

      if (!change.changed) {
        results.push({
          id: parsed.document.id,
          url,
          changed: false,
          created: false,
          version: change.version,
          reason: change.reason,
          markdownPath: current?.markdownPath ?? null,
          metadataPath: current?.metadataPath ?? null,
        });
        continue;
      }

      let markdownPath: string | null = null;
      let metadataPath: string | null = null;

      if (!options.dryRun) {
        const written = await writeTsutatsuDocument({
          dataDir: options.dataDir,
          parsed,
          contentHash: parsed.meta.content_hash,
          crawledAt,
          version: change.version,
          eTag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
        });
        markdownPath = written.markdownPath;
        metadataPath = written.metadataPath;
      }

      results.push({
        id: parsed.document.id,
        url,
        changed: true,
        created: current === null,
        version: change.version,
        reason: change.reason,
        markdownPath,
        metadataPath,
      });
    }

    const existingIds = await listStoredTsutatsuIds(options.dataDir);
    const nextIds = new Set(results.map((result) => result.id));
    const deletedCount = existingIds.filter((id) => !nextIds.has(id)).length;

    safety.assertDeletionThreshold(deletedCount);
    safety.assertNoLargeCountDrop(state.lastSuccessfulCount, nextIds.size);

    const changedPaths = results
      .flatMap((result) => [result.markdownPath, result.metadataPath])
      .filter((path): path is string => path !== null)
      .map((path) => relative(options.repoDir, path));
    const updatedCount = results.filter((result) => result.changed && !result.created).length;
    const newCount = results.filter((result) => result.created).length;

    await commitAndPushChanges({
      repoDir: options.repoDir,
      paths: changedPaths,
      message: `tsutatsu: +${updatedCount} updated, +${newCount} new`,
      dryRun: options.dryRun || !options.apply,
    });
    await safety.recordSuccess({ count: nextIds.size, now: now().toISOString() });

    return {
      discoveredCount: selectedUrls.length,
      updatedCount,
      newCount,
      unchangedCount: results.filter((result) => !result.changed).length,
      results,
    };
  } catch (error) {
    await safety.recordFailure(now().toISOString());
    throw error;
  }
}

async function fetchRobots({
  fetchImpl,
  limiter,
}: {
  fetchImpl: typeof fetch;
  limiter: RateLimiter;
}) {
  await limiter.wait();
  const response = await fetchImpl("https://www.nta.go.jp/robots.txt");

  if (!response.ok) {
    throw new Error(`Failed to fetch robots.txt: ${response.status}`);
  }

  const robotsText = await response.text();
  return new TsutatsuRobotsPolicy(robotsText);
}

async function discoverTsutatsuUrls({
  fetchImpl,
  limiter,
  robots,
  limit,
}: {
  fetchImpl: typeof fetch;
  limiter: RateLimiter;
  robots: TsutatsuRobotsPolicy;
  limit: number | null;
}) {
  const rootUrl = "https://www.nta.go.jp/law/tsutatsu/menu.htm";

  if (!robots.isAllowed(new URL(rootUrl).pathname)) {
    throw new Error("robots.txt disallows tsutatsu root");
  }

  await limiter.wait();
  const rootResponse = (await fetchImpl(rootUrl)) as FetchResponse;

  if (!rootResponse.ok) {
    throw new Error(`Failed to fetch ${rootUrl}: ${rootResponse.status}`);
  }

  const rootHtml = await decodeHtmlResponse(rootResponse, "utf-8");
  const indexPages = (await discoverTsutatsuIndexPages({ html: rootHtml, baseUrl: rootUrl })).filter(
    (url): url is string => isMajorCategory(extractCategoryFromUrl(url)),
  );
  const documentsByCategory = new Map<string, string[]>();

  for (const indexPage of indexPages) {
    const pathname = new URL(indexPage).pathname;

    if (!robots.isAllowed(pathname)) {
      continue;
    }

    await limiter.wait();
    const response = (await fetchImpl(indexPage)) as FetchResponse;

    if (!response.ok) {
      throw new Error(`Failed to fetch ${indexPage}: ${response.status}`);
    }

    const html = await decodeHtmlResponse(response);

    for (const url of extractTsutatsuLinks(html, indexPage)) {
      if (robots.isAllowed(new URL(url).pathname)) {
        const category = extractCategoryFromUrl(url);

        if (!isMajorCategory(category)) {
          continue;
        }

        const current = documentsByCategory.get(category) ?? [];
        current.push(url);
        documentsByCategory.set(category, current);
      }
    }
  }

  for (const urls of documentsByCategory.values()) {
    urls.sort((left, right) => left.localeCompare(right, "ja"));
  }

  const orderedCategories = MAJOR_CATEGORIES.filter((category) => documentsByCategory.has(category));
  const discovered = orderedCategories.flatMap((category) => documentsByCategory.get(category) ?? []);

  if (limit === null) {
    return discovered;
  }

  const perCategoryLimit = Math.max(1, Math.ceil(limit / Math.max(1, orderedCategories.length)));
  const selected: string[] = [];

  for (const category of orderedCategories) {
    const urls = documentsByCategory.get(category) ?? [];
    selected.push(...urls.slice(0, perCategoryLimit));
  }

  if (selected.length > limit) {
    return selected.slice(0, limit);
  }

  if (selected.length < limit) {
    for (const category of orderedCategories) {
      if (selected.length >= limit) {
        break;
      }

      const urls = documentsByCategory.get(category) ?? [];
      for (let index = perCategoryLimit; index < urls.length && selected.length < limit; index += 1) {
        selected.push(urls[index]);
      }
    }
  }

  return selected.slice(0, limit);
}

async function decodeHtmlResponse(response: FetchResponse, fallbackCharset = "shift_jis") {
  const arrayBuffer = await response.arrayBuffer();
  const charset = response.headers.get("content-type")?.match(/charset=([^;]+)/iu)?.[1]?.trim();
  const decoder = new TextDecoder(charset ?? fallbackCharset);
  return decoder.decode(arrayBuffer);
}

function estimateDiskUsage(count: number) {
  return count * 8_192;
}

function inferTsutatsuId(url: string) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\/law\/tsutatsu\/kihon\/([^/]+)\/(.+)\.htm$/iu);

  if (!match) {
    throw new Error(`Unexpected tsutatsu url: ${url}`);
  }

  const category = match[1];
  const slug = match[2].replace(/\//gu, "-");
  return `tsutatsu-${category}-${slug}`;
}

function extractCategoryFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\/law\/tsutatsu\/kihon\/([^/]+)\//u);

  if (!match) {
    throw new Error(`Unexpected tsutatsu url: ${url}`);
  }

  return match[1];
}

function isMajorCategory(category: string): category is MajorCategory {
  return (MAJOR_CATEGORIES as readonly string[]).includes(category);
}
