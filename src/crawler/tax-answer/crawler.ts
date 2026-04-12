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
  arrayBuffer(): Promise<ArrayBuffer>;
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

      const html = await decodeHtmlResponse(response);
      let parsed;
      try {
        parsed = parseTaxAnswerHtml({ html, url, crawledAt });
      } catch (parseError) {
        logger.warn(`[tax-answer] skipping ${url}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        continue;
      }
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

async function decodeHtmlResponse(response: FetchResponse, fallbackCharset = "shift_jis") {
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

const TAX_ANSWER_CATEGORY_OVERRIDES = new Map<string, string>([
  ...[
    "2010",
    "2011",
    "2012",
    "2020",
    "2022",
    "2024",
    "2026",
    "2029",
    "2030",
    "2031",
    "2036",
    "2040",
    "2070",
    "2072",
    "2075",
    "2080",
    "2090",
    "2091",
    "2100",
    "2105",
    "2106",
    "2107",
    "2108",
    "2109",
    "2110",
    "2200",
    "2201",
    "2202",
    "2210",
    "2215",
    "2217",
    "2220",
    "2230",
    "2240",
    "2250",
    "2260",
    "3382",
  ].map((id) => [id, "shotoku"] as const),
  ["3429", "hojin"] as const,
  ...["4409", "4602"].map((id) => [id, "sozoku"] as const),
  ...["4510", "4511", "4512", "4552", "4553", "4555", "4557", "4560"].map((id) => [id, "zoyo"] as const),
  ...[
    "4603",
    "4604",
    "4605",
    "4606",
    "4607",
    "4609",
    "4611",
    "4612",
    "4613",
    "4614",
    "4617",
    "4620",
    "4621",
    "4622",
    "4623",
    "4626",
    "4627",
    "4628",
    "4629",
    "4632",
    "4635",
    "4638",
    "4641",
    "4644",
    "4647",
    "4660",
    "4665",
    "4666",
    "4667",
  ].map((id) => [id, "hyoka"] as const),
]);

export function inferCategoryFromId(id: string) {
  const overrideCategory = TAX_ANSWER_CATEGORY_OVERRIDES.get(id);

  if (overrideCategory) {
    return overrideCategory;
  }

  const numericId = Number.parseInt(id, 10);

  if (!Number.isInteger(numericId)) {
    throw new Error(`Unexpected tax answer id: ${id}`);
  }

  if (numericId >= 1000 && numericId <= 1999) {
    return "shotoku";
  }

  if (numericId >= 2000 && numericId <= 2999) {
    return "gensen";
  }

  if (numericId >= 3000 && numericId <= 3999) {
    return "joto";
  }

  if (numericId >= 4000 && numericId <= 4399) {
    return "sozoku";
  }

  if (numericId >= 4400 && numericId <= 4499) {
    return "zoyo";
  }

  if (numericId >= 4500 && numericId <= 4699) {
    return "sozoku";
  }

  if (numericId >= 5000 && numericId <= 5999) {
    return "hojin";
  }

  if (numericId >= 6000 && numericId <= 6999) {
    return "shohi";
  }

  if (numericId >= 7100 && numericId <= 7199) {
    return "inshi";
  }

  if (numericId >= 7200 && numericId <= 7299) {
    return "fufuku";
  }

  if (numericId >= 7400 && numericId <= 7499) {
    return "hotei";
  }

  if (numericId >= 8000 && numericId <= 8999) {
    return "saigai";
  }

  if (numericId >= 9000 && numericId <= 9299) {
    return "osirase";
  }

  throw new Error(`Unexpected tax answer id: ${id}`);
}
