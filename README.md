[English](README.md) | [日本語](README.ja.md)

# open-zeimu-mcp

`open-zeimu-mcp` is an OSS MCP server for Japanese tax primary sources.
The current repo ships lexical search, e-Gov law lookup, and a tax-answer
crawler that writes normalized Markdown data into `data/tax_answer/`.

## What is open-zeimu-mcp?

- Zero-setup MCP server for Japanese tax primary-source retrieval
- Designed for `npm install @zeimu-ai/open-zeimu-mcp`
- Built on the official Model Context Protocol TypeScript SDK
- Intended to grow toward tax answers, circulars, rulings, and e-Gov retrieval

## Quick Start

```bash
npm install @zeimu-ai/open-zeimu-mcp
```

Example MCP client configuration:

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

## Features

- `health`: reports runtime health, uptime, and directory readiness
- `stats`: reports per-source document counts and lexical index readiness
- `lexical_search`: searches packaged Markdown tax documents in memory
- `get_law`: fetches law text from e-Gov Law API v2 by law name (24h cache)
- `search_law`: searches laws by keyword via e-Gov Law API v2 (24h cache)
- `crawl:tax-answer`: crawls NTA Tax Answer pages into Markdown + metadata
- Structured output schemas for MCP clients that support typed tool responses
- No API key required (e-Gov Law API v2 is free and open)

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `EMBEDDING_BACKEND` | `none` | `none`, `local`, or `supabase` |
| `LOG_LEVEL` | `info` | Pino log level |
| `DATA_DIR` | `./data` | Root directory for packaged dataset files |
| `VECTORS_CACHE_DIR` | `~/.cache/open-zeimu-mcp/vectors` | Local vector cache path |

This package reads configuration from `process.env` only. It does not load a
`.env` file.

## e-Gov Law Tool Example

Fetch a law by name:

```json
{
  "name": "get_law",
  "arguments": {
    "law_name": "印紙税法",
    "format": "markdown"
  }
}
```

Search laws by keyword:

```json
{
  "name": "search_law",
  "arguments": {
    "query": "印紙税",
    "limit": 5
  }
}
```

Results are cached in memory for 24 hours. No API key is required.

## Tax Answer Crawler

The crawler fetches NTA Tax Answer pages from `www.nta.go.jp`, respects
`robots.txt`, enforces `1 req/sec`, and writes only parsed Markdown / JSON
metadata. Raw HTML is never persisted.

Dry run against specific IDs:

```bash
npm run crawl:tax-answer -- --ids 1200,3105 --data-dir ./data --repo-dir .
```

Apply changes and push a bot commit:

```bash
npm run crawl:tax-answer -- --apply --limit 50 --data-dir ./data --repo-dir .
```

Generated files follow:

```text
data/tax_answer/<id>/<id>.md
data/tax_answer/<id>/<id>.meta.json
```

The metadata file includes `content_hash`, `aliases`, `headings`, `etag`,
`last_modified`, and `version`.

## Status

Under active development. The current implemented surface covers PR-2 lexical
search, PR-3 tax-answer crawling, and PR-5 e-Gov law retrieval on the path to
`v0.1.0`.

## Lexical Search Example

Tool call:

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

Example response:

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

## Development

```bash
npm install --include=dev
npm run typecheck
npm test
npm run build
npm start
```

More details:

- Architecture: [docs/architecture.md](docs/architecture.md)
- Tool API examples: [docs/api.md](docs/api.md)
- Testing notes: [docs/TESTING.md](docs/TESTING.md)

## Data Sources and Licenses

Source-specific attribution and downstream license notices will be expanded as
data loaders land. See [NOTICE](NOTICE).

## License

[MIT](LICENSE)
