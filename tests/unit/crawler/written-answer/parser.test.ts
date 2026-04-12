import { describe, expect, it } from "vitest";

import { parseWrittenAnswerPage } from "../../../../src/crawler/written-answer/parser.js";

const fixtureHtml = `<!DOCTYPE html>
<html lang="ja">
  <body>
    <div id="bodyArea">
      <ol class="breadcrumb">
        <li><a href="/law/index.htm">ホーム</a></li>
        <li><a href="/law/bunshokaito/01.htm">文書回答事例</a></li>
        <li><a href="/law/bunshokaito/shohi/09.htm">消費税</a></li>
      </ol>
      <div class="page-header" id="page-top">
        <h1>官報の発行に関する法律に基づき国から委託を受けた受託者が行う書面等による提供等に係る手数料に関する消費税の取扱いについて</h1>
      </div>
      <p>取引等に係る税務上の取扱い等に関する照会（同業者団体等用）</p>
      <p>〔照会〕</p>
      <table class="table table-bordered kaito">
        <tbody>
          <tr>
            <th scope="row">照会者</th>
            <td>内閣府</td>
          </tr>
          <tr>
            <th scope="row">照会の内容</th>
            <td><a href="/law/bunshokaito/shohi/250124/besshi.htm#a01">別紙の１</a>のとおり</td>
          </tr>
          <tr>
            <th scope="row">関係する法令条項等</th>
            <td>消費税法第６条、別表第二第５号</td>
          </tr>
        </tbody>
      </table>
      <p id="kaitou">〔回答〕</p>
      <table class="table table-bordered kaito">
        <tbody>
          <tr>
            <th scope="row">回答年月日</th>
            <td>令和７年１月21日</td>
            <th scope="row">回答者</th>
            <td>国税庁課税部審理室長</td>
          </tr>
          <tr>
            <th scope="row">回答内容</th>
            <td colspan="3">標題のことについては、ご照会に係る事実関係を前提とする限り、貴見のとおりで差し支えありません。</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>`;

describe("parseWrittenAnswerPage", () => {
  it("extracts title, category, citation, headings, and markdown", () => {
    const result = parseWrittenAnswerPage({
      html: fixtureHtml,
      url: "https://www.nta.go.jp/law/bunshokaito/shohi/250124/index.htm",
      crawledAt: "2026-04-12T01:00:00.000Z",
    });

    expect(result.document).toMatchObject({
      id: "bunshokaito-shohi-250124",
      title: "官報の発行に関する法律に基づき国から委託を受けた受託者が行う書面等による提供等に係る手数料に関する消費税の取扱いについて",
      category: "shohi",
      canonicalUrl: "https://www.nta.go.jp/law/bunshokaito/shohi/250124/index.htm",
      sourceType: "written_answer",
    });
    expect(result.document.aliases).toEqual([]);
    expect(result.document.metadata.citation).toBe(
      "取引等に係る税務上の取扱い等に関する照会（同業者団体等用）",
    );
    expect(result.document.metadata.document_number).toBe("250124");
    expect(result.document.metadata.page_offsets).toEqual([]);
    expect(result.markdown).toContain("# 官報の発行に関する法律に基づき国から委託を受けた受託者が行う書面等による提供等に係る手数料に関する消費税の取扱いについて");
    expect(result.markdown).toContain("## 〔照会〕");
    expect(result.markdown).toContain("## 〔回答〕");
    expect(result.markdown).toContain("別紙の１");
    expect(result.markdown).toContain("回答年月日");
    expect(result.meta.content_hash).toMatch(/^sha256:/u);
    expect(result.meta.license).toBe("国税庁 文書回答事例（利用規約に従って再配布）");
  });
});
