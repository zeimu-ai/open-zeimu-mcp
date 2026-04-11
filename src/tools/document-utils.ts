import type { LoadedDocument, SourceType } from "../types/index.js";

export function findDocumentById({
  documents,
  sourceType,
  id,
}: {
  documents: LoadedDocument[];
  sourceType: SourceType;
  id: string;
}) {
  return documents.find((document) => document.sourceType === sourceType && document.id === id);
}

export function getStringMetadata(document: LoadedDocument, key: string) {
  const value = document.metadata[key];
  return typeof value === "string" ? value : null;
}

export function getStringArrayMetadata(document: LoadedDocument, key: string) {
  const value = document.metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function findSearchDocumentOrThrow({
  documents,
  sourceType,
  id,
  label,
}: {
  documents: LoadedDocument[];
  sourceType: SourceType;
  id: string;
  label: string;
}) {
  const matched = findDocumentById({
    documents,
    sourceType,
    id,
  });

  if (!matched) {
    throw new Error(`${label}の検索結果が本文データと一致しません: ${id}`);
  }

  return matched;
}

export function buildCategorySummaries({
  documents,
  sourceType,
}: {
  documents: LoadedDocument[];
  sourceType: SourceType;
}) {
  const categories = new Map<
    string,
    {
      category: string;
      document_count: number;
      latest_crawled_at: string | null;
    }
  >();

  for (const document of documents) {
    if (document.sourceType !== sourceType || !document.category) {
      continue;
    }

    const current = categories.get(document.category) ?? {
      category: document.category,
      document_count: 0,
      latest_crawled_at: null,
    };

    current.document_count += 1;
    if (
      document.crawledAt &&
      (!current.latest_crawled_at || document.crawledAt > current.latest_crawled_at)
    ) {
      current.latest_crawled_at = document.crawledAt;
    }

    categories.set(document.category, current);
  }

  return [...categories.values()].sort((left, right) =>
    left.category.localeCompare(right.category, "ja"),
  );
}

export function buildPageHint(pageOffsets: number[], matchOffset?: number) {
  if (pageOffsets.length === 0 || matchOffset === undefined) {
    return null;
  }

  for (let index = pageOffsets.length - 1; index >= 0; index -= 1) {
    if (matchOffset >= pageOffsets[index]) {
      return `p.${index + 1}`;
    }
  }

  return "p.1";
}
