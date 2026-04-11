# API

The current build exposes ten MCP tools.

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

- `source_types.*.count` counts Markdown documents
- `lexical_index.size` reports indexed documents
- `semantic.vectors_loaded` checks whether cached vector files exist

## `lexical_search`

Input:

```json
{
  "query": "基礎控除",
  "source_types": ["tax_answer"],
  "limit": 5
}
```

Output example:

```json
{
  "hits": [
    {
      "id": "1200",
      "source_type": "tax_answer",
      "title": "所得税の基礎控除",
      "score": 42.1,
      "snippet": "所得税の基礎控除は、一定額を所得から差し引く制度です。"
    }
  ]
}
```

Notes:

- `limit` defaults to `20`
- `limit` max is `50`
- results are boosted by `title > headings > aliases > body`

## `get_tax_answer`

Input:

```json
{
  "id": "1200"
}
```

Output example:

```json
{
  "source_type": "tax_answer",
  "id": "1200",
  "title": "所得税の基礎控除",
  "category": "shotoku",
  "canonical_url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1200.htm",
  "citation": "タックスアンサーNo.1200",
  "content": "所得税の基礎控除は、一定額を所得から差し引く制度です。",
  "headings": ["所得税の基礎控除", "適用要件"],
  "aliases": ["基礎控除"],
  "tags": ["所得税", "控除"],
  "updated_at": null,
  "published_at": null,
  "crawled_at": "2026-04-11T19:00:00.000Z"
}
```

Notes:

- looks up only packaged `tax_answer` Markdown files
- throws if the ID does not exist in `DATA_DIR`

## `list_tax_answer_categories`

Input:

```json
{}
```

Output example:

```json
{
  "source_type": "tax_answer",
  "total_count": 1,
  "categories": [
    {
      "category": "shotoku",
      "document_count": 10,
      "latest_crawled_at": "2026-04-11T00:00:00.000Z"
    }
  ]
}
```

Notes:

- counts only packaged `tax_answer` documents
- skips documents without `category`
- returns one row per category

## `search_tax_answer`

Input:

```json
{
  "query": "基礎控除",
  "limit": 5
}
```

Output example:

```json
{
  "source_type": "tax_answer",
  "query": "基礎控除",
  "total_count": 1,
  "results": [
    {
      "id": "1200",
      "source_type": "tax_answer",
      "title": "所得税の基礎控除",
      "score": 42.1,
      "snippet": "所得税の基礎控除は、一定額を所得から差し引く制度です。"
    }
  ]
}
```

Notes:

- always filters `source_types` down to `tax_answer`
- `limit` defaults to `20`
- `limit` max is `50`

## `get_written_answer`

Input:

```json
{
  "id": "202401"
}
```

Output example:

```json
{
  "source_type": "written_answer",
  "id": "202401",
  "title": "非上場株式の評価に関する文書回答事例",
  "category": "hyoka",
  "canonical_url": "https://www.nta.go.jp/law/bunshokaito/hyoka/240101/01.htm",
  "citation": "文書回答事例 202401",
  "document_number": "令和6年1月1日",
  "content": "第1ページ本文です。\n\n第2ページ本文です。",
  "headings": ["非上場株式の評価に関する文書回答事例"],
  "updated_at": null,
  "published_at": null,
  "crawled_at": "2026-04-11T19:00:00.000Z",
  "license": "public_data",
  "page_count": 2
}
```

Notes:

- looks up only packaged `written_answer` Markdown files
- returns page count from parsed page-break markers when available

## `search_written_answer`

Input:

```json
{
  "query": "第2ページ",
  "limit": 5
}
```

Output example:

```json
{
  "source_type": "written_answer",
  "query": "第2ページ",
  "total_count": 1,
  "results": [
    {
      "id": "202401",
      "source_type": "written_answer",
      "title": "非上場株式の評価に関する文書回答事例",
      "category": "hyoka",
      "canonical_url": "https://www.nta.go.jp/law/bunshokaito/hyoka/240101/01.htm",
      "citation": "文書回答事例 202401",
      "score": 39.8,
      "snippet": "第2ページ本文です。",
      "updated_at": null,
      "license": "public_data",
      "page_hint": "p.2"
    }
  ]
}
```

Notes:

- always filters `source_types` down to `written_answer`
- `page_hint` is derived from parsed page offsets when the match can be located
- `limit` defaults to `20`
- `limit` max is `50`
