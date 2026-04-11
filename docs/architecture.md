# Architecture

This document summarizes the PR-1 server skeleton and points back to the
confirmed design in
`/Users/tackeyy/dev/zeimu-ai/.tasks/output/open-zeimu-mcp-design-final-001-result.md`.

## Directory Structure

The final design targets the following long-term structure:

```text
open-zeimu-mcp/
├── data/
├── docs/
├── scripts/
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── config/
│   ├── tools/
│   ├── services/
│   ├── repository/
│   ├── search/
│   ├── embeddings/
│   ├── loaders/
│   ├── parsers/
│   ├── crawlers/
│   ├── utils/
│   └── types/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

PR-1 implements only the minimum subset needed to boot the server:

- `src/index.ts`
- `src/server.ts`
- `src/config/env.ts`
- `src/tools/health.ts`
- `src/tools/stats.ts`
- `src/lib/logger.ts`
- `src/types/index.ts`
- `tests/unit/*`
- `tests/integration/server.test.ts`

## Server Layer

The agreed startup flow is:

```text
index.ts
  -> load env
  -> create server
  -> build lexical index
  -> optionally load semantic vectors
  -> register tools
  -> connect transport
```

PR-1 implements the first, second, fifth, and sixth steps. Index building and
vector loading remain future PRs.

Current responsibility split:

- `tools/`: MCP schemas and tool handlers
- `repository/`: future wrappers around filesystem reads and e-Gov fetches
- `search/`: future lexical and semantic retrieval
- `loaders/`: future markdown and metadata ingestion

## Security Notes

- Tool descriptions stay minimal and avoid prompt-like instructions.
- Environment values are read from `process.env` only.
- Logs go to `stderr` so stdio MCP traffic on `stdout` is not corrupted.
- `stats` scans only fixed source-type subdirectories under `DATA_DIR`.
