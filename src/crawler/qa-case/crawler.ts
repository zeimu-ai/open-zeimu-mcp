import { join, relative } from "node:path";

import { commitAndPushChanges } from "../git-commit.js";
import { detectQaCaseChange } from "./change-detector.js";
import { discoverQaCaseIndexPages, extractQaCaseLinks } from "./discovery.js";
import { parseQaCasePage } from "./parser.js";
import { FixedRateLimiter } from "./rate-limit.js";
import { QaCaseRobotsPolicy } from "./robots.js";
import { QaCaseSafety } from "./safety.js";
import {
  listStoredQaCaseIds,
  readStoredQaCaseDocument,
  writeQaCaseDocument,
} from "./storage.js";
import { assertAllowedQaCaseUrl } from "./url-policy.js";

type FetchResponse = {
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type RateLimiter = Pick<FixedRateLimiter, "wait">;

export type QaCaseCrawlerOptions = {
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

export async function crawlQaCase(options: QaCaseCrawlerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const limiter: RateLimiter = options.limiter ?? new FixedRateLimiter({ intervalMs: 2_000 });
  const safety = new QaCaseSafety(join(options.repoDir, ".crawler/qa-case-state.json"));
  const state = await safety.assertRunAllowed();
  const robots = await fetchRobots({ fetchImpl, limiter });
  const logger = options.logger;
  const discoveredUrls =
    options.ids.length > 0
      ? options.ids.map(inferUrlFromId)
      : await discoverQaCaseUrls({ fetchImpl, limiter, robots, limit: options.limit });

  logger.info(
    `[qa-case] planned_documents=${discoveredUrls.length} estimated_disk_bytes=${estimateDiskUsage(discoveredUrls.length)}`,
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
    for (const url of discoveredUrls) {
      assertAllowedQaCaseUrl(url);
      const crawledAt = now().toISOString();
      await limiter.wait();
      const response = (await fetchImpl(url)) as FetchResponse;

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      const html = await decodeHtmlResponse(response);
      const parsed = parseQaCasePage({ html, url, crawledAt });
      const current = await readStoredQaCaseDocument(options.dataDir, parsed.document.id);
      const change = detectQaCaseChange({
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
        const written = await writeQaCaseDocument({
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

    const existingIds = await listStoredQaCaseIds(options.dataDir);
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
      message: `qa_case: +${updatedCount} updated, +${newCount} new`,
      dryRun: options.dryRun || !options.apply,
    });
    await safety.recordSuccess({ count: nextIds.size, now: now().toISOString() });

    return {
      discoveredCount: discoveredUrls.length,
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

  const robotsText = await decodeHtmlResponse(response as FetchResponse, "utf-8");
  return new QaCaseRobotsPolicy(robotsText);
}

async function discoverQaCaseUrls({
  fetchImpl,
  limiter,
  robots,
  limit,
}: {
  fetchImpl: typeof fetch;
  limiter: RateLimiter;
  robots: QaCaseRobotsPolicy;
  limit: number | null;
}) {
  const rootUrl = "https://www.nta.go.jp/law/shitsugi/01.htm";

  if (!robots.isAllowed(new URL(rootUrl).pathname)) {
    throw new Error("robots.txt disallows qa_case root");
  }

  await limiter.wait();
  const rootResponse = (await fetchImpl(rootUrl)) as FetchResponse;

  if (!rootResponse.ok) {
    throw new Error(`Failed to fetch ${rootUrl}: ${rootResponse.status}`);
  }

  const rootHtml = await decodeHtmlResponse(rootResponse);
  const indexPages = await discoverQaCaseIndexPages({ html: rootHtml, baseUrl: rootUrl });
  const caseUrls = new Set<string>();

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

    for (const url of extractQaCaseLinks(html, indexPage)) {
      if (robots.isAllowed(new URL(url).pathname)) {
        caseUrls.add(url);
      }
    }
  }

  const discovered = [...caseUrls].sort((left, right) => left.localeCompare(right, "ja"));
  return limit === null ? discovered : discovered.slice(0, limit);
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

function inferUrlFromId(id: string) {
  const match = id.match(/^qa-([a-z0-9_-]+)-([0-9]{2})-([0-9]{2})$/u);

  if (!match) {
    throw new Error(`Unexpected qa_case id: ${id}`);
  }

  if (match[1] === "sake") {
    return `https://www.nta.go.jp/taxes/sake/qa/${match[2]}/${match[3]}.htm`;
  }

  return `https://www.nta.go.jp/law/shitsugi/${match[1]}/${match[2]}/${match[3]}.htm`;
}
