# Changelog

## Unreleased (PR-6)

### Added

- `list_tax_answer_categories` MCP tool: 同梱済みタックスアンサーのカテゴリ一覧を返す
- `list_written_answer_categories` MCP tool: 同梱済み文書回答事例のカテゴリ一覧を返す
- `get_tax_answer` MCP tool: 同梱済みタックスアンサー本文を ID で取得
- `search_tax_answer` MCP tool: 同梱済みタックスアンサーのみを対象に検索
- `list_tsutatsu_categories` MCP tool: 同梱済み通達のカテゴリ一覧を返す
- `get_tsutatsu` MCP tool: 同梱済み通達本文を ID で取得
- `search_tsutatsu` MCP tool: 同梱済み通達のみを対象に検索
- `list_qa_case_categories` MCP tool: 同梱済み質疑応答事例のカテゴリ一覧を返す
- `get_qa_case` MCP tool: 同梱済み質疑応答事例本文を ID で取得
- `search_qa_case` MCP tool: 同梱済み質疑応答事例のみを対象に検索
- `list_saiketsu_categories` MCP tool: 同梱済み裁決事例のカテゴリ一覧を返す
- `get_saiketsu` MCP tool: 同梱済み裁決事例本文を ID で取得
- `search_saiketsu` MCP tool: 同梱済み裁決事例のみを対象に検索
- `get_written_answer` MCP tool: 同梱済み文書回答事例本文を ID で取得
- `search_written_answer` MCP tool: 同梱済み文書回答事例のみを対象に検索し `page_hint` を返す
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
- local semantic asset inspector / fallback wiring (`EMBEDDING_BACKEND=local|supabase`)
- `scripts/release-vectors.ts`, `.github/workflows/vectors.yml`, `.changeset/` scaffold
- `onnxruntime-node` optional dependency wiring for local semantic backend

### Changed

- lexical search internals now retain match offsets for source-specific post-processing
- lexical search now uses source-aware internal keys so duplicate document IDs across source types do not collide
- lexical search now supports optional category filters inside packaged `search_*` tools
- markdown loader now normalizes YAML date scalars into ISO strings for typed MCP outputs
- `health` now exposes `vector_assets` state for release-asset diagnostics
- `stats` now treats `supabase` as a stub backend and only marks local vectors as loaded when both release assets exist
- release workflow is now a dry-run scaffold and no longer attempts live npm publish
- README / API docs / architecture / testing guide now document saiketsu, written-answer categories, semantic asset wiring, and release scaffolds

## 0.1.0-alpha.0

### Added

- Markdown loader for packaged tax source documents with frontmatter parsing
- Written-answer page break parsing with `pageOffsets`
- In-memory MiniSearch lexical index with title, heading, alias, and body boosts
- `lexical_search` MCP tool

### Changed

- `stats` now reports lexical index size and build timestamp
- README and API docs now describe lexical search
