import { describe, expect, it } from "vitest";

import { parseSaiketsuPage } from "../../../../src/crawler/saiketsu/parser.js";

const fixtureHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="contents">
      <div id="main">
        <div id="pankuzu">
          <p><a href="../../index.html">ホーム</a> &gt;&gt; <a href="../../idx/55.html">裁決事例集 No.55</a></p>
        </div>
        <h1>（平10.2.19裁決、裁決事例集No.55　1頁）</h1>
        <p>《裁決書（抄）》</p>
        <h2><span>1　事実</span></h2>
        <p>請求人は相続開始の事実を知っていた。</p>
        <p class="subLink"><a href="01.html">（図表1）</a></p>
        <h2><span>2　判断</span></h2>
        <p>相続放棄は無効である。</p>
        <p class="article_date">平成10年2月19日裁決</p>
      </div>
    </div>
  </body>
</html>`;

describe("parseSaiketsuPage", () => {
  it("extracts title, sections, date, and metadata from a JP page", () => {
    const result = parseSaiketsuPage({
      html: fixtureHtml,
      url: "https://www.kfs.go.jp/service/JP/55/01/index.html",
      crawledAt: "2026-04-12T01:00:00.000Z",
      id: "saiketsu-01-001",
      category: "総則",
      categoryCode: "01",
      citation: "裁決事例集 No.55 - 1頁",
    });

    expect(result.document).toMatchObject({
      id: "saiketsu-01-001",
      title: "（平10.2.19裁決、裁決事例集No.55　1頁）",
      category: "総則",
      canonicalUrl: "https://www.kfs.go.jp/service/JP/55/01/index.html",
      sourceType: "saiketsu",
    });
    expect(result.document.headings).toContain("1　事実");
    expect(result.document.headings).toContain("2　判断");
    expect(result.markdown).toContain("# （平10.2.19裁決、裁決事例集No.55　1頁）");
    expect(result.markdown).toContain("## 1　事実");
    expect(result.markdown).toContain("[（図表1）](https://www.kfs.go.jp/service/JP/55/01/01.html)");
    expect(result.meta).toMatchObject({
      id: "saiketsu-01-001",
      category: "総則",
      document_number: "55-01",
      citation: "裁決事例集 No.55 - 1頁",
      published_at: "1998-02-19",
      source_type: "saiketsu",
    });
    expect(result.meta.content_hash).toMatch(/^sha256:/u);
  });
});
