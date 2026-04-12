import MiniSearch from "minisearch";

import type { LoadedDocument, SourceType } from "../types/index.js";

type IndexedDocument = {
  id: string;
  documentId: string;
  sourceType: SourceType;
  category: string | null;
  title: string;
  headings: string;
  aliases: string;
  body: string;
};

export type LexicalSearchHit = {
  id: string;
  source_type: SourceType;
  title: string;
  score: number;
  snippet: string;
  match_offset?: number;
};

export type LexicalSearchResult = {
  hits: LexicalSearchHit[];
};

export type LexicalIndex = {
  size: number;
  builtAt: string | null;
  search: (input: {
    query: string;
    sourceTypes?: SourceType[];
    category?: string;
    limit: number;
  }) => LexicalSearchResult;
};

export async function buildLexicalIndex({
  documents,
}: {
  documents: LoadedDocument[];
}): Promise<LexicalIndex> {
  const miniSearch = new MiniSearch<IndexedDocument>({
    idField: "id",
    fields: ["title", "headings", "aliases", "body"],
    storeFields: ["documentId", "sourceType", "category", "title", "body"],
    searchOptions: {
      boost: {
        title: 4,
        headings: 3,
        aliases: 2,
        body: 1,
      },
      prefix: true,
      fuzzy: 0.1,
    },
    processTerm: defaultJapaneseTokenizer,
  });

  miniSearch.addAll(
    documents.map((document) => ({
      id: `${document.sourceType}:${document.id}`,
      documentId: document.id,
      sourceType: document.sourceType,
      category: document.category,
      title: document.title,
      headings: document.headings.join("\n"),
      aliases: document.aliases.join("\n"),
      body: document.body,
    })),
  );

  const builtAt = new Date().toISOString();

  return {
    size: documents.length,
    builtAt,
    search({ query, sourceTypes, category, limit }) {
      const hits = miniSearch.search(query, {
        boost: {
          title: 4,
          headings: 3,
          aliases: 2,
          body: 1,
        },
        filter: sourceTypes?.length
          ? (result) =>
              sourceTypes.includes(result.sourceType) &&
              (!category || result.category === category)
          : undefined,
        prefix: true,
        fuzzy: 0.1,
      });

      return {
        hits: hits.slice(0, limit).map((hit) => ({
          id: hit.documentId,
          source_type: hit.sourceType,
          title: hit.title,
          score: hit.score,
          ...buildSnippet(hit.queryTerms, hit.body),
        })),
      };
    },
  };
}

function defaultJapaneseTokenizer(term: string, _fieldName?: string) {
  return term
    .normalize("NFKC")
    .toLowerCase()
    .split(/[\s\u3000/]+/u)
    .flatMap((token) => token.match(/[\p{Letter}\p{Number}一-龠ぁ-んァ-ヶー]+/gu) ?? [])
    .filter(Boolean);
}

function buildSnippet(queryTerms: string[], body: string) {
  const normalizedBody = body.replace(/\s+/gu, " ").trim();
  const matchedTerm = queryTerms.find((term) => normalizedBody.includes(term));

  if (!matchedTerm) {
    return {
      snippet: normalizedBody.slice(0, 120),
    };
  }

  const index = normalizedBody.indexOf(matchedTerm);
  const start = Math.max(0, index - 30);
  const end = Math.min(normalizedBody.length, index + matchedTerm.length + 60);
  return {
    snippet: normalizedBody.slice(start, end),
    match_offset: index,
  };
}
