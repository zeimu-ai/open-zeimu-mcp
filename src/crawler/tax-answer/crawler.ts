import { join, relative } from "node:path";

import { commitAndPushChanges } from "../git-commit.js";
import { detectTaxAnswerChange } from "./change-detector.js";
import { extractTaxAnswerLinks, extractTaxAnswerSeedPages } from "./discovery.js";
import { parseTaxAnswerHtml } from "./parser.js";
import { FixedRateLimiter } from "./rate-limit.js";
import { TaxAnswerRobotsPolicy } from "./robots.js";
import { TaxAnswerSafety } from "./safety.js";
import {
  listStoredTaxAnswerIds,
  readStoredTaxAnswerDocument,
  writeTaxAnswerDocument,
} from "./storage.js";
import { assertAllowedTaxAnswerUrl } from "./url-policy.js";

type FetchResponse = {
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  text(): Promise<string>;
};

export type TaxAnswerCrawlerOptions = {
  dataDir: string;
  repoDir: string;
  apply: boolean;
  dryRun: boolean;
  limit: number | null;
  ids: string[];
  logger: Pick<Console, "info" | "warn" | "error">;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export async function crawlTaxAnswer(options: TaxAnswerCrawlerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const limiter = new FixedRateLimiter({ intervalMs: 1_000 });
  const safety = new TaxAnswerSafety(join(options.repoDir, ".crawler/tax-answer-state.json"));
  const state = await safety.assertRunAllowed();
  const robots = await fetchRobots({ fetchImpl, limiter });
  const logger = options.logger;
  const discoveredUrls =
    options.ids.length > 0
      ? options.ids.map((id) => `https://www.nta.go.jp/taxes/shiraberu/taxanswer/${inferCategoryFromId(id)}/${id}.htm`)
      : await discoverTaxAnswerUrls({ fetchImpl, limiter, robots, limit: options.limit });

  logger.info(
    `[tax-answer] planned_documents=${discoveredUrls.length} estimated_disk_bytes=${estimateDiskUsage(discoveredUrls.length)}`,
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
      assertAllowedTaxAnswerUrl(url);
      const crawledAt = now().toISOString();
      await limiter.wait();
      const response = (await fetchImpl(url)) as FetchResponse;

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      const html = await response.text();
      const parsed = parseTaxAnswerHtml({ html, url, crawledAt });
      const current = await readStoredTaxAnswerDocument(options.dataDir, parsed.document.id);
      const change = detectTaxAnswerChange({
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
        const written = await writeTaxAnswerDocument({
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

    const existingIds = await listStoredTaxAnswerIds(options.dataDir);
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
      message: `tax_answer: +${updatedCount} updated, +${newCount} new`,
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
  limiter: FixedRateLimiter;
}) {
  await limiter.wait();
  const response = await fetchImpl("https://www.nta.go.jp/robots.txt");

  if (!response.ok) {
    throw new Error(`Failed to fetch robots.txt: ${response.status}`);
  }

  const robotsText = await response.text();
  return new TaxAnswerRobotsPolicy(robotsText);
}

async function discoverTaxAnswerUrls({
  fetchImpl,
  limiter,
  robots,
  limit,
}: {
  fetchImpl: typeof fetch;
  limiter: FixedRateLimiter;
  robots: TaxAnswerRobotsPolicy;
  limit: number | null;
}) {
  const rootUrl = "https://www.nta.go.jp/taxes/shiraberu/taxanswer/index2.htm";

  if (!robots.isAllowed(new URL(rootUrl).pathname)) {
    throw new Error("robots.txt disallows tax answer root");
  }

  await limiter.wait();
  const rootResponse = await fetchImpl(rootUrl);

  if (!rootResponse.ok) {
    throw new Error(`Failed to fetch ${rootUrl}: ${rootResponse.status}`);
  }

  const rootHtml = await rootResponse.text();
  const seedPages = extractTaxAnswerSeedPages(rootHtml, rootUrl);
  const answerUrls = new Set<string>();

  for (const seedPage of seedPages) {
    const pathname = new URL(seedPage).pathname;

    if (!robots.isAllowed(pathname)) {
      continue;
    }

    await limiter.wait();
    const response = await fetchImpl(seedPage);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${seedPage}: ${response.status}`);
    }

    const html = await response.text();

    for (const url of extractTaxAnswerLinks(html, seedPage)) {
      if (robots.isAllowed(new URL(url).pathname)) {
        answerUrls.add(url);
      }
    }
  }

  const discovered = [...answerUrls].sort((left, right) => left.localeCompare(right, "ja"));

  return limit === null ? discovered : discovered.slice(0, limit);
}

function estimateDiskUsage(count: number) {
  return count * 8_192;
}

function inferCategoryFromId(id: string) {
  if (id.startsWith("3")) {
    return "joto";
  }

  if (id.startsWith("4")) {
    return "sozoku";
  }

  if (id.startsWith("6")) {
    return "shohi";
  }

  return "shotoku";
}
