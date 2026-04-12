# Data Sources

## Packaged Sources

`open-zeimu-mcp` currently ships these packaged Markdown source types:

- `tax_answer`
- `written_answer`
- `tsutatsu`
- `qa_case`
- `saiketsu`

Each packaged document is loaded from `data/<source_type>/**/<id>.md` with optional
`<id>.meta.json`.

## Semantic Vector Operations

Local semantic search uses per-source vector assets under:

```text
VECTORS_CACHE_DIR/<package-version>/
```

Required runtime assets:

- `bge-m3-int8.onnx.tar.gz`
- `tokenizer.json`
- `tokenizer_config.json`

Precomputed retrieval assets:

- `<source_type>-vectors-<version>.bin`
- `<source_type>-vectors-<version>.index.json`

The binary contains concatenated `Float32` embeddings. The JSON index stores:

- `source_type`
- `dimensions`
- `chunk_size`
- `chunk_overlap`
- `chunk_count`
- per-chunk `id`, `chunk_id`, `chunk_offset`

## Precompute Workflow

```bash
npm run precompute:embeddings -- 0.1.0-alpha.0
```

The script:

1. Loads packaged Markdown documents.
2. Splits each document body into overlapping chunks.
3. Encodes every chunk with the local `bge-m3` runtime.
4. Writes one vector binary + one JSON index per source type.

## Operational Notes

- Vector assets are intentionally excluded from git.
- `health` exposes per-source asset presence and aggregate bytes/chunk counts.
- `stats` exposes `semantic_ready`, `vectors_loaded`, and loaded source types.
- If semantic assets are unavailable for a requested source, packaged `search_*`
  tools fall back to lexical search.
