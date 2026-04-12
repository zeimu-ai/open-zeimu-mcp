import { describe, expect, it } from "vitest";

import {
  discoverWrittenAnswerIndexPages,
  extractWrittenAnswerLinks,
} from "../../../../src/crawler/written-answer/discovery.js";

describe("discoverWrittenAnswerIndexPages", () => {
  it("returns major tax category index URLs from the root page", async () => {
    const urls = await discoverWrittenAnswerIndexPages({
      html: `
        <ul>
          <li><a href="/law/bunshokaito/shotoku/02.htm">所得税</a></li>
          <li><a href="/law/bunshokaito/shotoku/02_1.htm">所得税（項目別）</a></li>
          <li><a href="/law/bunshokaito/hojin/08.htm">法人税</a></li>
          <li><a href="/law/bunshokaito/shohi/09.htm">消費税</a></li>
          <li><a href="/law/bunshokaito/shozei/10.htm">印紙税その他</a></li>
        </ul>
      `,
      baseUrl: "https://www.nta.go.jp/law/bunshokaito/01.htm",
    });

    expect(urls).toEqual([
      "https://www.nta.go.jp/law/bunshokaito/hojin/08.htm",
      "https://www.nta.go.jp/law/bunshokaito/shohi/09.htm",
      "https://www.nta.go.jp/law/bunshokaito/shotoku/02.htm",
      "https://www.nta.go.jp/law/bunshokaito/shozei/10.htm",
    ]);
  });
});

describe("extractWrittenAnswerLinks", () => {
  it("extracts document pages from a category page and ignores category pages, attachments, and PDFs", () => {
    const urls = extractWrittenAnswerLinks(
      `
        <p><a href="/law/bunshokaito/shohi/250124/index.htm">官報の発行に関する法律に基づき国から委託を受けた受託者が行う書面等による提供等に係る手数料に関する消費税の取扱いについて</a></p>
        <p><a href="/law/bunshokaito/shohi/240331/index.htm#a-01">感染症の予防及び感染症の患者に対する医療に関する法律第56条の49に規定する匿名感染症関連情報の提供に係る手数料に関する消費税の取扱いについて</a></p>
        <p><a href="/law/bunshokaito/shohi/250124/besshi.htm#a01">別紙</a></p>
        <p><a href="/law/bunshokaito/shohi/250124/besshi.pdf">PDF</a></p>
        <p><a href="/law/bunshokaito/shohi/09.htm">消費税</a></p>
      `,
      "https://www.nta.go.jp/law/bunshokaito/shohi/09.htm",
    );

    expect(urls).toEqual([
      "https://www.nta.go.jp/law/bunshokaito/shohi/240331/index.htm",
      "https://www.nta.go.jp/law/bunshokaito/shohi/250124/index.htm",
    ]);
  });
});
