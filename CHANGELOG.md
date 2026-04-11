# Changelog

## Unreleased (PR-5)

### Added

- `get_tax_answer` MCP tool: 同梱済みタックスアンサー本文を ID で取得
- `search_tax_answer` MCP tool: 同梱済みタックスアンサーのみを対象に検索
- `get_law` MCP tool: 法令名から e-Gov 法令 API v2 経由で法令本文を取得
- `search_law` MCP tool: キーワードで e-Gov 法令 API v2 を検索し法令一覧を返す
- `EgovRepository`: 24h in-memory cache (TTL 24h, max 500 entries, FIFO eviction)
- allowlist ホスト検証 (`laws.e-gov.go.jp` のみ許可)
- レスポンスは markdown/text のみ保持 (raw HTML 非保存)
- 印紙税法フィクスチャとユニットテスト 29 件
- タックスアンサー crawler (`src/crawler/tax-answer/*`) と `npm run crawl:tax-answer`
- HTML -> Markdown parser with frontmatter, `aliases`, `headings`, and `.meta.json`
- 差分検知 (`ETag` / `Last-Modified` / `content_hash`) と source-type 単位の bot commit フロー
- rate limit 1 req/sec, robots policy, allowlist host, count-drop/deletion/failure-day guards
- タックスアンサー fixture / crawler write-flow tests

### Changed

- markdown loader now normalizes YAML date scalars into ISO strings for typed MCP outputs
- README / API docs / testing guide now document tax-answer retrieval and search

## 0.1.0-alpha.0

### Added

- Markdown loader for packaged tax source documents with frontmatter parsing
- Written-answer page break parsing with `pageOffsets`
- In-memory MiniSearch lexical index with title, heading, alias, and body boosts
- `lexical_search` MCP tool

### Changed

- `stats` now reports lexical index size and build timestamp
- README and API docs now describe lexical search
