import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { crawlQaCase } from "../../../../src/crawler/qa-case/crawler.js";

const rootHtml = `
  <ul>
    <li><a href="/law/shitsugi/shotoku/01.htm">所得税</a></li>
    <li><a href="/taxes/sake/qa/01.htm">酒税</a></li>
  </ul>
`;

const categoryHtml = `
  <p><a href="/law/shitsugi/shotoku/01/01.htm">ガス爆発事故に伴い被害者が受領する損害賠償金等</a></p>
`;

const sakeCategoryHtml = `
  <p><a href="/taxes/sake/qa/01/01.htm">酒類の定義</a></p>
`;

const caseHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/law/shitsugi/shotoku/01.htm">所得税</a></li>
      </ol>
      <div class="page-header" id="page-top"><h1>ガス爆発事故に伴い被害者が受領する損害賠償金等</h1></div>
      <h2>【照会要旨】</h2>
      <p>損害賠償金等は課税上どのように取り扱われますか。</p>
      <h2>【回答要旨】</h2>
      <p>心身に加えられた損害につき支払を受ける損害賠償金等として非課税とされます。</p>
      <h2>【関係法令通達】</h2>
      <p>所得税法第9条第1項第18号</p>
    </div>
  </body>
</html>`;

const sakeCaseHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/taxes/sake/qa/01.htm">お酒に関するQ&A</a></li>
      </ol>
      <div class="page-header" id="page-top"><h1>酒類の定義</h1></div>
      <h2>【照会要旨】</h2>
      <p>酒類に該当するかどうかを確認したいです。</p>
      <h2>【回答要旨】</h2>
      <p>酒税法に定める酒類に該当する場合は、酒税の対象となります。</p>
      <h2>【関係法令通達】</h2>
      <p>酒税法第2条</p>
    </div>
  </body>
</html>`;

const unsupportedCaseHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div class="container">
      <div class="page-header" id="page-top"><h1>壊れたページ</h1></div>
    </div>
  </body>
</html>`;

describe("crawlQaCase", () => {
  it("writes markdown and metadata for a fetched qa_case document in non-apply mode", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-qa-case-"));
    const dataDir = join(workspace, "data");
    const repoDir = workspace;
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /private/\n", { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/shitsugi/01.htm") {
        return new Response(rootHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/shitsugi/shotoku/01.htm") {
        return new Response(categoryHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/taxes/sake/qa/01.htm") {
        return new Response(sakeCategoryHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/shitsugi/shotoku/01/01.htm") {
        return new Response(caseHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-qa"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      if (url === "https://www.nta.go.jp/taxes/sake/qa/01/01.htm") {
        return new Response(sakeCaseHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-sake"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      return new Response("not found", { status: 404 });
    };

    const result = await crawlQaCase({
      dataDir,
      repoDir,
      apply: false,
      dryRun: false,
      limit: null,
      ids: [],
      logger: console,
      fetchImpl,
      now: () => new Date("2026-04-12T01:00:00.000Z"),
      limiter: { wait: async () => {} },
    });

    expect(result).toMatchObject({
      discoveredCount: 2,
      newCount: 2,
      updatedCount: 0,
      unchangedCount: 0,
    });

    const markdown = await readFile(
      join(dataDir, "qa_case/qa-shotoku-01-01/qa-shotoku-01-01.md"),
      "utf8",
    );
    const metadata = JSON.parse(
      await readFile(
        join(dataDir, "qa_case/qa-shotoku-01-01/qa-shotoku-01-01.meta.json"),
        "utf8",
      ),
    ) as { id: string; version: number; etag: string };

    expect(markdown).toContain('id: "qa-shotoku-01-01"');
    expect(markdown).toContain("# ガス爆発事故に伴い被害者が受領する損害賠償金等");
    expect(metadata).toMatchObject({
      id: "qa-shotoku-01-01",
      version: 1,
      etag: '"fixture-etag-qa"',
    });

    const sakeMarkdown = await readFile(
      join(dataDir, "qa_case/qa-sake-01-01/qa-sake-01-01.md"),
      "utf8",
    );
    const sakeMetadata = JSON.parse(
      await readFile(
        join(dataDir, "qa_case/qa-sake-01-01/qa-sake-01-01.meta.json"),
        "utf8",
      ),
    ) as { id: string; version: number; etag: string };

    expect(sakeMarkdown).toContain('id: "qa-sake-01-01"');
    expect(sakeMarkdown).toContain("# 酒類の定義");
    expect(sakeMetadata).toMatchObject({
      id: "qa-sake-01-01",
      version: 1,
      etag: '"fixture-etag-sake"',
    });
  });

  it("skips unsupported pages and continues crawling", async () => {
    const unsupportedCategoryHtml = `
      <p><a href="/law/shitsugi/shotoku/01/01.htm">ガス爆発事故に伴い被害者が受領する損害賠償金等</a></p>
      <p><a href="/law/shitsugi/shotoku/01/02.htm">壊れたページ</a></p>
    `;
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-qa-case-"));
    const dataDir = join(workspace, "data");
    const repoDir = workspace;
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /private/\n", { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/shitsugi/01.htm") {
        return new Response(rootHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/shitsugi/shotoku/01.htm") {
        return new Response(unsupportedCategoryHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/taxes/sake/qa/01.htm") {
        return new Response("<p>empty</p>", { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/shitsugi/shotoku/01/01.htm") {
        return new Response(caseHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-qa"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      if (url === "https://www.nta.go.jp/law/shitsugi/shotoku/01/02.htm") {
        return new Response(unsupportedCaseHtml, { status: 200 });
      }

      return new Response("not found", { status: 404 });
    };

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = await crawlQaCase({
      dataDir,
      repoDir,
      apply: false,
      dryRun: false,
      limit: null,
      ids: [],
      logger,
      fetchImpl,
      now: () => new Date("2026-04-12T01:00:00.000Z"),
      limiter: { wait: async () => {} },
    });

    expect(result).toMatchObject({
      discoveredCount: 2,
      newCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("skipping unsupported page url=https://www.nta.go.jp/law/shitsugi/shotoku/01/02.htm"),
    );

    const markdown = await readFile(
      join(dataDir, "qa_case/qa-shotoku-01-01/qa-shotoku-01-01.md"),
      "utf8",
    );
    expect(markdown).toContain("# ガス爆発事故に伴い被害者が受領する損害賠償金等");
  });

  it("skips discovery when robots.txt disallows the root", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-qa-case-"));

    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /law/shitsugi/\n", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    };

    await expect(
      crawlQaCase({
        dataDir: join(workspace, "data"),
        repoDir: workspace,
        apply: false,
        dryRun: false,
        limit: null,
        ids: [],
        logger: console,
        fetchImpl,
        now: () => new Date("2026-04-12T01:00:00.000Z"),
        limiter: { wait: async () => {} },
      }),
    ).rejects.toThrow(/robots\.txt disallows qa_case root/u);
  });
});
