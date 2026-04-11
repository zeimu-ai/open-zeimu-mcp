import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { composeTaxAnswerMarkdown, type ParsedTaxAnswer } from "./parser.js";

export type StoredTaxAnswerDocument = {
  id: string;
  markdownPath: string;
  metadataPath: string;
  contentHash: string | null;
  eTag: string | null;
  lastModified: string | null;
  version: number | null;
};

export async function readStoredTaxAnswerDocument(
  dataDir: string,
  id: string,
): Promise<StoredTaxAnswerDocument | null> {
  const metadataPath = buildTaxAnswerMetadataPath(dataDir, id);

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
      markdownPath: buildTaxAnswerMarkdownPath(dataDir, id),
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

export async function writeTaxAnswerDocument({
  dataDir,
  parsed,
  contentHash,
  crawledAt,
  version,
  eTag,
  lastModified,
}: {
  dataDir: string;
  parsed: ParsedTaxAnswer;
  contentHash: string;
  crawledAt: string;
  version: number;
  eTag: string | null;
  lastModified: string | null;
}) {
  const markdownPath = buildTaxAnswerMarkdownPath(dataDir, parsed.document.id);
  const metadataPath = buildTaxAnswerMetadataPath(dataDir, parsed.document.id);
  const markdown = composeTaxAnswerMarkdown({
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

export async function listStoredTaxAnswerIds(dataDir: string) {
  const taxAnswerDir = join(dataDir, "tax_answer");

  try {
    const entries = await stat(taxAnswerDir);

    if (!entries.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const { readdir } = await import("node:fs/promises");
  const ids = await readdir(taxAnswerDir);
  return ids.sort((left, right) => left.localeCompare(right, "ja"));
}

export async function removeTaxAnswerDocument(dataDir: string, id: string) {
  await rm(join(dataDir, "tax_answer", id), {
    recursive: true,
    force: true,
  });
}

export function buildTaxAnswerMarkdownPath(dataDir: string, id: string) {
  return join(dataDir, "tax_answer", id, `${id}.md`);
}

export function buildTaxAnswerMetadataPath(dataDir: string, id: string) {
  return join(dataDir, "tax_answer", id, `${id}.meta.json`);
}
