import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { crawlWrittenAnswer } from "../../../../src/crawler/written-answer/crawler.js";

const rootHtml = `
  <ul>
    <li><a href="/law/bunshokaito/shotoku/02.htm">所得税</a></li>
    <li><a href="/law/bunshokaito/hojin/08.htm">法人税</a></li>
    <li><a href="/law/bunshokaito/shohi/09.htm">消費税</a></li>
  </ul>
`;

const shotokuIndexHtml = `
  <p><a href="/law/bunshokaito/shotoku/250101/index.htm">所得税に関する文書回答事例</a></p>
`;

const hojinIndexHtml = `
  <p><a href="/law/bunshokaito/hojin/250102/index.htm">法人税に関する文書回答事例</a></p>
`;

const shohiIndexHtml = `
  <p><a href="/law/bunshokaito/shohi/250124/index.htm">消費税に関する文書回答事例</a></p>
`;

const documentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/law/bunshokaito/01.htm">文書回答事例</a></li>
      </ol>
      <div class="page-header" id="page-top">
        <h1>文書回答事例の見出し</h1>
      </div>
      <p>概要文</p>
      <p>〔照会〕</p>
      <table>
        <tbody>
          <tr>
            <th scope="row">照会者</th>
            <td>国税庁</td>
          </tr>
        </tbody>
      </table>
      <p id="kaitou">〔回答〕</p>
      <table>
        <tbody>
          <tr>
            <th scope="row">回答年月日</th>
            <td>令和７年１月21日</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>`;

describe("crawlWrittenAnswer", () => {
  it("writes markdown and metadata for fetched written_answer documents in non-apply mode", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-written-answer-"));
    const dataDir = join(workspace, "data");
    const repoDir = workspace;
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /private/\n", { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/bunshokaito/01.htm") {
        return new Response(rootHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }

      if (url === "https://www.nta.go.jp/law/bunshokaito/shotoku/02.htm") {
        return new Response(shotokuIndexHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }

      if (url === "https://www.nta.go.jp/law/bunshokaito/hojin/08.htm") {
        return new Response(hojinIndexHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }

      if (url === "https://www.nta.go.jp/law/bunshokaito/shohi/09.htm") {
        return new Response(shohiIndexHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }

      if (url === "https://www.nta.go.jp/law/bunshokaito/shotoku/250101/index.htm") {
        return new Response(documentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-written-answer-shotoku"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
            "content-type": "text/html; charset=utf-8",
          },
        });
      }

      if (url === "https://www.nta.go.jp/law/bunshokaito/hojin/250102/index.htm") {
        return new Response(documentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-written-answer-hojin"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
            "content-type": "text/html; charset=utf-8",
          },
        });
      }

      if (url === "https://www.nta.go.jp/law/bunshokaito/shohi/250124/index.htm") {
        return new Response(documentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-written-answer-shohi"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
            "content-type": "text/html; charset=utf-8",
          },
        });
      }

      return new Response("not found", { status: 404 });
    };

    const result = await crawlWrittenAnswer({
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
      discoveredCount: 3,
      newCount: 3,
      updatedCount: 0,
      unchangedCount: 0,
    });

    const markdown = await readFile(
      join(dataDir, "written_answer/bunshokaito-shohi-250124/bunshokaito-shohi-250124.md"),
      "utf8",
    );
    const metadata = JSON.parse(
      await readFile(
        join(dataDir, "written_answer/bunshokaito-shohi-250124/bunshokaito-shohi-250124.meta.json"),
        "utf8",
      ),
    ) as { id: string; version: number; etag: string | null };

    expect(markdown).toContain('id: "bunshokaito-shohi-250124"');
    expect(markdown).toContain("# 文書回答事例の見出し");
    expect(metadata).toMatchObject({
      id: "bunshokaito-shohi-250124",
      version: 1,
      etag: '"fixture-etag-written-answer-shohi"',
    });
  });

  it("skips discovery when robots.txt disallows the root", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-written-answer-"));

    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /law/bunshokaito/\n", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    };

    await expect(
      crawlWrittenAnswer({
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
    ).rejects.toThrow(/robots\.txt disallows written_answer root/u);
  });
});
