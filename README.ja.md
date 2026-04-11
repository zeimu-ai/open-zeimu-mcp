[English](README.md) | **日本語**

# open-zeimu-mcp

`open-zeimu-mcp` は、日本の税務一次情報を取得・検索するための OSS
MCP サーバーです。Phase 1 では、外部 DB や API キーなしで動く
server skeleton と `health` / `stats` / `lexical_search` tool を提供します。

## 特徴

- `health`: 稼働状態、uptime、データディレクトリの到達性を返す
- `stats`: source type ごとの文書件数と lexical index の状態を返す
- `lexical_search`: 同梱 Markdown データを lexical 検索する
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

現時点では `health` と `stats` の 2 tool が使えます。

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
