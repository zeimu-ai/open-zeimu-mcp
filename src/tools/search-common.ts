import { z } from "zod";

import type { LexicalIndex } from "../search/lexical-index.js";
import {
  SEARCH_MODES,
  type SearchMode,
  type SemanticSearchEngine,
  runSearchWithMode,
} from "../search/semantic-engine.js";
import type { SourceType } from "../types/index.js";

export const searchModeSchema = z.enum(SEARCH_MODES).default("lexical");

export async function runSourceSearch({
  lexicalIndex,
  semanticEngine,
  input,
  sourceType,
}: {
  lexicalIndex: LexicalIndex;
  semanticEngine: SemanticSearchEngine;
  input: {
    query: string;
    category?: string;
    limit: number;
    search_mode: SearchMode;
  };
  sourceType: SourceType;
}) {
  return runSearchWithMode({
    lexicalIndex,
    semanticEngine,
    query: input.query,
    category: input.category,
    limit: input.limit,
    sourceType,
    searchMode: input.search_mode,
  });
}
