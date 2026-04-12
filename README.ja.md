[English](README.md) | **日本語**

# open-zeimu-mcp

`open-zeimu-mcp` は、日本の税務一次情報を取得・検索するための OSS MCP
サーバーです。現在は lexical search、タックスアンサー・文書回答事例・通達・
質疑応答事例・裁決事例のカテゴリ一覧/取得/検索、e-Gov 法令取得、NTA
タックスアンサー crawler、local semantic search / hybrid search を実装しています。

## 特徴

- `health`: 稼働状態、uptime、vector asset 状態を返す
- `stats`: source type ごとの文書件数と lexical/semantic readiness を返す
- `lexical_search`: 同梱 Markdown データを lexical 検索する
- `list_tax_answer_categories` / `get_tax_answer` / `search_tax_answer`
- `list_written_answer_categories` / `get_written_answer` / `search_written_answer`
- `list_tsutatsu_categories` / `get_tsutatsu` / `search_tsutatsu`
- `list_qa_case_categories` / `get_qa_case` / `search_qa_case`
- `list_saiketsu_categories` / `get_saiketsu` / `search_saiketsu`
- `get_law` / `search_law`: e-Gov 法令 API v2 を 24h in-memory cache 付きで呼ぶ
- `crawl:tax-answer`: NTA タックスアンサーを Markdown + metadata に正規化する
- `crawl:qa-case`: NTA 質疑応答事例を Markdown + metadata に正規化する
- `precompute:embeddings`: packaged source を chunk 単位で埋め込み事前計算する
- `release:vectors`: local semantic search 用 release asset の足場を生成する

## クイックスタート

```bash
npm install @zeimu-ai/open-zeimu-mcp
```

MCP クライアント設定例:

```json
{
  "mcpServers": {
    "open-zeimu-mcp": {
      "command": "npx",
      "args": ["-y", "@zeimu-ai/open-zeimu-mcp"],
      "env": {
        "EMBEDDING_BACKEND": "none",
        "LOG_LEVEL": "info",
        "DATA_DIR": "./data"
      }
    }
  }
}
```

## 設定

| 変数 | デフォルト | 説明 |
| --- | --- | --- |
| `EMBEDDING_BACKEND` | `none` | `none` / `local` / `supabase` |
| `LOG_LEVEL` | `info` | Pino のログレベル |
| `DATA_DIR` | `./data` | データセットのルートディレクトリ |
| `VECTORS_CACHE_DIR` | `~/.cache/open-zeimu-mcp/vectors` | ローカル vector cache |
| `ONNX_MODEL_FILENAME` | `bge-m3-int8.onnx.tar.gz` | local semantic model asset 名 |
| `TOKENIZER_FILENAME` | `tokenizer.json` | tokenizer asset 名 |
| `TOKENIZER_CONFIG_FILENAME` | `tokenizer_config.json` | tokenizer config asset 名 |
| `EMBEDDING_CHUNK_SIZE` | `512` | 事前計算と検索で使う文字チャンク長 |
| `EMBEDDING_CHUNK_OVERLAP` | `64` | 隣接チャンクの重なり幅 |
| `EMBEDDING_MAX_TOKENS` | `512` | query / chunk encode の最大 token 数 |

設定は `process.env` からのみ読み取ります。`.env` の直読みは行いません。

`EMBEDDING_BACKEND=local` では、`VECTORS_CACHE_DIR/<package-version>/` 配下に
model + tokenizer があり、少なくとも 1 source の vector asset があるときに
local semantic backend が ready になります。

- `bge-m3-int8.onnx.tar.gz`
- `tokenizer.json`
- `tokenizer_config.json`
- `<source_type>-vectors-<package-version>.bin`
- `<source_type>-vectors-<package-version>.index.json`

不足している場合は fallback し、`health` で状態を確認できます。

## 利用例

カテゴリ付きタックスアンサー検索:

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

semantic search:

```json
{
  "name": "search_tax_answer",
  "arguments": {
    "query": "給与所得控除の趣旨",
    "category": "shotoku",
    "limit": 5,
    "search_mode": "semantic"
  }
}
```

hybrid search:

```json
{
  "name": "search_tax_answer",
  "arguments": {
    "query": "基礎控除",
    "category": "shotoku",
    "limit": 5,
    "search_mode": "hybrid"
  }
}
```

文書回答事例カテゴリ一覧:

```json
{
  "name": "list_written_answer_categories",
  "arguments": {}
}
```

`page_hint` 付き文書回答事例検索:

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

通達検索:

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

質疑応答事例検索:

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

裁決事例取得/検索:

```json
{
  "name": "get_saiketsu",
  "arguments": {
    "id": "sai-001"
  }
}
```

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

## タックスアンサー crawler

`www.nta.go.jp` の NTA タックスアンサーを取得し、`robots.txt` を尊重し、
`1 req/sec` を守りながら Markdown / JSON metadata だけを書き出します。
raw HTML は保存しません。

dry-run:

```bash
npm run crawl:tax-answer -- --ids 1200,3105 --data-dir ./data --repo-dir .
```

apply:

```bash
npm run crawl:tax-answer -- --apply --limit 50 --data-dir ./data --repo-dir .
```

出力先:

```text
data/tax_answer/<id>/<id>.md
data/tax_answer/<id>/<id>.meta.json
```

## 質疑応答事例 crawler

`www.nta.go.jp` の NTA 質疑応答事例を取得し、`robots.txt` を尊重し、
`1 req/2sec` を守りながら Markdown / JSON metadata だけを書き出します。
raw HTML は保存しません。

dry-run:

```bash
npm run crawl:qa-case -- --ids qa-shotoku-01-01,qa-hojin-01-01 --data-dir ./data --repo-dir .
```

apply:

```bash
npm run crawl:qa-case -- --apply --limit 100 --data-dir ./data --repo-dir .
```

出力先:

```text
data/qa_case/<id>/<id>.md
data/qa_case/<id>/<id>.meta.json
```

## データライセンス

- NTA タックスアンサー: 国税庁公開データ
- NTA 質疑応答事例: 国税庁公開の政府著作物（CC-BY 4.0 互換）

## Vector Release Scaffold

```bash
npm run release:vectors
npm run precompute:embeddings -- 0.1.0-alpha.0
```

`artifacts/vectors/release-plan.json` と placeholder ディレクトリを生成します。
`precompute:embeddings` は `VECTORS_CACHE_DIR/<version>/` に
`<source_type>-vectors-<version>.bin` と
`<source_type>-vectors-<version>.index.json` を出力します。実際の ONNX model、
tokenizer asset、vector binary は git に含めず、GitHub Release asset として別途
アップロードします。

## 現状

active development 中です。現時点で lexical search、semantic search、hybrid
search、tax-answer crawler、5 source type の packaged retrieval/search、
category filter、e-Gov 法令取得、vector precompute、release dry-run scaffold
まで実装済みです。

## 開発

```bash
npm install --include=dev
npm run typecheck
npm test
npm run build
npm run precompute:embeddings -- 0.1.0-alpha.0
npm run release:vectors
npx changeset status
npm run release:dry-run
npm start
```

詳細:

- Architecture: [docs/architecture.md](docs/architecture.md)
- Tool API examples: [docs/api.md](docs/api.md)
- Data-source/vector operations: [docs/data-sources.md](docs/data-sources.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Testing notes: [docs/TESTING.md](docs/TESTING.md)

## ライセンス

[MIT](LICENSE)
