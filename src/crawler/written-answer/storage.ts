import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { composeWrittenAnswerMarkdown, type ParsedWrittenAnswer } from "./parser.js";

export type StoredWrittenAnswerDocument = {
  id: string;
  markdownPath: string;
  metadataPath: string;
  contentHash: string | null;
  eTag: string | null;
  lastModified: string | null;
  version: number | null;
};

export async function readStoredWrittenAnswerDocument(
  dataDir: string,
  id: string,
): Promise<StoredWrittenAnswerDocument | null> {
  const metadataPath = buildWrittenAnswerMetadataPath(dataDir, id);

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
      markdownPath: buildWrittenAnswerMarkdownPath(dataDir, id),
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

export async function writeWrittenAnswerDocument({
  dataDir,
  parsed,
  contentHash,
  crawledAt,
  version,
  eTag,
  lastModified,
}: {
  dataDir: string;
  parsed: ParsedWrittenAnswer;
  contentHash: string;
  crawledAt: string;
  version: number;
  eTag: string | null;
  lastModified: string | null;
}) {
  const markdownPath = buildWrittenAnswerMarkdownPath(dataDir, parsed.document.id);
  const metadataPath = buildWrittenAnswerMetadataPath(dataDir, parsed.document.id);
  const markdown = composeWrittenAnswerMarkdown({
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

export async function listStoredWrittenAnswerIds(dataDir: string) {
  const writtenAnswerDir = join(dataDir, "written_answer");

  try {
    const entries = await stat(writtenAnswerDir);

    if (!entries.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const { readdir } = await import("node:fs/promises");
  const ids = await readdir(writtenAnswerDir);
  return ids.sort((left, right) => left.localeCompare(right, "ja"));
}

export async function removeWrittenAnswerDocument(dataDir: string, id: string) {
  await rm(join(dataDir, "written_answer", id), {
    recursive: true,
    force: true,
  });
}

export function buildWrittenAnswerMarkdownPath(dataDir: string, id: string) {
  return join(dataDir, "written_answer", id, `${id}.md`);
}

export function buildWrittenAnswerMetadataPath(dataDir: string, id: string) {
  return join(dataDir, "written_answer", id, `${id}.meta.json`);
}
