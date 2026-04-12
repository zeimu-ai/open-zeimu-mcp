# Testing Guide

## Scope

`open-zeimu-mcp` uses Vitest for unit and integration-style tests. Coverage
currently includes:

- tax-answer HTML parsing and crawler safety rules
- packaged retrieval/search for `tax_answer`
- packaged retrieval/search for `written_answer`
- packaged retrieval/search for `tsutatsu`
- packaged retrieval/search for `qa_case`
- packaged retrieval/search for `saiketsu`
- category-filter behavior across packaged `search_*` tools
- lexical index duplicate-ID handling
- semantic asset inspection and fallback behavior
- MCP integration coverage for the full tool surface

## Core Commands

```bash
npm run typecheck
npm test
npm run build
```

Target a single test file during TDD:

```bash
node ./node_modules/vitest/vitest.mjs run tests/unit/search/semantic-assets.test.ts
node ./node_modules/vitest/vitest.mjs run tests/integration/server.test.ts
```

## Fixture Strategy

- HTML fixtures live under `tests/fixtures/crawler/tax-answer/html/`
- Packaged-source fixtures live under `tests/fixtures/data/<source_type>/`
- Parsed output is asserted from fixtures before running any live fetch

## Live Dry Run

```bash
npm run crawl:tax-answer -- --ids 1200,3105 --data-dir ./data --repo-dir .
```

This fetches live NTA pages, respects `robots.txt`, prints the planned document
count and disk estimate, and stops before writing git commits.

## Release Dry Runs

Validate release scaffolds without publishing:

```bash
npm run release:vectors
npx changeset status
npm run release:dry-run
```
