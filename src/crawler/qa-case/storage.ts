import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { composeQaCaseMarkdown, type ParsedQaCase } from "./parser.js";

export type StoredQaCaseDocument = {
  id: string;
  markdownPath: string;
  metadataPath: string;
  contentHash: string | null;
  eTag: string | null;
  lastModified: string | null;
  version: number | null;
};

export async function readStoredQaCaseDocument(
  dataDir: string,
  id: string,
): Promise<StoredQaCaseDocument | null> {
  const metadataPath = buildQaCaseMetadataPath(dataDir, id);

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
      markdownPath: buildQaCaseMarkdownPath(dataDir, id),
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

export async function writeQaCaseDocument({
  dataDir,
  parsed,
  contentHash,
  crawledAt,
  version,
  eTag,
  lastModified,
}: {
  dataDir: string;
  parsed: ParsedQaCase;
  contentHash: string;
  crawledAt: string;
  version: number;
  eTag: string | null;
  lastModified: string | null;
}) {
  const markdownPath = buildQaCaseMarkdownPath(dataDir, parsed.document.id);
  const metadataPath = buildQaCaseMetadataPath(dataDir, parsed.document.id);
  const markdown = composeQaCaseMarkdown({
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

export async function listStoredQaCaseIds(dataDir: string) {
  const qaCaseDir = join(dataDir, "qa_case");

  try {
    const entries = await stat(qaCaseDir);

    if (!entries.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const { readdir } = await import("node:fs/promises");
  const ids = await readdir(qaCaseDir);
  return ids.sort((left, right) => left.localeCompare(right, "ja"));
}

export async function removeQaCaseDocument(dataDir: string, id: string) {
  await rm(join(dataDir, "qa_case", id), {
    recursive: true,
    force: true,
  });
}

export function buildQaCaseMarkdownPath(dataDir: string, id: string) {
  return join(dataDir, "qa_case", id, `${id}.md`);
}

export function buildQaCaseMetadataPath(dataDir: string, id: string) {
  return join(dataDir, "qa_case", id, `${id}.meta.json`);
}
