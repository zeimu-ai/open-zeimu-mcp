import { describe, expect, it } from "vitest";

import { parseQaCasePage } from "../../../../src/crawler/qa-case/parser.js";

const fixtureHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/">ホーム</a></li>
        <li><a href="/law/index.htm">法令等</a></li>
        <li><a href="/law/shitsugi/01.htm">質疑応答事例</a></li>
        <li><a href="/law/shitsugi/shohi/01.htm">消費税</a></li>
      </ol>
      <div class="page-header" id="page-top"><h1>会社員が行う建物の貸付けの取扱い</h1></div>
      <h2>【照会要旨】</h2>
      <p>会社員が行う建物の貸付けは、課税の対象となるのでしょうか。</p>
      <h2>【回答要旨】</h2>
      <p>会社員が行う建物の貸付けであっても、反復、継続、独立して行われるものであり、課税対象となります。</p>
      <h2>【関係法令通達】</h2>
      <p>消費税法第2条第1項第8号、消費税法基本通達5-1-1</p>
      <p class="red"><strong>注記<br>令和7年8月1日現在の法令・通達等に基づいて作成しています。</strong></p>
    </div>
  </body>
</html>`;

const sakeFixtureHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/">ホーム</a></li>
        <li><a href="/taxes/sake/qa/01.htm">お酒に関するQ&A</a></li>
        <li><a href="/taxes/sake/qa/01.htm">総則</a></li>
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

const hoteiFixtureHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/">ホーム</a></li>
        <li><a href="/law/index.htm">法令等</a></li>
        <li><a href="/law/shitsugi/01.htm">質疑応答事例</a></li>
        <li><a href="/law/shitsugi/hotei/01.htm">法定調書</a></li>
      </ol>
      <div class="page-header" id="page-top"><h1>法定調書の提出範囲</h1></div>
      <h2>【照会要旨】</h2>
      <p>法定調書の提出範囲を確認したいです。</p>
      <h2>【回答要旨】</h2>
      <p>提出が必要な法定調書は法令により定められています。</p>
      <h2>【関係法令通達】</h2>
      <p>所得税法第225条</p>
    </div>
  </body>
</html>`;

describe("parseQaCasePage", () => {
  it("extracts 照会要旨 / 回答要旨 / 関係法令通達 sections", () => {
    const result = parseQaCasePage({
      html: fixtureHtml,
      url: "https://www.nta.go.jp/law/shitsugi/shohi/02/01.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    expect(result.document).toMatchObject({
      id: "qa-shohi-02-01",
      title: "会社員が行う建物の貸付けの取扱い",
      category: "shohi",
      categoryPath: "消費税",
      canonicalUrl: "https://www.nta.go.jp/law/shitsugi/shohi/02/01.htm",
      sourceType: "qa_case",
    });
    expect(result.markdown).toContain("# 会社員が行う建物の貸付けの取扱い");
    expect(result.markdown).toContain("## 【照会要旨】");
    expect(result.markdown).toContain("## 【回答要旨】");
    expect(result.markdown).toContain("## 【関係法令通達】");
    expect(result.markdown).not.toContain("注記");
    expect(result.meta.content_hash).toMatch(/^sha256:/u);
    expect(result.meta.license).toContain("国税庁 質疑応答事例");
  });

  it("parses the sake qa_case path", () => {
    const result = parseQaCasePage({
      html: sakeFixtureHtml,
      url: "https://www.nta.go.jp/taxes/sake/qa/01/01.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    expect(result.document).toMatchObject({
      id: "qa-sake-01-01",
      category: "sake",
      canonicalUrl: "https://www.nta.go.jp/taxes/sake/qa/01/01.htm",
    });
    expect(result.document.metadata.category_path).toBe("総則");
  });

  it("parses the hotei qa_case path with a one-digit subsection folder", () => {
    const result = parseQaCasePage({
      html: hoteiFixtureHtml,
      url: "https://www.nta.go.jp/law/shitsugi/hotei/1/01.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    expect(result.document).toMatchObject({
      id: "qa-hotei-1-01",
      category: "hotei",
      canonicalUrl: "https://www.nta.go.jp/law/shitsugi/hotei/1/01.htm",
    });
    expect(result.document.metadata.category_path).toBe("法定調書");
  });
});
