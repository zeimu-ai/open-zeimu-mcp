# API

The current build exposes twenty MCP tools.

## `health`

Input:

```json
{}
```

Output example:

```json
{
  "status": "ok",
  "version": "0.1.0-alpha.0",
  "uptime": 12,
  "checks": {
    "data_dir": true,
    "vectors": "disabled"
  },
  "vector_assets": {
    "backend": "none",
    "status": "disabled",
    "ready": false,
    "reason": "EMBEDDING_BACKEND=none"
  }
}
```

Notes:

- `checks.vectors` becomes `true` only when the local semantic asset set is ready.
- `vector_assets` reports the expected model/vector filenames and readiness state.

## `stats`

Input:

```json
{}
```

Output example:

```json
{
  "source_types": {
    "law": { "count": 0, "latest_crawled_at": null },
    "tax_answer": { "count": 10, "latest_crawled_at": "2026-04-11T00:00:00.000Z" },
    "written_answer": { "count": 2, "latest_crawled_at": "2026-04-11T19:00:00.000Z" },
    "tsutatsu": { "count": 4, "latest_crawled_at": "2026-04-12T00:10:00.000Z" },
    "qa_case": { "count": 3, "latest_crawled_at": "2026-04-12T00:20:00.000Z" },
    "saiketsu": { "count": 1, "latest_crawled_at": "2026-04-12T01:00:00.000Z" }
  },
  "lexical_index": {
    "size": 20,
    "built_at": "2026-04-12T00:30:00.000Z"
  },
  "semantic": {
    "backend": "local",
    "vectors_loaded": true
  }
}
```

Notes:

- `semantic.vectors_loaded` is `true` only for the local backend with both release assets present.
- `supabase` is currently exposed as a stub backend.

## `lexical_search`

Input:

```json
{
  "query": "基礎控除",
  "source_types": ["tax_answer"],
  "limit": 5
}
```

Notes:

- `limit` defaults to `20`.
- `limit` max is `50`.
- `lexical_search` does not apply packaged-source category filters. Category filtering is exposed on source-specific `search_*` tools.

## Packaged Source Tools

The following tool families share the same conventions:

- `list_*_categories` returns category summaries for one packaged source type.
- `get_*` returns one packaged document by ID.
- `search_*` runs lexical search constrained to one source type and accepts:
  - `query`: required string
  - `category`: optional string
  - `limit`: optional integer, max `50`

### Tax Answer

- `list_tax_answer_categories`
- `get_tax_answer`
- `search_tax_answer`

Example:

```json
{
  "name": "search_tax_answer",
  "arguments": {
    "query": "基礎控除",
    "category": "shotoku",
    "limit": 5
  }
}
```

### Written Answer

- `list_written_answer_categories`
- `get_written_answer`
- `search_written_answer`

Example:

```json
{
  "name": "search_written_answer",
  "arguments": {
    "query": "第2ページ",
    "category": "hyoka",
    "limit": 5
  }
}
```

Notes:

- `search_written_answer` adds `page_hint` when the hit can be mapped to parsed page offsets.
- `get_written_answer` returns `page_count`.

### Tsutatsu

- `list_tsutatsu_categories`
- `get_tsutatsu`
- `search_tsutatsu`

Example:

```json
{
  "name": "search_tsutatsu",
  "arguments": {
    "query": "仕入税額控除",
    "category": "shohi",
    "limit": 5
  }
}
```

### QA Case

- `list_qa_case_categories`
- `get_qa_case`
- `search_qa_case`

Example:

```json
{
  "name": "search_qa_case",
  "arguments": {
    "query": "交際費",
    "category": "hojin",
    "limit": 5
  }
}
```

### Saiketsu

- `list_saiketsu_categories`
- `get_saiketsu`
- `search_saiketsu`

Example:

```json
{
  "name": "search_saiketsu",
  "arguments": {
    "query": "立退料",
    "category": "shotoku",
    "limit": 5
  }
}
```

## e-Gov Law Tools

- `get_law`
- `search_law`

Example:

```json
{
  "name": "get_law",
  "arguments": {
    "law_name": "印紙税法",
    "format": "markdown"
  }
}
```

Notes:

- e-Gov responses are cached in memory for 24 hours.
- No API key is required.
