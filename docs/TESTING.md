# Testing Guide

## Scope

`open-zeimu-mcp` uses Vitest for unit and integration-style tests. PR-3 adds
coverage for:

- tax-answer HTML parsing
- change detection (`ETag` / `Last-Modified` / `content_hash`)
- `1 req/sec` rate limiting
- robots / allowlist policies
- crawler write flow into `data/tax_answer/<id>/`

## Core Commands

```bash
npm run typecheck
npm test
npm run build
```

Target a single test file during TDD:

```bash
node ./node_modules/vitest/vitest.mjs run tests/unit/crawler/tax-answer/parser.test.ts
```

## Fixture Strategy

- HTML fixtures live under `tests/fixtures/crawler/tax-answer/html/`
- Parsed output is asserted from fixtures before running any live fetch
- Live verification should use `--ids` with a small page set and keep `--apply`
  off unless a maintainer explicitly wants a commit and push

## Live Dry Run

```bash
npm run crawl:tax-answer -- --ids 1200,3105 --data-dir ./data --repo-dir .
```

This fetches live NTA pages, respects `robots.txt`, prints the planned document
count and disk estimate, and stops before writing git commits.
