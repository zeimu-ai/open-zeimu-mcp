import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { crawlSaiketsu } from "../../../../src/crawler/saiketsu/crawler.js";

const rootHtml = `
  <ul>
    <li><a href="0101000000.html">納付義務の承継</a></li>
  </ul>
`;

const sectionHtml = `
  <!-- InstanceParam name="GroupName" type="text" value="総則" -->
  <!-- InstanceParam name="PageTitle" type="text" value="納付義務の承継" -->
  <div>
    <p class="article_point">▼ <a href="../../JP/55/01/index.html">裁決事例集 No.55 - 1頁</a></p>
    <p class="article_point">▼ <a href="../../JP/119/01/index.html">令和2年4月17日裁決</a></p>
  </div>
`;

const firstDocumentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="contents">
      <div id="main">
        <h1>（平10.2.19裁決、裁決事例集No.55　1頁）</h1>
        <p>《裁決書（抄）》</p>
        <h2><span>1　事実</span></h2>
        <p>請求人は相続開始の事実を知っていた。</p>
        <p class="article_date">平成10年2月19日裁決</p>
      </div>
    </div>
  </body>
</html>`;

const secondDocumentHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="contents">
      <div id="main">
        <h1>（令和2年4月17日裁決、裁決事例集No.119　1頁）</h1>
        <p>《裁決書（抄）》</p>
        <h2><span>1　事実</span></h2>
        <p>請求人は相続放棄を主張した。</p>
        <p class="article_date">令和2年4月17日裁決</p>
      </div>
    </div>
  </body>
</html>`;

describe("crawlSaiketsu", () => {
  it("writes markdown and metadata for fetched saiketsu documents in non-apply mode", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-saiketsu-"));
    const dataDir = join(workspace, "data");
    const repoDir = workspace;
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.kfs.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /private/\n", { status: 200 });
      }

      if (url === "https://www.kfs.go.jp/service/MP/01/index.html") {
        return new Response(rootHtml, { status: 200 });
      }

      if (url === "https://www.kfs.go.jp/service/MP/01/0101000000.html") {
        return new Response(sectionHtml, { status: 200 });
      }

      if (url === "https://www.kfs.go.jp/service/JP/55/01/index.html") {
        return new Response(firstDocumentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-saiketsu-1"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      if (url === "https://www.kfs.go.jp/service/JP/119/01/index.html") {
        return new Response(secondDocumentHtml, {
          status: 200,
          headers: {
            etag: '"fixture-etag-saiketsu-2"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      return new Response("not found", { status: 404 });
    };

    const result = await crawlSaiketsu({
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

    const firstMarkdown = await readFile(
      join(dataDir, "saiketsu/saiketsu-01-001/saiketsu-01-001.md"),
      "utf8",
    );
    const secondMetadata = JSON.parse(
      await readFile(
        join(dataDir, "saiketsu/saiketsu-01-002/saiketsu-01-002.meta.json"),
        "utf8",
      ),
    ) as { id: string; version: number; etag: string; category: string };

    expect(firstMarkdown).toContain('id: "saiketsu-01-001"');
    expect(firstMarkdown).toContain("# （平10.2.19裁決、裁決事例集No.55　1頁）");
    expect(secondMetadata).toMatchObject({
      id: "saiketsu-01-002",
      version: 1,
      etag: '"fixture-etag-saiketsu-2"',
      category: "総則",
    });
  });

  it("skips discovery when robots.txt disallows the root", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-saiketsu-"));

    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.kfs.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /service/MP/01/\n", {
          status: 200,
        });
      }

      return new Response("not found", { status: 404 });
    };

    await expect(
      crawlSaiketsu({
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
    ).rejects.toThrow(/robots\.txt disallows saiketsu root/u);
  });
});
