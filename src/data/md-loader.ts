import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import fg from "fast-glob";
import matter from "gray-matter";

import {
  SOURCE_TYPES,
  type LoadedDocument,
  type MetadataRecord,
  type SourceType,
} from "../types/index.js";

type LoadMarkdownDocumentsOptions = {
  dataDir: string;
  sourceTypes?: SourceType[];
};

type Frontmatter = {
  id?: string;
  title?: string;
  category?: string | null;
  canonical_url?: string;
  source_type?: SourceType;
  published_at?: string | null;
  updated_at?: string | null;
  crawled_at?: string | null;
  content_hash?: string | null;
  license?: string | null;
  version?: number | null;
  aliases?: string[];
};

export async function loadMarkdownDocuments({
  dataDir,
  sourceTypes = [...SOURCE_TYPES],
}: LoadMarkdownDocumentsOptions): Promise<LoadedDocument[]> {
  const patterns = sourceTypes.map((sourceType) => `${sourceType}/**/*.md`);
  const markdownFiles = await fg(patterns, {
    cwd: dataDir,
    absolute: true,
    onlyFiles: true,
  });

  const documents = await Promise.all(
    markdownFiles.map(async (markdownPath) => {
      const markdown = await readFile(markdownPath, "utf8");
      const parsed = matter(markdown);
      const frontmatter = parsed.data as Frontmatter;
      const sourceType = frontmatter.source_type ?? inferSourceType(dataDir, markdownPath);
      const metadataPath = markdownPath.replace(/\.md$/u, ".meta.json");
      const metadata = await loadMetadata(metadataPath);
      const content =
        sourceType === "written_answer"
          ? extractWrittenAnswerContent(parsed.content)
          : extractContent(parsed.content);

      const headings = mergeTitleIntoHeadings(
        frontmatter.title ?? "",
        extractHeadings(parsed.content),
      );

      return {
        id: frontmatter.id ?? relative(dataDir, markdownPath).replace(/\.md$/u, ""),
        sourceType,
        title: frontmatter.title ?? "",
        category: frontmatter.category ?? null,
        canonicalUrl: frontmatter.canonical_url ?? "",
        path: markdownPath,
        metadataPath: metadata === null ? null : metadataPath,
        body: content.body,
        headings,
        aliases: frontmatter.aliases ?? [],
        metadata: metadata ?? {},
        crawledAt: normalizeOptionalDate(frontmatter.crawled_at),
        updatedAt: normalizeOptionalDate(frontmatter.updated_at),
        publishedAt: normalizeOptionalDate(frontmatter.published_at),
        contentHash: frontmatter.content_hash ?? null,
        license: frontmatter.license ?? null,
        version: frontmatter.version ?? null,
        pageOffsets: content.pageOffsets,
        pageCount: content.pageCount,
      } satisfies LoadedDocument;
    }),
  );

  return documents.sort((left, right) => left.id.localeCompare(right.id, "ja"));
}

async function loadMetadata(path: string): Promise<MetadataRecord | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as MetadataRecord;
  } catch {
    return null;
  }
}

function inferSourceType(dataDir: string, markdownPath: string): SourceType {
  const firstSegment = relative(dataDir, markdownPath).split("/")[0];

  if (SOURCE_TYPES.includes(firstSegment as SourceType)) {
    return firstSegment as SourceType;
  }

  throw new Error(`Unsupported source type path: ${dirname(markdownPath)}`);
}

function extractHeadings(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(#+)\s+/u.test(line))
    .map((line) => line.replace(/^(#+)\s+/u, ""));
}

function mergeTitleIntoHeadings(title: string, headings: string[]) {
  if (!title) {
    return headings;
  }

  if (headings[0] === title) {
    return headings;
  }

  return [title, ...headings];
}

function extractContent(content: string) {
  return {
    body: content.trim(),
    pageOffsets: [] as number[],
    pageCount: 0,
  };
}

function extractWrittenAnswerContent(content: string) {
  const pageSections = Array.from(
    content.matchAll(
      /<!--\s*page-break:\s*\d+\s*-->\s*([\s\S]*?)(?=(<!--\s*page-break:\s*\d+\s*-->)|$)/gu,
    ),
    (match) => match[1]?.trim() ?? "",
  ).filter(Boolean);

  if (pageSections.length === 0) {
    return extractContent(content);
  }

  const pageOffsets: number[] = [];
  let cursor = 0;

  for (const section of pageSections) {
    pageOffsets.push(cursor);
    cursor += section.length + 2;
  }

  return {
    body: pageSections.join("\n\n"),
    pageOffsets,
    pageCount: pageSections.length,
  };
}

function normalizeOptionalDate(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? null;
}
