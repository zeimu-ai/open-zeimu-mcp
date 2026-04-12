# Architecture

This document summarizes the currently implemented architecture and points back
to the confirmed design in
`/Users/tackeyy/dev/zeimu-ai/.tasks/output/open-zeimu-mcp-design-final-001-result.md`.

## Directory Structure

```text
open-zeimu-mcp/
├── data/
├── docs/
├── scripts/
│   └── release-vectors.ts
│   └── precompute-embeddings.ts
├── src/
│   ├── config/
│   ├── crawler/
│   │   ├── git-commit.ts
│   │   └── tax-answer/
│   ├── data/
│   ├── lib/
│   ├── repository/
│   ├── search/
│   ├── tools/
│   ├── types/
│   ├── index.ts
│   └── server.ts
└── tests/
```

## Implemented Layers

- `src/data/*`: packaged Markdown loader
- `src/search/lexical-index.ts`: in-memory lexical retrieval with source-aware IDs and optional category filtering
- `src/search/semantic-assets.ts`: semantic asset inspection, dynamic `onnxruntime-node` probing, and clean fallback states
- `src/embeddings/bge-m3-runtime.ts`: local query encoder backed by ONNX `bge-m3`
- `src/search/semantic-indexer.ts`: in-memory cosine scan over precomputed chunk vectors
- `src/search/rrf.ts`: reciprocal rank fusion for hybrid retrieval
- `src/search/semantic-engine.ts`: shared semantic/hybrid search orchestration with lexical fallback
- `src/tools/*`: MCP schemas and tool entrypoints for 20 tools
- `src/repository/egov-repository.ts`: e-Gov API v2 wrapper with 24h in-memory cache
- `src/crawler/tax-answer/*`: tax-answer discovery, parsing, safety, storage, and CLI
- `scripts/release-vectors.ts`: release-asset scaffold generator for local semantic search

## Retrieval Model

- `tax_answer`, `written_answer`, `tsutatsu`, `qa_case`, and `saiketsu` are packaged sources loaded from Markdown + optional `.meta.json`.
- Source-specific search tools are thin wrappers over shared lexical + semantic orchestration.
- The lexical index uses a source-aware internal key so identical public IDs can coexist across source types.
- Source-specific `search_*` tools accept an optional `category` filter that is applied in the shared lexical index.
- `written_answer` adds `page_hint` by mapping lexical matches back onto parsed page offsets.

## Semantic Pipeline

- `EMBEDDING_BACKEND=none`: semantic search is disabled.
- `EMBEDDING_BACKEND=local`: the server expects:
  - `bge-m3-int8.onnx.tar.gz`
  - `tokenizer.json`
  - `tokenizer_config.json`
  - `<source_type>-vectors-<version>.bin`
  - `<source_type>-vectors-<version>.index.json`
  under `VECTORS_CACHE_DIR/<version>/`
- `EMBEDDING_BACKEND=supabase`: currently a stub state for future work.
- `onnxruntime-node` is optional and loaded dynamically only after the local asset set is complete.

Pipeline:

```text
query
  -> @huggingface/tokenizers tokenizer.json + tokenizer_config.json
  -> onnxruntime-node + bge-m3 ONNX
  -> normalized query vector
  -> semantic-indexer cosine scan over precomputed chunk vectors
  -> per-document best chunk
  -> optional RRF with lexical search
  -> source-specific MCP output shaping
```

Precompute flow:

```text
packaged markdown documents
  -> chunk by EMBEDDING_CHUNK_SIZE / EMBEDDING_CHUNK_OVERLAP
  -> encode each chunk with the same local runtime
  -> write Float32 binary + JSON index per source type
```

## Tax Answer Crawler

```text
cli.ts
  -> fetch robots.txt
  -> discover seed pages
  -> collect tax-answer URLs
  -> rate limit (1 req/sec)
  -> parse HTML -> Markdown
  -> diff against stored metadata
  -> write changed files only
  -> optional git commit / push with bot author
```

Key safety guards:

- allowlist host: `www.nta.go.jp`
- `robots.txt` enforcement
- count-drop stop at 30%
- deletion stop at 100 files
- 3 consecutive failure days pause future runs

## Release Scaffolds

- `.changeset/` is configured for public package versioning
- `.github/workflows/release.yml` performs changeset validation and `npm publish --dry-run`
- `.github/workflows/vectors.yml` generates the vector release scaffold artifact

## Security Notes

- Environment values are read from `process.env` only.
- Logs go to `stderr` so stdio MCP traffic on `stdout` is not corrupted.
- Crawler output stores Markdown / JSON only; raw HTML is not persisted.
- The large ONNX model, tokenizer assets, and vector binaries are intentionally excluded from git.
