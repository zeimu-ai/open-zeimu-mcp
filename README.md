[English](README.en.md) | **日本語**

# open-zeimu-mcp

`open-zeimu-mcp` は、日本の税務一次情報を検索するための OSS MCP
サーバーです。税理士・会計事務所の方が、AIアシスタント（Claude など）から
公開された税務情報をそのまま調べられるようにするための道具です。

## このツールでできること

- AIアシスタント（Claude など）から、国税庁のタックスアンサーを直接検索できます
- 所得税法・法人税法などの法令を、その場で調べられます
- 通達、質疑応答事例、裁決事例などの一次情報をまとめて確認できます
- 税務の確認作業を「検索先を探すところ」から短縮できます

## MCPとは？

MCP は「AIアシスタントに専門知識を追加するためのプラグインのようなもの」です。

- プラグイン: いつもの AI に、あとから機能を足す仕組み
- 専門知識: この場合は税務の公開情報や法令

つまり MCP を使うと、AIアシスタントに「税務情報を探す係」を追加できます。

## MCPの使い方

### 前提条件

- Claude Desktop などの MCP対応AIツール（MCPを使える AI アプリ）
- `npx` を使える環境（Node.js に付属する一時実行コマンド）

### 1. Claude Desktop で使う

Claude Desktop では、`claude_desktop_config.json`（設定ファイル）に
MCP サーバー情報を書きます。

Mac の場合は、通常 `~/Library/Application Support/Claude/claude_desktop_config.json`
にあります。

設定例:

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

手順:

1. Claude Desktop の設定ファイル `claude_desktop_config.json` を開きます
2. 上の内容を `mcpServers` に追加します
3. 保存します
4. Claude Desktop を再起動します
5. AI チャットで税務の質問をします

### 2. npx で使う

`npx`（Node.js の一時実行コマンド）を使うと、事前に手元へ
インストールしなくても起動できます。

やることは次のとおりです。

1. MCP対応AIツールの設定画面を開きます
2. `command` に `npx` を指定します
3. `args` に `-y @zeimu-ai/open-zeimu-mcp` を指定します
4. 必要に応じて `env` に `EMBEDDING_BACKEND` などを設定します
5. 保存して再起動します

### 3. 実際に聞けること

AIアシスタントに、次のような質問をそのまま入力できます。

- 「消費税の簡易課税制度について教えて」
- 「所得税法の青色申告特別控除について調べて」
- 「法人税法上の交際費の考え方を確認して」
- 「タックスアンサーで扶養控除の説明を探して」
- 「仕入税額控除に関する通達を調べて」

### 4. 画面操作のイメージ

- Claude Desktop を開く
- 設定ファイルに MCP サーバーを追加する
- 再起動する
- AI に質問を入れる
- 返ってきた回答の中で、必要に応じて出典や条文を確認する

## よくある質問

### 無料で使えますか？

このツール自体は OSS（オープンソースソフトウェア）なので無料で使えます。
ただし、Claude Desktop などの AI アシスタント側に料金が必要な場合があります。

### データはどこから取得していますか？

主に次の公開情報を使います。

- 国税庁のタックスアンサー
- 国税庁の通達、文書回答事例、質疑応答事例
- 国税不服審判所の裁決事例
- e-Gov 法令 API（法令の公開データ）

### 自分のデータが送信されることはありますか？

このツールは、公開されている税務情報を検索するためのものです。
あなたの会計データや社内データベースを勝手に取得することはありません。

ただし、AIアシスタントに入力した質問文は、使っている AI ツールの仕様に従って
そのツール側に送信されます。個人情報や機密情報は、必要な範囲だけを入力する
運用が安全です。

## 開発者向け情報

以下は、セットアップや開発時に必要な詳細情報です。

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
- `crawl:written-answer`: NTA 文書回答事例を Markdown + metadata に正規化する
- `crawl:tsutatsu`: NTA 通達を Markdown + metadata に正規化する
- `crawl:qa-case`: NTA 質疑応答事例を Markdown + metadata に正規化する
- `crawl:saiketsu`: KFS 裁決事例を Markdown + metadata に正規化する
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
raw HTML は保存しません。`--ids` 指定時のカテゴリ推定は、同梱済み
タックスアンサー全件に含まれる `hyoka` / `osirase` を含めてカバーします。

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

## 文書回答事例 crawler

`www.nta.go.jp` の NTA 文書回答事例を取得し、`robots.txt` を尊重し、
`1 req/2sec` を守りながら Markdown / JSON metadata だけを書き出します。
raw HTML は保存しません。

dry-run:

```bash
npm run crawl:written-answer -- --ids bunshokaito-shotoku-250101,bunshokaito-hojin-250102 --data-dir ./data --repo-dir .
```

apply:

```bash
npm run crawl:written-answer -- --apply --limit 80 --data-dir ./data --repo-dir .
```

出力先:

```text
data/written_answer/<id>/<id>.md
data/written_answer/<id>/<id>.meta.json
```

## 通達 crawler

`www.nta.go.jp` の NTA 通達を取得し、`robots.txt` を尊重し、
`1 req/2sec` を守りながら Markdown / JSON metadata だけを書き出します。
raw HTML は保存しません。

dry-run:

```bash
npm run crawl:tsutatsu -- --ids tsutatsu-shotoku-01-01,tsutatsu-hojin-01-01_01 --data-dir ./data --repo-dir .
```

apply:

```bash
npm run crawl:tsutatsu -- --apply --limit 150 --data-dir ./data --repo-dir .
```

出力先:

```text
data/tsutatsu/<id>/<id>.md
data/tsutatsu/<id>/<id>.meta.json
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

## 裁決事例 crawler

`www.kfs.go.jp` の国税不服審判所 公表裁決事例を取得し、`robots.txt` を尊重し、
`1 req/2sec` を守りながら Markdown / JSON metadata だけを書き出します。
raw HTML は保存しません。

dry-run:

```bash
npm run crawl:saiketsu -- --ids saiketsu-01-001,saiketsu-01-002 --data-dir ./data --repo-dir .
```

apply:

```bash
npm run crawl:saiketsu -- --apply --limit 50 --data-dir ./data --repo-dir .
```

出力先:

```text
data/saiketsu/<id>/<id>.md
data/saiketsu/<id>/<id>.meta.json
```

## データライセンス

- NTA タックスアンサー: 国税庁公開データ
- NTA 文書回答事例: 国税庁公開データ
- NTA 通達: 国税庁公開データ
- NTA 質疑応答事例: 国税庁公開の政府著作物（CC-BY 4.0 互換）
- KFS 裁決事例: 国税不服審判所公開裁決事例

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
search、tax-answer crawler、文書回答事例 crawler、通達 crawler、5 source
type の packaged retrieval/search、category filter、e-Gov 法令取得、vector
precompute、release dry-run scaffold まで実装済みです。

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
