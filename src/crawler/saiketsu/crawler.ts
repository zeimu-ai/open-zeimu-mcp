import { join, relative } from "node:path";

import { commitAndPushChanges } from "../git-commit.js";
import { createSaiketsuMetadataFingerprint, detectSaiketsuChange } from "./change-detector.js";
import { discoverSaiketsuIndexPages, extractSaiketsuDocumentLinks } from "./discovery.js";
import { parseSaiketsuPage } from "./parser.js";
import { FixedRateLimiter } from "./rate-limit.js";
import { SaiketsuRobotsPolicy } from "./robots.js";
import { listStoredSaiketsuIds, readStoredSaiketsuDocument, writeSaiketsuDocument } from "./storage.js";
import { assertAllowedSaiketsuUrl } from "./url-policy.js";

type FetchResponse = {
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
};

type RateLimiter = Pick<FixedRateLimiter, "wait">;

export type SaiketsuCrawlerOptions = {
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

type DiscoveredTarget = {
  url: string;
  citation: string;
  category: string;
  categoryCode: string;
};

export async function crawlSaiketsu(options: SaiketsuCrawlerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const limiter: RateLimiter = options.limiter ?? new FixedRateLimiter({ intervalMs: 2_000 });
  const safety = new SaiketsuSafety(join(options.repoDir, ".crawler/saiketsu-state.json"));
  const state = await safety.assertRunAllowed();
  const robots = await fetchRobots({ fetchImpl, limiter });
  const logger = options.logger;
  const discoveredTargets = await discoverSaiketsuTargets({
    fetchImpl,
    limiter,
    robots,
    limit: options.limit,
  });
  const requestedIds = options.ids.length > 0 ? new Set(options.ids) : null;

  logger.info(
    `[saiketsu] planned_documents=${discoveredTargets.length} estimated_disk_bytes=${estimateDiskUsage(discoveredTargets.length)}`,
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
    const categoryCounts = new Map<string, number>();

    for (const target of discoveredTargets) {
      assertAllowedSaiketsuUrl(target.url);
      const crawledAt = now().toISOString();
      const sequence = (categoryCounts.get(target.categoryCode) ?? 0) + 1;
      categoryCounts.set(target.categoryCode, sequence);
      const id = buildSaiketsuId({ categoryCode: target.categoryCode, sequence });

      if (requestedIds && !requestedIds.has(id)) {
        continue;
      }

      await limiter.wait();
      const response = (await fetchImpl(target.url)) as FetchResponse;

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn(`[saiketsu] skipped missing document ${target.url}`);
          continue;
        }

        throw new Error(`Failed to fetch ${target.url}: ${response.status}`);
      }

      const html = await decodeHtmlResponse(response);
      const parsed = parseSaiketsuPage({
        html,
        url: target.url,
        crawledAt,
        id,
        category: target.category,
        categoryCode: target.categoryCode,
        citation: target.citation,
      });
      const current = await readStoredSaiketsuDocument(options.dataDir, parsed.document.id);
      const change = detectSaiketsuChange({
        current:
          current === null
            ? null
            : {
                id: current.id,
                contentHash: current.contentHash,
                eTag: current.eTag,
                lastModified: current.lastModified,
                metadataFingerprint: current.metadataFingerprint,
                version: current.version,
              },
        next: {
          id: parsed.document.id,
          contentHash: parsed.meta.content_hash,
          eTag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          metadataFingerprint: createSaiketsuMetadataFingerprint({
            id: parsed.meta.id,
            title: parsed.meta.title,
            category: parsed.meta.category,
            category_code: parsed.meta.category_code,
            canonical_url: parsed.meta.canonical_url,
            source_type: parsed.meta.source_type,
            updated_at: parsed.meta.updated_at,
            published_at: parsed.meta.published_at,
            license: parsed.meta.license,
            aliases: parsed.meta.aliases,
            headings: parsed.meta.headings,
            citation: parsed.meta.citation,
            document_number: parsed.meta.document_number,
            tags: parsed.meta.tags,
          }),
        },
      });

      if (!change.changed) {
        results.push({
          id: parsed.document.id,
          url: target.url,
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
        const written = await writeSaiketsuDocument({
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
        url: target.url,
        changed: true,
        created: current === null,
        version: change.version,
        reason: change.reason,
        markdownPath,
        metadataPath,
      });
    }

    const existingIds = await listStoredSaiketsuIds(options.dataDir);
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
      message: `saiketsu: +${updatedCount} updated, +${newCount} new`,
      dryRun: options.dryRun || !options.apply,
    });
    await safety.recordSuccess({ count: nextIds.size, now: now().toISOString() });

    return {
      discoveredCount: discoveredTargets.length,
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
  const response = await fetchImpl("https://www.kfs.go.jp/robots.txt");

  if (!response.ok) {
    throw new Error(`Failed to fetch robots.txt: ${response.status}`);
  }

  const robotsText = await response.text();
  return new SaiketsuRobotsPolicy(robotsText);
}

async function discoverSaiketsuTargets({
  fetchImpl,
  limiter,
  robots,
  limit,
}: {
  fetchImpl: typeof fetch;
  limiter: RateLimiter;
  robots: SaiketsuRobotsPolicy;
  limit: number | null;
}) {
  const rootUrl = "https://www.kfs.go.jp/service/MP/01/index.html";

  if (!robots.isAllowed(new URL(rootUrl).pathname)) {
    throw new Error("robots.txt disallows saiketsu root");
  }

  await limiter.wait();
  const rootResponse = (await fetchImpl(rootUrl)) as FetchResponse;

  if (!rootResponse.ok) {
    throw new Error(`Failed to fetch ${rootUrl}: ${rootResponse.status}`);
  }

  const rootHtml = await decodeHtmlResponse(rootResponse, "shift_jis");
  const sectionPages = discoverSaiketsuIndexPages({ html: rootHtml, baseUrl: rootUrl });
  const targets: DiscoveredTarget[] = [];

  for (const sectionPage of sectionPages) {
    if (limit !== null && targets.length >= limit) {
      break;
    }

    const pathname = new URL(sectionPage).pathname;

    if (!robots.isAllowed(pathname)) {
      continue;
    }

    await limiter.wait();
    const response = (await fetchImpl(sectionPage)) as FetchResponse;

    if (!response.ok) {
      throw new Error(`Failed to fetch ${sectionPage}: ${response.status}`);
    }

    const html = await decodeHtmlResponse(response, "shift_jis");
    const category = extractSaiketsuCategory({
      html,
      fallback: sectionPage,
    });
    const categoryCode = extractCategoryCode(sectionPage);
    const documents = extractSaiketsuDocumentLinks({
      html,
      baseUrl: sectionPage,
      category,
      categoryCode,
    });

    for (const document of documents) {
      if (!robots.isAllowed(new URL(document.url).pathname)) {
        continue;
      }

      targets.push(document);

      if (limit !== null && targets.length >= limit) {
        break;
      }
    }
  }

  return targets;
}

async function decodeHtmlResponse(response: FetchResponse, fallbackCharset = "shift_jis") {
  const arrayBuffer = await response.arrayBuffer();
  const charset = response.headers.get("content-type")?.match(/charset=([^;]+)/iu)?.[1]?.trim();
  const decoder = new TextDecoder(charset ?? fallbackCharset);
  return decoder.decode(arrayBuffer);
}

function extractSaiketsuCategory({ html, fallback }: { html: string; fallback: string }) {
  const group = extractInstanceParam(html, "GroupName");
  return group || extractInstanceParam(html, "PageTitle") || fallback;
}

function extractInstanceParam(html: string, name: string) {
  const match = html.match(
    new RegExp(`InstanceParam name="${name}" type="text" value="([^"]*)"`, "i"),
  );
  return match?.[1] ?? "";
}

function extractCategoryCode(url: string) {
  const match = url.match(/\/service\/MP\/01\/(\d{2})\d{8}\.html$/u);

  if (!match) {
    return "00";
  }

  return match[1];
}

function buildSaiketsuId({
  categoryCode,
  sequence,
}: {
  categoryCode: string;
  sequence: number;
}) {
  return `saiketsu-${categoryCode}-${String(sequence).padStart(3, "0")}`;
}

function estimateDiskUsage(count: number) {
  return count * 8_192;
}

class SaiketsuSafety {
  constructor(private readonly statePath: string) {}

  async loadState(): Promise<{
    consecutiveFailureDays: number;
    lastFailureDate: string | null;
    lastSuccessfulCount: number | null;
    lastSuccessfulAt: string | null;
  }> {
    try {
      const raw = await import("node:fs/promises").then(({ readFile }) => readFile(this.statePath, "utf8"));
      return JSON.parse(raw) as {
        consecutiveFailureDays: number;
        lastFailureDate: string | null;
        lastSuccessfulCount: number | null;
        lastSuccessfulAt: string | null;
      };
    } catch {
      return {
        consecutiveFailureDays: 0,
        lastFailureDate: null,
        lastSuccessfulCount: null,
        lastSuccessfulAt: null,
      };
    }
  }

  async assertRunAllowed() {
    const state = await this.loadState();

    if (state.consecutiveFailureDays >= 3) {
      throw new Error("Crawler is paused after 3 consecutive failure days");
    }

    return state;
  }

  assertNoLargeCountDrop(previousCount: number | null, nextCount: number) {
    if (previousCount === null || previousCount === 0) {
      return;
    }

    if (nextCount < previousCount * 0.7) {
      throw new Error(
        `Crawler aborted because document count dropped by more than 30% (${previousCount} -> ${nextCount})`,
      );
    }
  }

  assertDeletionThreshold(deletedCount: number) {
    if (deletedCount > 100) {
      throw new Error(`Crawler aborted because deleted_count=${deletedCount} exceeds 100`);
    }
  }

  async recordSuccess({ count, now }: { count: number; now: string }) {
    await this.writeState({
      consecutiveFailureDays: 0,
      lastFailureDate: null,
      lastSuccessfulCount: count,
      lastSuccessfulAt: now,
    });
  }

  async recordFailure(now: string) {
    const state = await this.loadState();
    const currentDate = now.slice(0, 10);
    const previousDate = state.lastFailureDate;
    const consecutiveFailureDays =
      previousDate === currentDate ? state.consecutiveFailureDays : state.consecutiveFailureDays + 1;

    await this.writeState({
      ...state,
      consecutiveFailureDays,
      lastFailureDate: currentDate,
    });
  }

  private async writeState(state: {
    consecutiveFailureDays: number;
    lastFailureDate: string | null;
    lastSuccessfulCount: number | null;
    lastSuccessfulAt: string | null;
  }) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");

    await mkdir(dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}
