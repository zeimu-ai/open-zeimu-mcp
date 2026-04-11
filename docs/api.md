# API

The current build exposes sixteen MCP tools.

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
    "tsutatsu": { "count": 4, "latest_crawled_at": "2026-04-12T00:10:00.000Z" },
    "qa_case": { "count": 3, "latest_crawled_at": "2026-04-12T00:20:00.000Z" },
    "written_answer": { "count": 2, "latest_crawled_at": "2026-04-11T19:00:00.000Z" },
    "saiketsu": { "count": 0, "latest_crawled_at": null }
  },
  "lexical_index": {
    "size": 9,
    "built_at": "2026-04-12T00:30:00.000Z"
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

## `list_tsutatsu_categories`

Input:

```json
{}
```

Output example:

```json
{
  "source_type": "tsutatsu",
  "total_count": 1,
  "categories": [
    {
      "category": "shohi",
      "document_count": 1,
      "latest_crawled_at": "2026-04-12T00:10:00.000Z"
    }
  ]
}
```

Notes:

- counts only packaged `tsutatsu` documents
- skips documents without `category`
- returns one row per category

## `get_tsutatsu`

Input:

```json
{
  "id": "tsu-001"
}
```

Output example:

```json
{
  "source_type": "tsutatsu",
  "id": "tsu-001",
  "title": "消費税の仕入税額控除に関する通達",
  "category": "shohi",
  "canonical_url": "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/001.htm",
  "citation": "消費税基本通達11-6-1",
  "document_number": "課消2-1",
  "content": "適格請求書等保存方式における仕入税額控除の考え方を整理した通達です。",
  "headings": ["消費税の仕入税額控除に関する通達", "取扱い"],
  "aliases": ["仕入税額控除通達"],
  "tags": ["消費税", "インボイス"],
  "updated_at": null,
  "published_at": null,
  "crawled_at": "2026-04-12T00:10:00.000Z",
  "license": "public_data"
}
```

Notes:

- looks up only packaged `tsutatsu` Markdown files
- throws if the ID does not exist in `DATA_DIR`

## `search_tsutatsu`

Input:

```json
{
  "query": "仕入税額控除",
  "limit": 5
}
```

Output example:

```json
{
  "source_type": "tsutatsu",
  "query": "仕入税額控除",
  "total_count": 1,
  "results": [
    {
      "id": "tsu-001",
      "source_type": "tsutatsu",
      "title": "消費税の仕入税額控除に関する通達",
      "category": "shohi",
      "canonical_url": "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/001.htm",
      "citation": "消費税基本通達11-6-1",
      "score": 25.5,
      "snippet": "適格請求書等保存方式における仕入税額控除の考え方を整理した通達です。",
      "updated_at": null,
      "license": "public_data"
    }
  ]
}
```

Notes:

- always filters `source_types` down to `tsutatsu`
- `limit` defaults to `20`
- `limit` max is `50`

## `list_qa_case_categories`

Input:

```json
{}
```

Output example:

```json
{
  "source_type": "qa_case",
  "total_count": 1,
  "categories": [
    {
      "category": "hojin",
      "document_count": 1,
      "latest_crawled_at": "2026-04-12T00:20:00.000Z"
    }
  ]
}
```

Notes:

- counts only packaged `qa_case` documents
- skips documents without `category`
- returns one row per category

## `get_qa_case`

Input:

```json
{
  "id": "qa-001"
}
```

Output example:

```json
{
  "source_type": "qa_case",
  "id": "qa-001",
  "title": "交際費の判定に関する質疑応答事例",
  "category": "hojin",
  "canonical_url": "https://www.nta.go.jp/law/shitsugi/hojin/001.htm",
  "citation": "質疑応答事例 法人税 交際費",
  "document_number": "法人税QA-001",
  "content": "得意先に対する飲食費が交際費等に該当するかを解説する質疑応答事例です。",
  "headings": ["交際費の判定に関する質疑応答事例", "回答"],
  "aliases": ["交際費Q&A"],
  "tags": ["法人税", "交際費"],
  "updated_at": null,
  "published_at": null,
  "crawled_at": "2026-04-12T00:20:00.000Z",
  "license": "public_data"
}
```

Notes:

- looks up only packaged `qa_case` Markdown files
- throws if the ID does not exist in `DATA_DIR`

## `search_qa_case`

Input:

```json
{
  "query": "交際費",
  "limit": 5
}
```

Output example:

```json
{
  "source_type": "qa_case",
  "query": "交際費",
  "total_count": 1,
  "results": [
    {
      "id": "qa-001",
      "source_type": "qa_case",
      "title": "交際費の判定に関する質疑応答事例",
      "category": "hojin",
      "canonical_url": "https://www.nta.go.jp/law/shitsugi/hojin/001.htm",
      "citation": "質疑応答事例 法人税 交際費",
      "score": 24.7,
      "snippet": "得意先に対する飲食費が交際費等に該当するかを解説する質疑応答事例です。",
      "updated_at": null,
      "license": "public_data"
    }
  ]
}
```

Notes:

- always filters `source_types` down to `qa_case`
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
