import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { crawlTsutatsu } from "../../../../src/crawler/tsutatsu/crawler.js";

const rootHtml = `
  <ul>
    <li><a href="/law/tsutatsu/kihon/shotoku/01.htm">所得税法</a></li>
    <li><a href="/law/tsutatsu/kihon/hojin/01.htm">法人税法</a></li>
  </ul>
`;

const shotokuIndexHtml = `
  <p><a href="/law/tsutatsu/kihon/shotoku/01/01.htm">〔居住者、非永住者及び非居住者〕</a></p>
`;

const hojinIndexHtml = `
  <p><a href="/law/tsutatsu/kihon/hojin/01/01_01.htm">第1節　納税地及び納税義務</a></p>
`;

const shotokuDocumentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <p align="center"><strong>第1編　総則</strong></p>
      <p align="center"><strong>第1章　通則</strong></p>
      <p style="text-align:center"><strong>法第2条《定義》関係</strong></p>
      <div class="page-header" id="page-top"><h1>〔居住者、非永住者及び非居住者（第3、4、5号関係）〕</h1></div>
      <h2>（住所の意義）</h2>
      <p class="indent1"><strong>2－1　</strong>法に規定する住所とは各人の生活の本拠をいう。</p>
    </div>
  </body>
</html>`;

const hojinDocumentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <p align="center"><strong>第1章　総則</strong></p>
      <div class="page-header" id="page-top"><h1>第1節　納税地及び納税義務</h1></div>
      <h2>(法人でない社団の範囲)</h2>
      <p class="indent1"><strong>1－1－1　</strong>法第2条第8号《人格のない社団等の意義》に規定する「法人でない社団」とは、...</p>
    </div>
  </body>
</html>`;

describe("crawlTsutatsu", () => {
  it("writes markdown and metadata for fetched tsutatsu documents in non-apply mode", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-tsutatsu-"));
    const dataDir = join(workspace, "data");
    const repoDir = workspace;
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /private/\n", { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/menu.htm") {
        return new Response(rootHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01.htm") {
        return new Response(shotokuIndexHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/hojin/01.htm") {
        return new Response(hojinIndexHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01/01.htm") {
        return new Response(shotokuDocumentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-tsu-shotoku"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/hojin/01/01_01.htm") {
        return new Response(hojinDocumentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-tsu-hojin"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      return new Response("not found", { status: 404 });
    };

    const result = await crawlTsutatsu({
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

    const shotokuMarkdown = await readFile(
      join(dataDir, "tsutatsu/tsutatsu-shotoku-01-01/tsutatsu-shotoku-01-01.md"),
      "utf8",
    );
    const hojinMarkdown = await readFile(
      join(dataDir, "tsutatsu/tsutatsu-hojin-01-01_01/tsutatsu-hojin-01-01_01.md"),
      "utf8",
    );

    expect(shotokuMarkdown).toContain('id: "tsutatsu-shotoku-01-01"');
    expect(shotokuMarkdown).toContain("# 〔居住者、非永住者及び非居住者（第3、4、5号関係）〕");
    expect(hojinMarkdown).toContain('id: "tsutatsu-hojin-01-01_01"');
    expect(hojinMarkdown).toContain("# 第1節　納税地及び納税義務");
  });

  it("skips discovery when robots.txt disallows the root", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-tsutatsu-"));

    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /law/tsutatsu/\n", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    };

    await expect(
      crawlTsutatsu({
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
    ).rejects.toThrow(/robots\.txt disallows tsutatsu root/u);
  });
});
