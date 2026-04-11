[English](README.md) | **日本語**

# open-zeimu-mcp

`open-zeimu-mcp` は、日本の税務一次情報を取得・検索するための OSS
MCP サーバーです。現在は lexical search、タックスアンサーのカテゴリ一覧
/取得/検索、文書回答事例の取得/検索、e-Gov 法令取得、NTA
タックスアンサー crawler を実装しています。

## 特徴

- `health`: 稼働状態、uptime、データディレクトリの到達性を返す
- `stats`: source type ごとの文書件数と lexical index の状態を返す
- `lexical_search`: 同梱 Markdown データを lexical 検索する
- `list_tax_answer_categories`: 同梱タックスアンサーのカテゴリ一覧を返す
- `get_tax_answer`: ID を指定して同梱タックスアンサー本文を返す
- `search_tax_answer`: 同梱タックスアンサーだけを対象に検索する
- `get_written_answer`: ID を指定して同梱文書回答事例本文を返す
- `search_written_answer`: 同梱文書回答事例だけを対象に検索する
- `get_law`: e-Gov 法令 API v2 から法令本文を取得する
- `search_law`: e-Gov 法令 API v2 をキーワード検索する
- `crawl:tax-answer`: NTA タックスアンサーを Markdown + metadata に正規化する
- official MCP SDK ベースの typed tool output

## クイックスタート

```bash
npm install @zeimu-ai/open-zeimu-mcp
```

## 使い方

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

設定は `process.env` からのみ読み取ります。`.env` の直読みは行いません。

## タックスアンサー crawler

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

raw HTML は保存せず、`robots.txt` と `1 req/sec` を守って実行します。

## タックスアンサー取得例

```json
{
  "name": "get_tax_answer",
  "arguments": {
    "id": "1200"
  }
}
```

```json
{
  "name": "list_tax_answer_categories",
  "arguments": {}
}
```

```json
{
  "name": "search_tax_answer",
  "arguments": {
    "query": "基礎控除",
    "limit": 5
  }
}
```

## 文書回答事例取得例

```json
{
  "name": "get_written_answer",
  "arguments": {
    "id": "202401"
  }
}
```

```json
{
  "name": "search_written_answer",
  "arguments": {
    "query": "第2ページ",
    "limit": 5
  }
}
```

## アーキテクチャ

- [docs/architecture.md](docs/architecture.md)
- [docs/api.md](docs/api.md)

## lexical_search 例

```json
{
  "name": "lexical_search",
  "arguments": {
    "query": "基礎控除",
    "source_types": ["tax_answer"],
    "limit": 5
  }
}
```

## よくある質問

### 何がもう使えますか

現時点では `health`、`stats`、`lexical_search`、
`list_tax_answer_categories`、`get_tax_answer`、`search_tax_answer`、
`get_written_answer`、`search_written_answer`、`get_law`、`search_law`
が利用でき、crawler で tax_answer データを生成できます。

### 本番利用できますか

まだ active development 段階です。`v0.1.0` に向けて機能を拡張中です。

## コントリビューション

コントリビューションを歓迎します。変更を加える前に、まず Issue を作成して議論してください。

```bash
git clone https://github.com/zeimu-ai/open-zeimu-mcp.git
cd open-zeimu-mcp
```

## ライセンス

[MIT](LICENSE)
