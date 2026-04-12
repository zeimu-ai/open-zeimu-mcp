import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { crawlTsutatsu } from "../../../../src/crawler/tsutatsu/crawler.js";

const rootHtml = `
  <ul>
    <li><a href="/law/tsutatsu/kihon/shotoku/01.htm">所得税法</a></li>
    <li><a href="/law/tsutatsu/kihon/sisan/sozoku2/01.htm">相続税法</a></li>
    <li><a href="/law/tsutatsu/kihon/hojin/01.htm">法人税法</a></li>
    <li><a href="/law/tsutatsu/kihon/chosyu/index.htm">国税徴収法</a></li>
    <li><a href="/law/tsutatsu/kihon/tsusoku/00.htm">国税通則法</a></li>
    <li><a href="/law/tsutatsu/kihon/shinsaseikyu/00.htm">不服審査（国税不服審判所関係）</a></li>
  </ul>
`;

const shotokuIndexHtml = `
  <p><a href="/law/tsutatsu/kihon/shotoku/01/01.htm">〔居住者、非永住者及び非居住者〕</a></p>
`;

const sisanIndexHtml = `
  <p><a href="/law/tsutatsu/kihon/sisan/sozoku2/01/01.htm">〔相続税の課税関係〕</a></p>
`;

const hojinIndexHtml = `
  <p><a href="/law/tsutatsu/kihon/hojin/01/01_01.htm">第1節　納税地及び納税義務</a></p>
`;

const chosyuIndexHtml = `
  <p><a href="/law/tsutatsu/kihon/chosyu/01/001/01.htm">第1関係　目的</a></p>
`;

const tsusokuIndexHtml = `
  <p><a href="/law/tsutatsu/kihon/tsusoku/00/01.htm">前文・説明文</a></p>
`;

const shinsaseikyuIndexHtml = `
  <p><a href="/law/tsutatsu/kihon/shinsaseikyu/00/01.htm">前文・説明文</a></p>
`;

const sisanDocumentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top"><h1>〔相続税の課税関係〕</h1></div>
      <p class="indent1"><strong>1－1　</strong>相続税の課税関係です。</p>
    </div>
  </body>
</html>`;

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

const chosyuDocumentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top"><h1>第1関係　目的</h1></div>
      <p class="indent1"><strong>1－1　</strong>国税徴収法の目的です。</p>
    </div>
  </body>
</html>`;

const tsusokuDocumentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top"><h1>前文・説明文</h1></div>
      <p class="indent1"><strong>0－1　</strong>国税通則法の前文です。</p>
    </div>
  </body>
</html>`;

const shinsaseikyuDocumentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top"><h1>前文・説明文</h1></div>
      <p class="indent1"><strong>0－1　</strong>不服審査の前文です。</p>
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

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku2/01.htm") {
        return new Response(sisanIndexHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/hojin/01.htm") {
        return new Response(hojinIndexHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/chosyu/index.htm") {
        return new Response(chosyuIndexHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/tsusoku/00.htm") {
        return new Response(tsusokuIndexHtml, { status: 200 });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/shinsaseikyu/00.htm") {
        return new Response(shinsaseikyuIndexHtml, { status: 200 });
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

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku2/01/01.htm") {
        return new Response(sisanDocumentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-tsu-sisan"',
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

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/chosyu/01/001/01.htm") {
        return new Response(chosyuDocumentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-tsu-chosyu"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/tsusoku/00/01.htm") {
        return new Response(tsusokuDocumentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-tsu-tsusoku"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      if (url === "https://www.nta.go.jp/law/tsutatsu/kihon/shinsaseikyu/00/01.htm") {
        return new Response(shinsaseikyuDocumentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-tsu-shinsaseikyu"',
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
      discoveredCount: 6,
      newCount: 6,
      updatedCount: 0,
      unchangedCount: 0,
    });

    const shotokuMarkdown = await readFile(
      join(dataDir, "tsutatsu/tsutatsu-shotoku-01-01/tsutatsu-shotoku-01-01.md"),
      "utf8",
    );
    const sisanMarkdown = await readFile(
      join(dataDir, "tsutatsu/tsutatsu-sisan-sozoku2-01-01/tsutatsu-sisan-sozoku2-01-01.md"),
      "utf8",
    );
    const hojinMarkdown = await readFile(
      join(dataDir, "tsutatsu/tsutatsu-hojin-01-01_01/tsutatsu-hojin-01-01_01.md"),
      "utf8",
    );
    const chosyuMarkdown = await readFile(
      join(dataDir, "tsutatsu/tsutatsu-chosyu-01-001-01/tsutatsu-chosyu-01-001-01.md"),
      "utf8",
    );
    const tsusokuMarkdown = await readFile(
      join(dataDir, "tsutatsu/tsutatsu-tsusoku-00-01/tsutatsu-tsusoku-00-01.md"),
      "utf8",
    );
    const shinsaseikyuMarkdown = await readFile(
      join(dataDir, "tsutatsu/tsutatsu-shinsaseikyu-00-01/tsutatsu-shinsaseikyu-00-01.md"),
      "utf8",
    );

    expect(shotokuMarkdown).toContain('id: "tsutatsu-shotoku-01-01"');
    expect(shotokuMarkdown).toContain("# 〔居住者、非永住者及び非居住者（第3、4、5号関係）〕");
    expect(sisanMarkdown).toContain('id: "tsutatsu-sisan-sozoku2-01-01"');
    expect(sisanMarkdown).toContain("# 〔相続税の課税関係〕");
    expect(hojinMarkdown).toContain('id: "tsutatsu-hojin-01-01_01"');
    expect(hojinMarkdown).toContain("# 第1節　納税地及び納税義務");
    expect(chosyuMarkdown).toContain('id: "tsutatsu-chosyu-01-001-01"');
    expect(chosyuMarkdown).toContain("# 第1関係　目的");
    expect(tsusokuMarkdown).toContain('id: "tsutatsu-tsusoku-00-01"');
    expect(tsusokuMarkdown).toContain("# 前文・説明文");
    expect(shinsaseikyuMarkdown).toContain('id: "tsutatsu-shinsaseikyu-00-01"');
    expect(shinsaseikyuMarkdown).toContain("# 前文・説明文");
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
