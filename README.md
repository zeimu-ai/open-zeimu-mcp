[English](README.md) | [日本語](README.ja.md)

# open-zeimu-mcp

`open-zeimu-mcp` is an OSS MCP server for Japanese tax primary sources. The
current build ships lexical search, packaged retrieval/search tools for tax
answers, written answers, tsutatsu, qa cases, and saiketsu, plus e-Gov law
lookup, a tax-answer crawler, and local semantic search / hybrid search.

## What is open-zeimu-mcp?

- Zero-setup MCP server for Japanese tax primary-source retrieval
- Designed for `npm install @zeimu-ai/open-zeimu-mcp`
- Built on the official Model Context Protocol TypeScript SDK
- Packaged-source search is lexical by default, with opt-in semantic / hybrid retrieval

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

- `health`: reports runtime health, uptime, and vector asset state
- `stats`: reports per-source document counts and lexical/semantic readiness
- `lexical_search`: searches packaged Markdown tax documents in memory
- `list_tax_answer_categories`, `get_tax_answer`, `search_tax_answer`
- `list_written_answer_categories`, `get_written_answer`, `search_written_answer`
- `list_tsutatsu_categories`, `get_tsutatsu`, `search_tsutatsu`
- `list_qa_case_categories`, `get_qa_case`, `search_qa_case`
- `list_saiketsu_categories`, `get_saiketsu`, `search_saiketsu`
- `get_law`, `search_law`: e-Gov Law API v2 with 24h in-memory cache
- `crawl:tax-answer`: NTA Tax Answer crawler to normalized Markdown + metadata
- `crawl:qa-case`: NTA QA case crawler to normalized Markdown + metadata
- `precompute:embeddings`: local chunk embedding precompute for packaged sources
- `release:vectors`: release-asset scaffold generator for local semantic search

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `EMBEDDING_BACKEND` | `none` | `none`, `local`, or `supabase` |
| `LOG_LEVEL` | `info` | Pino log level |
| `DATA_DIR` | `./data` | Root directory for packaged dataset files |
| `VECTORS_CACHE_DIR` | `~/.cache/open-zeimu-mcp/vectors` | Local vector cache path |
| `ONNX_MODEL_FILENAME` | `bge-m3-int8.onnx.tar.gz` | Expected local semantic model asset name |
| `TOKENIZER_FILENAME` | `tokenizer.json` | Expected tokenizer asset name |
| `TOKENIZER_CONFIG_FILENAME` | `tokenizer_config.json` | Expected tokenizer config asset name |
| `EMBEDDING_CHUNK_SIZE` | `512` | Character chunk size used during precompute/search |
| `EMBEDDING_CHUNK_OVERLAP` | `64` | Character overlap between adjacent chunks |
| `EMBEDDING_MAX_TOKENS` | `512` | Max tokenizer length for query / chunk encoding |

This package reads configuration from `process.env` only. It does not load a
`.env` file.

`EMBEDDING_BACKEND=local` becomes ready only when the model + tokenizer exist and
at least one precomputed source vector set exists under
`VECTORS_CACHE_DIR/<package-version>/`:

- `bge-m3-int8.onnx.tar.gz`
- `tokenizer.json`
- `tokenizer_config.json`
- `<source_type>-vectors-<package-version>.bin`
- `<source_type>-vectors-<package-version>.index.json`

If the local semantic set is incomplete, the server falls back cleanly and exposes
the asset state through `health`.

## Tool Examples

Tax answer search with category filter:

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

Tax answer search with semantic mode:

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

Tax answer search with hybrid mode:

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

Written-answer category listing:

```json
{
  "name": "list_written_answer_categories",
  "arguments": {}
}
```

Written-answer search with `page_hint` support:

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

Tsutatsu search with category filter:

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

QA-case search with category filter:

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

Saiketsu retrieval and search:

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

e-Gov law lookup:

```json
{
  "name": "get_law",
  "arguments": {
    "law_name": "印紙税法",
    "format": "markdown"
  }
}
```

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

## QA Case Crawler

The crawler fetches NTA QA case pages from `www.nta.go.jp`, respects
`robots.txt`, enforces `1 req/2sec`, and writes only parsed Markdown / JSON
metadata. Raw HTML is never persisted.

Dry run against specific IDs:

```bash
npm run crawl:qa-case -- --ids qa-shotoku-01-01,qa-hojin-01-01 --data-dir ./data --repo-dir .
```

Apply changes and push a bot commit:

```bash
npm run crawl:qa-case -- --apply --limit 100 --data-dir ./data --repo-dir .
```

Generated files follow:

```text
data/qa_case/<id>/<id>.md
data/qa_case/<id>/<id>.meta.json
```

## Data License

- NTA Tax Answer: public data published by the National Tax Agency
- NTA QA Case: CC-BY 4.0 compatible government work published by the National Tax Agency

## Vector Release Scaffold

Generate the release scaffold for local semantic assets:

```bash
npm run release:vectors
npm run precompute:embeddings -- 0.1.0-alpha.0
```

This writes `artifacts/vectors/release-plan.json` plus placeholder directories
only. `precompute:embeddings` writes `<source_type>-vectors-<version>.bin` plus
`<source_type>-vectors-<version>.index.json` into `VECTORS_CACHE_DIR/<version>/`.
The actual ONNX model, tokenizer assets, and vector binaries are intentionally excluded
from git and should be uploaded as GitHub Release assets.

## Status

Under active development. The current implemented surface covers lexical search,
semantic search, hybrid search, tax-answer crawling, packaged retrieval/search
across five packaged source types, e-Gov law lookup, category filters, vector
precompute, and release dry-run scaffolding on the path to `v0.1.0`.

## Development

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

More details:

- Architecture: [docs/architecture.md](docs/architecture.md)
- Tool API examples: [docs/api.md](docs/api.md)
- Data-source/vector operations: [docs/data-sources.md](docs/data-sources.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Testing notes: [docs/TESTING.md](docs/TESTING.md)

## Data Sources and Licenses

Source-specific attribution and downstream license notices will be expanded as
data loaders land. See [NOTICE](NOTICE).

## License

[MIT](LICENSE)
