import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { composeTsutatsuMarkdown, type ParsedTsutatsu } from "./parser.js";

export type StoredTsutatsuDocument = {
  id: string;
  markdownPath: string;
  metadataPath: string;
  contentHash: string | null;
  eTag: string | null;
  lastModified: string | null;
  version: number | null;
};

export async function readStoredTsutatsuDocument(
  dataDir: string,
  id: string,
): Promise<StoredTsutatsuDocument | null> {
  const metadataPath = buildTsutatsuMetadataPath(dataDir, id);

  try {
    const raw = await readFile(metadataPath, "utf8");
    const metadata = JSON.parse(raw) as {
      content_hash?: string | null;
      etag?: string | null;
      last_modified?: string | null;
      version?: number | null;
    };

    return {
      id,
      markdownPath: buildTsutatsuMarkdownPath(dataDir, id),
      metadataPath,
      contentHash: metadata.content_hash ?? null,
      eTag: metadata.etag ?? null,
      lastModified: metadata.last_modified ?? null,
      version: metadata.version ?? null,
    };
  } catch {
    return null;
  }
}

export async function writeTsutatsuDocument({
  dataDir,
  parsed,
  contentHash,
  crawledAt,
  version,
  eTag,
  lastModified,
}: {
  dataDir: string;
  parsed: ParsedTsutatsu;
  contentHash: string;
  crawledAt: string;
  version: number;
  eTag: string | null;
  lastModified: string | null;
}) {
  const markdownPath = buildTsutatsuMarkdownPath(dataDir, parsed.document.id);
  const metadataPath = buildTsutatsuMetadataPath(dataDir, parsed.document.id);
  const markdown = composeTsutatsuMarkdown({
    document: parsed.document,
    bodyMarkdown: parsed.markdown,
    contentHash,
    crawledAt,
    version,
  });
  const metadata = {
    ...parsed.meta,
    crawled_at: crawledAt,
    content_hash: contentHash,
    version,
    etag: eTag,
    last_modified: lastModified,
  };

  await mkdir(dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, markdown, "utf8");
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return { markdownPath, metadataPath };
}

export async function listStoredTsutatsuIds(dataDir: string) {
  const tsutatsuDir = join(dataDir, "tsutatsu");

  try {
    const entries = await stat(tsutatsuDir);

    if (!entries.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const { readdir } = await import("node:fs/promises");
  const ids = await readdir(tsutatsuDir);
  return ids.sort((left, right) => left.localeCompare(right, "ja"));
}

export async function removeTsutatsuDocument(dataDir: string, id: string) {
  await rm(join(dataDir, "tsutatsu", id), {
    recursive: true,
    force: true,
  });
}

export function buildTsutatsuMarkdownPath(dataDir: string, id: string) {
  return join(dataDir, "tsutatsu", id, `${id}.md`);
}

export function buildTsutatsuMetadataPath(dataDir: string, id: string) {
  return join(dataDir, "tsutatsu", id, `${id}.meta.json`);
}
