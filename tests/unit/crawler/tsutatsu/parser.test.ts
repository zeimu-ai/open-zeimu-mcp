import { describe, expect, it } from "vitest";

import { parseTsutatsuPage } from "../../../../src/crawler/tsutatsu/parser.js";

const fixtureHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/law/index.htm">法令等</a></li>
        <li><a href="/law/tsutatsu/menu.htm">法令解釈通達</a></li>
        <li><a href="/law/tsutatsu/kihon/shotoku/01.htm">所得税法</a></li>
      </ol>
      <p align="center"><strong>第1編　総則</strong></p>
      <p align="center"><strong>第1章　通則</strong></p>
      <p style="text-align:center"><strong>法第2条《定義》関係</strong></p>
      <div class="page-header" id="page-top"><h1>〔居住者、非永住者及び非居住者（第3、4、5号関係）〕</h1></div>
      <h2>（住所の意義）</h2>
      <p class="indent1"><strong>2－1　</strong>法に規定する住所とは各人の生活の本拠をいう。</p>
      <p class="indent2">（注）　留意する。</p>
      <p class="page-top-link"><a href="#page-top">このページの先頭へ</a></p>
    </div>
  </body>
</html>`;

describe("parseTsutatsuPage", () => {
  it("extracts title, citation, document number, headings, and markdown", () => {
    const result = parseTsutatsuPage({
      html: fixtureHtml,
      url: "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01/01.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    expect(result.document).toMatchObject({
      id: "tsutatsu-shotoku-01-01",
      title: "〔居住者、非永住者及び非居住者（第3、4、5号関係）〕",
      category: "shotoku",
      canonicalUrl: "https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01/01.htm",
      sourceType: "tsutatsu",
    });
    expect(result.document.aliases).toContain("居住者、非永住者及び非居住者（第3、4、5号関係）");
    expect(result.document.metadata.citation).toBe("法第2条《定義》関係");
    expect(result.document.metadata.document_number).toBe("2-1");
    expect(result.document.metadata.tags).toContain("所得税");
    expect(result.markdown).toContain("# 〔居住者、非永住者及び非居住者（第3、4、5号関係）〕");
    expect(result.markdown).toContain("## （住所の意義）");
    expect(result.markdown).not.toContain("このページの先頭へ");
    expect(result.meta.content_hash).toMatch(/^sha256:/u);
    expect(result.meta.license).toBe("public_data");
  });

  it("falls back to a centered strong title when h1 is absent", () => {
    const result = parseTsutatsuPage({
      html: `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <p align="center"><strong>第4章　通則</strong></p>
      <h2>（納税義務）</h2>
      <p class="indent1"><strong>14－1　</strong>例示文です。</p>
    </div>
  </body>
</html>`,
      url: "https://www.nta.go.jp/law/tsutatsu/kihon/hojin/14/14_04.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    expect(result.document.title).toBe("第4章　通則");
    expect(result.document.aliases).toContain("第4章　通則");
    expect(result.markdown).toContain("# 第4章　通則");
  });

  it("parses kobetsu document pages and derives the category from the kobetsu path", () => {
    const result = parseTsutatsuPage({
      html: `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <div class="page-header" id="page-top"><h1>個別通達の見出し</h1></div>
      <h2>（適用範囲）</h2>
      <p class="indent1"><strong>1－1　</strong>例示文です。</p>
    </div>
  </body>
</html>`,
      url: "https://www.nta.go.jp/law/tsutatsu/kobetsu/hojin/houzin/01.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    expect(result.document).toMatchObject({
      id: "tsutatsu-hojin-houzin-01",
      title: "個別通達の見出し",
      category: "hojin",
      canonicalUrl: "https://www.nta.go.jp/law/tsutatsu/kobetsu/hojin/houzin/01.htm",
    });
    expect(result.meta.tags).toContain("法人税");
  });
});
