import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createSaiketsuMetadataFingerprint } from "./change-detector.js";
import { composeSaiketsuMarkdown, type ParsedSaiketsu } from "./parser.js";

export type StoredSaiketsuDocument = {
  id: string;
  markdownPath: string;
  metadataPath: string;
  contentHash: string | null;
  eTag: string | null;
  lastModified: string | null;
  metadataFingerprint: string | null;
  version: number | null;
};

export async function readStoredSaiketsuDocument(
  dataDir: string,
  id: string,
): Promise<StoredSaiketsuDocument | null> {
  const metadataPath = buildSaiketsuMetadataPath(dataDir, id);

  try {
    const raw = await readFile(metadataPath, "utf8");
    const metadata = JSON.parse(raw) as Partial<ParsedSaiketsu["meta"]>;

    return {
      id,
      markdownPath: buildSaiketsuMarkdownPath(dataDir, id),
      metadataPath,
      contentHash: metadata.content_hash ?? null,
      eTag: metadata.etag ?? null,
      lastModified: metadata.last_modified ?? null,
      metadataFingerprint: createSaiketsuMetadataFingerprint({
        id: metadata.id ?? null,
        title: metadata.title ?? null,
        category: metadata.category ?? null,
        category_code: metadata.category_code ?? null,
        canonical_url: metadata.canonical_url ?? null,
        source_type: metadata.source_type ?? null,
        updated_at: metadata.updated_at ?? null,
        published_at: metadata.published_at ?? null,
        license: metadata.license ?? null,
        aliases: metadata.aliases ?? [],
        headings: metadata.headings ?? [],
        citation: metadata.citation ?? null,
        document_number: metadata.document_number ?? null,
        tags: metadata.tags ?? [],
      }),
      version: metadata.version ?? null,
    };
  } catch {
    return null;
  }
}

export async function writeSaiketsuDocument({
  dataDir,
  parsed,
  contentHash,
  crawledAt,
  version,
  eTag,
  lastModified,
}: {
  dataDir: string;
  parsed: ParsedSaiketsu;
  contentHash: string;
  crawledAt: string;
  version: number;
  eTag: string | null;
  lastModified: string | null;
}) {
  const markdownPath = buildSaiketsuMarkdownPath(dataDir, parsed.document.id);
  const metadataPath = buildSaiketsuMetadataPath(dataDir, parsed.document.id);
  const markdown = composeSaiketsuMarkdown({
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

export async function listStoredSaiketsuIds(dataDir: string) {
  const saiketsuDir = join(dataDir, "saiketsu");

  try {
    const entries = await stat(saiketsuDir);

    if (!entries.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const { readdir } = await import("node:fs/promises");
  const ids = await readdir(saiketsuDir);
  return ids.sort((left, right) => left.localeCompare(right, "ja"));
}

export async function removeSaiketsuDocument(dataDir: string, id: string) {
  await rm(join(dataDir, "saiketsu", id), {
    recursive: true,
    force: true,
  });
}

export function buildSaiketsuMarkdownPath(dataDir: string, id: string) {
  return join(dataDir, "saiketsu", id, `${id}.md`);
}

export function buildSaiketsuMetadataPath(dataDir: string, id: string) {
  return join(dataDir, "saiketsu", id, `${id}.meta.json`);
}
