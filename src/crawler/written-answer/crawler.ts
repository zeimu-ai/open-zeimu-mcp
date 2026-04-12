import { join, relative } from "node:path";

import { commitAndPushChanges } from "../git-commit.js";
import { detectWrittenAnswerChange } from "./change-detector.js";
import { discoverWrittenAnswerIndexPages, extractWrittenAnswerLinks } from "./discovery.js";
import { parseWrittenAnswerPage } from "./parser.js";
import { FixedRateLimiter } from "./rate-limit.js";
import { WrittenAnswerRobotsPolicy } from "./robots.js";
import { WrittenAnswerSafety } from "./safety.js";
import {
  listStoredWrittenAnswerIds,
  readStoredWrittenAnswerDocument,
  writeWrittenAnswerDocument,
} from "./storage.js";
import { assertAllowedWrittenAnswerUrl } from "./url-policy.js";

type FetchResponse = {
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type RateLimiter = Pick<FixedRateLimiter, "wait">;

export type WrittenAnswerCrawlerOptions = {
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

export async function crawlWrittenAnswer(options: WrittenAnswerCrawlerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const limiter: RateLimiter = options.limiter ?? new FixedRateLimiter({ intervalMs: 2_000 });
  const safety = new WrittenAnswerSafety(join(options.repoDir, ".crawler/written-answer-state.json"));
  const state = await safety.assertRunAllowed();
  const robots = await fetchRobots({ fetchImpl, limiter });
  const logger = options.logger;
  const discoveredUrls = await discoverWrittenAnswerUrls({
    fetchImpl,
    limiter,
    robots,
    limit: options.ids.length > 0 ? null : options.limit,
  });
  const requestedIds = new Set(options.ids);
  const selectedUrls =
    requestedIds.size === 0
      ? discoveredUrls
      : discoveredUrls.filter((url) => requestedIds.has(inferWrittenAnswerId(url)));

  logger.info(
    `[written_answer] planned_documents=${selectedUrls.length} estimated_disk_bytes=${estimateDiskUsage(selectedUrls.length)}`,
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
      assertAllowedWrittenAnswerUrl(url);
      const crawledAt = now().toISOString();
      await limiter.wait();
      const response = (await fetchImpl(url)) as FetchResponse;

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      const html = await decodeHtmlResponse(response);
      const parsed = parseWrittenAnswerPage({ html, url, crawledAt });
      const current = await readStoredWrittenAnswerDocument(options.dataDir, parsed.document.id);
      const change = detectWrittenAnswerChange({
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
        const written = await writeWrittenAnswerDocument({
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

    const existingIds = await listStoredWrittenAnswerIds(options.dataDir);
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
      message: `written_answer: +${updatedCount} updated, +${newCount} new`,
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
  return new WrittenAnswerRobotsPolicy(robotsText);
}

async function discoverWrittenAnswerUrls({
  fetchImpl,
  limiter,
  robots,
  limit,
}: {
  fetchImpl: typeof fetch;
  limiter: RateLimiter;
  robots: WrittenAnswerRobotsPolicy;
  limit: number | null;
}) {
  const rootUrl = "https://www.nta.go.jp/law/bunshokaito/01.htm";

  if (!robots.isAllowed(new URL(rootUrl).pathname)) {
    throw new Error("robots.txt disallows written_answer root");
  }

  await limiter.wait();
  const rootResponse = (await fetchImpl(rootUrl)) as FetchResponse;

  if (!rootResponse.ok) {
    throw new Error(`Failed to fetch ${rootUrl}: ${rootResponse.status}`);
  }

  const rootHtml = await decodeHtmlResponse(rootResponse);
  const indexPages = await discoverWrittenAnswerIndexPages({ html: rootHtml, baseUrl: rootUrl });
  const documentUrls = new Set<string>();

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

    for (const url of extractWrittenAnswerLinks(html, indexPage)) {
      if (robots.isAllowed(new URL(url).pathname)) {
        documentUrls.add(url);
      }
    }
  }

  const discovered = [...documentUrls].sort((left, right) => left.localeCompare(right, "ja"));
  return limit === null ? discovered : discovered.slice(0, limit);
}

async function decodeHtmlResponse(response: FetchResponse, fallbackCharset = "utf-8") {
  const arrayBuffer = await response.arrayBuffer();
  const raw = new Uint8Array(arrayBuffer);
  const headerCharset = response.headers.get("content-type")?.match(/charset=([^;]+)/iu)?.[1]?.trim();
  const sniffedCharset = sniffCharset(raw);
  const charset = headerCharset ?? sniffedCharset ?? fallbackCharset;
  const decoder = new TextDecoder(charset);
  return decoder.decode(arrayBuffer);
}

function sniffCharset(raw: Uint8Array) {
  const head = new TextDecoder("latin1").decode(raw.slice(0, 4096));
  const metaCharset = head.match(/charset\s*=\s*["']?([^"'>\s]+)/iu)?.[1]?.trim();

  if (!metaCharset) {
    return null;
  }

  const normalized = metaCharset.toLowerCase();
  if (normalized === "shift_jis" || normalized === "shift-jis" || normalized === "sjis") {
    return "shift_jis";
  }

  if (normalized === "utf-8" || normalized === "utf8") {
    return "utf-8";
  }

  return metaCharset;
}

function estimateDiskUsage(count: number) {
  return count * 8_192;
}

function inferWrittenAnswerId(url: string) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/^\/law\/bunshokaito\/([a-z0-9-]+)\/(.+)\.htm$/iu);

  if (!match) {
    throw new Error(`Unexpected written_answer url: ${url}`);
  }

  const category = match[1];
  const slug = match[2]
    .replace(/\/index$/iu, "")
    .replace(/\/+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  if (!slug) {
    throw new Error(`Unexpected written_answer slug: ${url}`);
  }

  return `bunshokaito-${category}-${slug}`;
}
