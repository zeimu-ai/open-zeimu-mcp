# API

PR-1 exposes two MCP tools.

## `health`

Input:

```json
{}
```

Output example:

```json
{
  "status": "ok",
  "version": "0.0.0",
  "uptime": 12,
  "checks": {
    "data_dir": true,
    "vectors": "disabled"
  }
}
```

Notes:

- `vectors` becomes `true` or `false` when `EMBEDDING_BACKEND` is not `none`.
- `uptime` is returned in seconds.

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
    "tsutatsu": { "count": 0, "latest_crawled_at": null },
    "qa_case": { "count": 0, "latest_crawled_at": null },
    "written_answer": { "count": 0, "latest_crawled_at": null },
    "saiketsu": { "count": 0, "latest_crawled_at": null }
  },
  "lexical_index": {
    "size": 0,
    "built_at": null
  },
  "semantic": {
    "backend": "none",
    "vectors_loaded": false
  }
}
```

Notes:

- PR-1 counts files only.
- `lexical_index` remains a placeholder until the lexical indexer lands.
- `semantic.vectors_loaded` checks whether cached vector files exist.
