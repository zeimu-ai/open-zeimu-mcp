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
