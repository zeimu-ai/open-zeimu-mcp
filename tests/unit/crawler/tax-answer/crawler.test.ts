import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import { crawlTaxAnswer, inferCategoryFromId } from "../../../../src/crawler/tax-answer/crawler.js";

const pageHtml = (id: string) => `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top">
        <h1>No.${id} 税額控除</h1>
      </div>
      <h2>対象税目</h2>
      <p>所得税</p>
      <h2>概要</h2>
      <p>税額控除の説明です。</p>
      <h2>関連コード</h2>
      <ul class="noListImg">
        <li>1250 <a href="/taxes/shiraberu/taxanswer/shotoku/1250.htm">配当所得があるとき(配当控除)</a></li>
      </ul>
    </div>
    <p class="page-top-link"><a href="#page-top">このページの先頭へ</a></p>
  </body>
</html>`;

describe("crawlTaxAnswer", () => {
  it("writes markdown and metadata for a fetched tax answer document in non-apply mode", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-tax-answer-"));
    const dataDir = join(workspace, "data");
    const repoDir = workspace;
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /private/\n", { status: 200 });
      }

      if (url.endsWith("/shotoku/1200.htm")) {
        return new Response(pageHtml("1200"), {
          status: 200,
          headers: {
            etag: '"fixture-etag-1200"',
            "last-modified": "Fri, 11 Apr 2026 00:00:00 GMT",
          },
        });
      }

      return new Response("not found", { status: 404 });
    };

    const result = await crawlTaxAnswer({
      dataDir,
      repoDir,
      apply: false,
      dryRun: false,
      limit: null,
      ids: ["1200"],
      logger: console,
      fetchImpl,
      now: () => new Date("2026-04-11T12:34:56.000Z"),
    });

    expect(result).toMatchObject({
      discoveredCount: 1,
      newCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
    });

    const markdown = await readFile(join(dataDir, "tax_answer/1200/1200.md"), "utf8");
    const metadata = JSON.parse(
      await readFile(join(dataDir, "tax_answer/1200/1200.meta.json"), "utf8"),
    ) as {
      id: string;
      version: number;
      etag: string;
      headings: string[];
    };

    expect(markdown).toContain('id: "1200"');
    expect(markdown).toContain("# 税額控除");
    expect(markdown).toContain("- [配当所得があるとき(配当控除)](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1250.htm)");
    expect(metadata).toMatchObject({
      id: "1200",
      version: 1,
      etag: '"fixture-etag-1200"',
    });
    expect(metadata.headings).toContain("関連コード");
  });

  it("decodes Shift_JIS encoded HTML before parsing tax answer content", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "open-zeimu-mcp-tax-answer-"));
    const dataDir = join(workspace, "data");
    const repoDir = workspace;
    const html = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="shift_jis">
  </head>
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top">
        <h1>No.1200 税額控除</h1>
      </div>
      <h2>対象税目</h2>
      <p>所得税</p>
    </div>
  </body>
</html>`;
    const encodedHtml = iconv.encode(html, "shift_jis");
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "https://www.nta.go.jp/robots.txt") {
        return new Response("User-agent: *\nDisallow: /private/\n", { status: 200 });
      }

      if (url.endsWith("/shotoku/1200.htm")) {
        return new Response(encodedHtml, {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        });
      }

      return new Response("not found", { status: 404 });
    };

    const result = await crawlTaxAnswer({
      dataDir,
      repoDir,
      apply: false,
      dryRun: false,
      limit: null,
      ids: ["1200"],
      logger: console,
      fetchImpl,
      now: () => new Date("2026-04-11T12:34:56.000Z"),
    });

    expect(result).toMatchObject({
      discoveredCount: 1,
      newCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
    });

    const markdown = await readFile(join(dataDir, "tax_answer/1200/1200.md"), "utf8");
    const metadata = JSON.parse(
      await readFile(join(dataDir, "tax_answer/1200/1200.meta.json"), "utf8"),
    ) as {
      title: string;
      content_hash: string;
    };

    expect(markdown).toContain("# 税額控除");
    expect(metadata.title).toBe("税額控除");
    expect(metadata.content_hash).toMatch(/^sha256:/u);
  });

  it("routes explicit ids to the NTA category slug used by the code index", () => {
    expect(inferCategoryFromId("1200")).toBe("shotoku");
    expect(inferCategoryFromId("2502")).toBe("gensen");
    expect(inferCategoryFromId("3105")).toBe("joto");
    expect(inferCategoryFromId("4102")).toBe("sozoku");
    expect(inferCategoryFromId("4402")).toBe("zoyo");
    expect(inferCategoryFromId("4503")).toBe("sozoku");
    expect(inferCategoryFromId("5100")).toBe("hojin");
    expect(inferCategoryFromId("6101")).toBe("shohi");
    expect(inferCategoryFromId("7100")).toBe("inshi");
    expect(inferCategoryFromId("7200")).toBe("fufuku");
    expect(inferCategoryFromId("7400")).toBe("hotei");
    expect(inferCategoryFromId("8001")).toBe("saigai");
  });
});
