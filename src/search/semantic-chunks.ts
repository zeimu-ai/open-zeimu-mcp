export type SemanticChunk = {
  chunk_id: number;
  chunk_offset: number;
  text: string;
};

export function splitIntoSemanticChunks({
  text,
  chunkSize,
  overlap,
}: {
  text: string;
  chunkSize: number;
  overlap: number;
}): SemanticChunk[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (chunkSize <= 0) {
    throw new Error("chunkSize must be positive");
  }

  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap must be between 0 and chunkSize - 1");
  }

  const chunks: SemanticChunk[] = [];
  let offset = 0;
  let chunkId = 0;

  while (offset < normalized.length) {
    const textChunk = normalized.slice(offset, offset + chunkSize).trim();
    if (textChunk) {
      chunks.push({
        chunk_id: chunkId,
        chunk_offset: offset,
        text: textChunk,
      });
    }

    if (offset + chunkSize >= normalized.length) {
      break;
    }

    offset += chunkSize - overlap;
    chunkId += 1;
  }

  return chunks;
}

export function buildChunkSnippet(text: string, maxLength = 120) {
  return text.replace(/\s+/gu, " ").trim().slice(0, maxLength);
}
