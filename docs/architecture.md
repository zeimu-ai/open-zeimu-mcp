# Architecture

This document summarizes the current implemented architecture and points back to
the confirmed design in
`/Users/tackeyy/dev/zeimu-ai/.tasks/output/open-zeimu-mcp-design-final-001-result.md`.

## Directory Structure

```text
open-zeimu-mcp/
├── data/
├── docs/
├── src/
│   ├── config/
│   ├── crawler/
│   │   ├── git-commit.ts
│   │   └── tax-answer/
│   ├── data/
│   ├── lib/
│   ├── repository/
│   ├── search/
│   ├── tools/
│   ├── types/
│   ├── index.ts
│   └── server.ts
└── tests/
    ├── fixtures/
    ├── integration/
    └── unit/
```

## Implemented Layers

- `src/data/*`: packaged Markdown loader
- `src/search/*`: lexical search index
- `src/tools/*`: MCP tools (`health`, `stats`, `lexical_search`, `list_tax_answer_categories`, `get_tax_answer`, `search_tax_answer`, `get_written_answer`, `search_written_answer`, `get_law`, `search_law`)
- `src/repository/egov-repository.ts`: e-Gov API v2 wrapper with 24h in-memory cache
- `src/crawler/tax-answer/*`: tax-answer discovery, parsing, safety, storage, and CLI

## Retrieval Model

- `tax_answer` is currently packaged with category listing plus direct retrieval/search tools.
- `written_answer` reuses the shared Markdown loader and lexical index, then enriches search hits with `canonical_url`, `license`, and `page_hint`.
- Source-specific tool post-processing is layered on top of the shared lexical index rather than forking search implementations per source.

## Tax Answer Crawler

PR-3 adds a file-based crawler pipeline:

```text
cli.ts
  -> fetch robots.txt
  -> discover seed pages
  -> collect tax-answer URLs
  -> rate limit (1 req/sec)
  -> parse HTML -> Markdown
  -> diff against stored metadata
  -> write changed files only
  -> optional git commit / push with bot author
```

Key safety guards:

- allowlist host: `www.nta.go.jp`
- `robots.txt` enforcement
- count-drop stop at 30%
- deletion stop at 100 files
- 3 consecutive failure days pause future runs

## Security Notes

- Environment values are read from `process.env` only.
- Logs go to `stderr` so stdio MCP traffic on `stdout` is not corrupted.
- Crawler output stores Markdown / JSON only; raw HTML is not persisted.
- Git auto-commit is gated by `--apply`; the default mode is dry run.
