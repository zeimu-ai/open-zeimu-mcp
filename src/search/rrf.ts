import type { LexicalSearchHit } from "./lexical-index.js";

export function reciprocalRankFusion({
  lexicalHits,
  semanticHits,
  limit,
  k = 60,
}: {
  lexicalHits: LexicalSearchHit[];
  semanticHits: LexicalSearchHit[];
  limit: number;
  k?: number;
}): LexicalSearchHit[] {
  const merged = new Map<
    string,
    {
      hit: LexicalSearchHit;
      score: number;
    }
  >();

  addRankedHits({ merged, hits: lexicalHits, k });
  addRankedHits({ merged, hits: semanticHits, k });

  return [...merged.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => ({
      ...entry.hit,
      score: entry.score,
    }));
}

function addRankedHits({
  merged,
  hits,
  k,
}: {
  merged: Map<string, { hit: LexicalSearchHit; score: number }>;
  hits: LexicalSearchHit[];
  k: number;
}) {
  hits.forEach((hit, index) => {
    const key = `${hit.source_type}:${hit.id}`;
    const current = merged.get(key);
    const rrfScore = 1 / (k + index + 1);

    if (!current) {
      merged.set(key, {
        hit,
        score: rrfScore,
      });
      return;
    }

    merged.set(key, {
      hit: {
        ...hit,
        snippet: current.hit.snippet || hit.snippet,
        match_offset: current.hit.match_offset ?? hit.match_offset,
      },
      score: current.score + rrfScore,
    });
  });
}
